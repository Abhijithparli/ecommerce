import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Review from "../models/reviewModel.js";
import mongoose from "mongoose";
import sharp from "sharp";
import path from "path";

/**
 * Service to handle Product business logic
 */

// ================= ADMIN OPERATIONS =================

export const getAdminProducts = async (search = "", page = 1, limit = 10) => {
  const query = { isDeleted: false };

  if (search.trim() !== "") {
    query.$or = [
      { name: { $regex: search.trim(), $options: "i" } },
      { brand: { $regex: search.trim(), $options: "i" } }
    ];
  }

  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);
  const skip = (page - 1) * limit;

  const products = await Product.find(query)
     .populate("category")
     .sort({ createdAt: -1 })
     .skip(skip)
     .limit(limit);

  const categories = await Category.find({ isDeleted: false });

  return {
    products,
    categories,
    search,
    totalPages,
    currentPage: page,
    totalProducts
  };
};

export const getActiveCategories = async () => {
  return await Category.find({ isDeleted: false });
};

export const getProductById = async (id) => {
  const product = await Product.findById(id).populate("category");
  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }
  return product;
};

export const parseVariants = (fields) => {
  if (!fields) return [];

  // Case 1: fields.variants is already an array of objects
  if (Array.isArray(fields.variants)) {
    return fields.variants;
  }

  // Case 2: fields.variants is an object like { '0': { size: 'S', stock: '5' }, ... }
  if (fields.variants && typeof fields.variants === "object") {
    return Object.values(fields.variants);
  }

  // Case 3: fields has bracket notation keys like 'variants[0][size]' and 'variants[0][stock]' from multipart/form-data
  const variantMap = {};
  for (const key of Object.keys(fields)) {
    const match = key.match(/^variants\[(\d+)\]\[(size|stock)\]$/);
    if (match) {
      const index = match[1];
      const prop = match[2];
      if (!variantMap[index]) {
        variantMap[index] = {};
      }
      variantMap[index][prop] = fields[key];
    }
  }
  const indices = Object.keys(variantMap).sort((a, b) => Number(a) - Number(b));
  if (indices.length > 0) {
    return indices.map((idx) => variantMap[idx]);
  }

  // Case 4: legacy fields variantSize and variantQuantity
  if (fields.variantSize && fields.variantQuantity) {
    const sizes = Array.isArray(fields.variantSize) ? fields.variantSize : [fields.variantSize];
    const quantities = Array.isArray(fields.variantQuantity) ? fields.variantQuantity : [fields.variantQuantity];
    const legacyVariants = [];
    for (let i = 0; i < sizes.length; i++) {
      legacyVariants.push({
        size: sizes[i],
        stock: quantities[i]
      });
    }
    return legacyVariants;
  }

  return [];
};

export const addProduct = async (fields, files) => {
  const {
    name,
    description,
    brand,
    category,
    regularPrice,
    salePrice,
    highlights
  } = fields;

  const errors = {};  

  // Validation
  if (!name || name.trim() === "") {
    errors.name = "Product name is required";
  } else {
    const existingProduct = await Product.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false
    });
    if (existingProduct) {
      errors.name = "Product name already exists";
    }
  }

  if (!brand || brand.trim() === "") {
    errors.brand = "Brand is required";
  }

  if (!category || category.trim() === "") {
    errors.category = "Category is required";
  }

  if (!regularPrice || isNaN(Number(regularPrice)) || Number(regularPrice) <= 0) {
    errors.regularPrice = "Regular price must be greater than 0";
  }

  if (!salePrice || isNaN(Number(salePrice)) || Number(salePrice) <= 0) {
    errors.salePrice = "Sale price must be greater than 0";
  } else if (regularPrice && Number(salePrice) > Number(regularPrice)) {
    errors.salePrice = "Sale price cannot be greater than regular price";
  }

  if (!description || description.trim() === "") {
    errors.description = "Description is required";
  }

  if (!files || files.length < 3) {
    errors.images = "Minimum 3 product images required";
  }

  // Variants conversion & validation
  const rawVariants = parseVariants(fields);
  const variants = [];
  const allowedSizes = ["S", "M", "L", "XL"];
  const seenSizes = new Set();

  if (!rawVariants || rawVariants.length === 0) {
    errors.variants = "At least one size variant is required";
  } else {
    for (let i = 0; i < rawVariants.length; i++) {
      const v = rawVariants[i];
      const s = typeof v?.size === "string" ? v.size.trim().toUpperCase() : "";
      const stockRaw = v?.stock;

      // 1. Size present
      if (!s) {
        errors.variants = "Size is required for all variants";
        break;
      }

      // 2. Allowed sizes check
      if (!allowedSizes.includes(s)) {
        errors.variants = `Invalid size "${s}". Allowed sizes: ${allowedSizes.join(", ")}`;
        break;
      }

      // 3. Stock present
      if (stockRaw === undefined || stockRaw === null || (typeof stockRaw === "string" && stockRaw.trim() === "")) {
        errors.variants = `Stock is required for size ${s}`;
        break;
      }

      // 4. Stock valid non-negative integer
      const stockNum = Number(stockRaw);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.variants = `Stock for size ${s} must be a non-negative integer`;
        break;
      }

      // 5. Duplicate sizes rejected
      if (seenSizes.has(s)) {
        errors.variants = `Duplicate variant size "${s}" is not allowed`;
        break;
      }

      seenSizes.add(s);
      variants.push({
        size: s,
        stock: stockNum
      });
    }
  }

  if (variants.length === 0 && !errors.variants) {
    errors.variants = "At least one size variant is required";
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error(errors.variants || errors.name || "Validation failed");
    err.validationErrors = errors;
    throw err;
  }

  // Highlights conversion
  const highlightsArray = highlights
    ? (Array.isArray(highlights) ? highlights : highlights.split(",")).map((item) => item.trim()).filter(Boolean)
    : [];

  // Image upload and sharp processing
  const imagePaths = [];
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.buffer) {
        const fileName = Date.now() + "-" + i + ".webp";
        const uploadPath = path.join("public/uploads/products", fileName);

        await sharp(file.buffer)
          .resize(800, 800)
          .webp({ quality: 80 })
          .toFile(uploadPath);

        imagePaths.push("/uploads/products/" + fileName);
      } else if (file.path || typeof file === "string") {
        imagePaths.push(typeof file === "string" ? file : file.path);
      }
    }
  }

  const newProduct = new Product({
    name: name.trim(),
    description: description.trim(),
    brand: brand.trim(),
    category,
    regularPrice: Number(regularPrice),
    salePrice   : Number(salePrice),
    variants,
    images: imagePaths,
    highlights: highlightsArray
  });

  return await newProduct.save();
};

export const updateProduct = async (id, fields, files) => {
  const {
    name,
    description,
    brand,
    category,
    regularPrice,
    salePrice,
    highlights,
    variantSize,
    variantQuantity
  } = fields;

  if (isNaN(Number(regularPrice)) || Number(regularPrice) <= 0) {
    throw new Error("Regular Price must be greater than 0");
  }

  if (isNaN(Number(salePrice)) || Number(salePrice) <= 0) {
    throw new Error("Sale Price must be greater than 0");
  }

  if (Number(salePrice) > Number(regularPrice)) {
    throw new Error("Sale Price cannot be greater than Regular Price");
  }

  const product = await Product.findById(id);
  if (!product || product.isDeleted) {
    throw new Error("Product not found");
  }

  // Validation
  if (!name || !description || !brand || !category || !regularPrice || !salePrice) {
    throw new Error("All fields are required");
  }

  const existingProduct = await Product.findOne({
    _id: { $ne: id },
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    isDeleted: false
  });
  if (existingProduct) {
    throw new Error("Product name already exists");
  }

  let images = product.images;

  const deletedImages = fields.deletedImages
  ? JSON.parse(fields.deletedImages)
  : [];

if (deletedImages.length > 0) {
  images = images.filter(
    img => !deletedImages.includes(img)
  );
}

  if (files && files.length > 0) {
    // images = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = Date.now() + "-" + i + ".webp";
      const uploadPath = path.join("public/uploads/products", fileName);

      await sharp(file.buffer)
        .resize(800, 800)
        .webp({ quality: 80 })
        .toFile(uploadPath);

      images.push("/uploads/products/" + fileName);
    }
  }

  const highlightsArray = highlights
    ? highlights.split(",").map((item) => item.trim())
    : [];

  const variants = [];
  if (variantSize && variantQuantity) {
    const sizes = Array.isArray(variantSize) ? variantSize : [variantSize];
    const quantities = Array.isArray(variantQuantity) ? variantQuantity : [variantQuantity];
    const seenSizes = new Set();
    
    for (let i = 0; i < sizes.length; i++) {
      const s = sizes[i]?.trim().toUpperCase();
      const q = Number(quantities[i]);
      
      if (!s) {
        throw new Error("Size is required for all variants");
      }
      if (isNaN(q) || q < 0) {
        throw new Error("Stock must be 0 or greater for all variants");
      }
      if (seenSizes.has(s)) {
        throw new Error("Duplicate variant sizes are not allowed");
      }
      seenSizes.add(s);
      variants.push({
        size: s,
        stock: q
      });
    }
  }

  if (variants.length === 0) {
    throw new Error("At least one size variant is required");
  }

  return await Product.findByIdAndUpdate(id, {
    name: name.trim(),
    description: description.trim(),
    brand: brand.trim(),
    category,
    regularPrice: Number(regularPrice),
    salePrice: Number(salePrice),
    variants,
    images,
    highlights: highlightsArray
  }, { new: true });
};

export const deleteProduct = async (id) => {
  const product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  if (!product) {
    throw new Error("Product not found");
  }
  return product;
};

export const blockProduct = async (id) => {
  const product = await Product.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
  if (!product) {
    throw new Error("Product not found");
  }
  return product;
};

export const unblockProduct = async (id) => {
  const product = await Product.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
  if (!product) {
    throw new Error("Product not found");
  }
  return product;
};


// ================= USER OPERATIONS =================

export const getPublicProducts = async (queryParams) => {
  const search = queryParams.search?.trim() || "";
  const category = queryParams.category || "";
  const sort = queryParams.sort || "";
  const price = queryParams.price || "";
  const brand = queryParams.brand || "";
  const page = parseInt(queryParams.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  // Filter
  const filter = {
    isDeleted: false,
    isBlocked: false
  };

  // Search
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i"
    };
  }

  // Fetch active categories
  const activeCategories = await Category.find({ isDeleted: false });
  const activeCategoryIds = activeCategories.map(c => c._id);

  // Category
  console.log("[DEBUG] queryParams.category received:", category);
  if (category) {
    const isValidObjectId = mongoose.Types.ObjectId.isValid(category);
    console.log("[DEBUG] Is category a valid ObjectId?", isValidObjectId);

    let categoryObj = null;
    if (isValidObjectId) {
      categoryObj = await Category.findOne({ _id: category, isDeleted: false });
    } else {
      categoryObj = await Category.findOne({
        name: { $regex: `^${category}$`, $options: "i" },
        isDeleted: false
      });
    }

    console.log("[DEBUG] Category object found in DB:", categoryObj);

    if (categoryObj) {
      filter.category = categoryObj._id;
    } else {
      // Force query to return no results if category specified but not found/active
      filter.category = new mongoose.Types.ObjectId();
    }
  } else {
    // Hide products whose category is deleted/inactive
    filter.category = { $in: activeCategoryIds };
  }

  // Price range
  if (price === "0-1000") {
    filter.salePrice = { $gte: 0, $lte: 1000 };
  } else if (price === "1000-3000") {
    filter.salePrice = { $gte: 1000, $lte: 3000 };
  } else if (price === "3000-above") {
    filter.salePrice = { $gte: 3000 };
  }

  // Brand
  if (brand) {
    filter.brand = brand;
  }

  // Sort options
  let sortOption = {};
  if (sort === "low-high") {
    sortOption = { salePrice: 1 };
  } else if (sort === "high-low") {
    sortOption = { salePrice: -1 };
  } else if (sort === "a-z") {
    sortOption = { name: 1 };
  } else if (sort === "z-a") {
    sortOption = { name: -1 };
  } else {
    sortOption = { createdAt: -1 };
  }

  console.log("[DEBUG] Generated MongoDB Filter:", JSON.stringify(filter, null, 2));

  const products = await Product.find(filter)
    .populate("category")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  console.log("[DEBUG] Products count returned:", products.length);

  const totalProducts = await Product.countDocuments(filter);
  const totalPages = Math.ceil(totalProducts / limit);

  const brands = await Product.distinct("brand");
  const categories = await Category.find({ isDeleted: false });

  return {
    products,
    categories,
    brands,
    currentPage: page,
    totalPages,
    search,
    category,
    sort,
    price,
    brand
  };
};

export const getPublicProductDetails = async (productId) => {
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false
  }).populate("category");

  if (!product) {
    throw new Error("Product not found");
  }

  // Check block status
  if (product.isBlocked || !product.category || product.category.isDeleted) {
    const error = new Error("Product is unavailable");
    error.isUnavailable = true;
    throw error;
  }

  // Fetch reviews
  const reviews = await Review.find({ product: product._id })
    .populate("user")
    .sort({ createdAt: -1 });

  // Calculate average rating
  let averageRating = 0;
  if (reviews.length > 0) {
    const totalRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
    averageRating = totalRatings / reviews.length;
  }

  // Related products
  const relatedProducts = await Product.find({
    category: product.category._id,
    _id: { $ne: product._id },
    isDeleted: false,
    isBlocked: false
  }).limit(4);

  return {
    product,
    relatedProducts,
    reviews,
    averageRating
  };
};

export const addProductReview = async (userId, productId, rating, comment) => {
  if (!rating || !comment) {
    throw new Error("Rating and comment are required");
  }

  const product = await Product.findById(productId);
  if (!product || product.isDeleted || product.isBlocked) {
    throw new Error("Product is not available for review");
  }

  const existingReview = await Review.findOne({
    user: userId,
    product: productId
  });

  if (existingReview) {
    throw new Error("You have already reviewed this product");
  }

  const review = new Review({
    user: userId,
    product: productId, 
    rating: Number(rating),
    comment: comment.trim()
  });

  return await review.save();
};

export const getHomePageData = async () => {
  const categories = await Category.find({ isDeleted: false }).limit(3);
  const products = await Product.find({ isDeleted: false, isBlocked: false })
    .populate("category")
    .sort({ createdAt: -1 })
    .limit(6);
  return { categories, products }; 
};
