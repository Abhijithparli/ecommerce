import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import Review from "../models/reviewModel.js";
import mongoose from "mongoose";
import sharp from "sharp";
import path from "path";
import { MESSAGES } from "../constants/messages.js";

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
    ];[]
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
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  const product = await Product.findById(id).populate("category");
  if (!product || product.isDeleted) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
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
  if (fields.variantSize && (fields.variantQuantity !== undefined || fields.stock !== undefined)) {
    const sizes = Array.isArray(fields.variantSize) ? fields.variantSize : [fields.variantSize];
    const rawQty = fields.variantQuantity !== undefined ? fields.variantQuantity : fields.stock;
    const quantities = Array.isArray(rawQty) ? rawQty : [rawQty];
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

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedBrand = typeof brand === "string" ? brand.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  const trimmedCategory = typeof category === "string" ? category.trim() : "";

  // 1. Name validation
  if (!trimmedName) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_REQUIRED;
  } else if (trimmedName.length < 3) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_MIN;
  } else if (trimmedName.length > 100) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_MAX;
  } else {
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      isDeleted: false
    });
    if (existingProduct) {
      errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_EXISTS;
    }
  }

  // 2. Brand validation
  if (!trimmedBrand) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_REQUIRED;
  } else if (trimmedBrand.length < 2) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_MIN;
  } else if (trimmedBrand.length > 50) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_MAX;
  }

  // 3. Category validation
  if (!trimmedCategory) {
    errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_REQUIRED;
  } else if (!mongoose.Types.ObjectId.isValid(trimmedCategory)) {
    errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_INVALID;
  } else {
    const activeCategory = await Category.findOne({ _id: trimmedCategory, isDeleted: false });
    if (!activeCategory) {
      errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_INVALID;
    }
  }

  // 4. Regular Price validation
  const regNum = Number(regularPrice);
  if (regularPrice === undefined || regularPrice === null || regularPrice === "" || isNaN(regNum)) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_REQUIRED;
  } else if (regNum <= 0 || !Number.isFinite(regNum)) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_INVALID;
  } else if (regNum > 1000000) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_MAX;
  }

  // 5. Sale Price validation
  const saleNum = Number(salePrice);
  if (salePrice === undefined || salePrice === null || salePrice === "" || isNaN(saleNum)) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_REQUIRED;
  } else if (saleNum <= 0 || !Number.isFinite(saleNum)) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_INVALID;
  } else if (!errors.regularPrice && saleNum > regNum) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_EXCEEDS_REGULAR;
  }

  // 6. Description validation
  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_REQUIRED;
  } else if (trimmedDescription.length < 10) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MIN;
  } else if (trimmedDescription.length > 2000) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MAX;
  }

  // 7. Highlights validation
  if (highlights && typeof highlights === "string" && highlights.trim().length > 500) {
    errors.highlights = MESSAGES.VALIDATION.PRODUCT.HIGHLIGHTS_MAX;
  }

  // 8. Images validation
  if (!files || files.length < 3) {
    errors.images = MESSAGES.VALIDATION.PRODUCT.IMAGES_MIN;
  }

  // 9. Variants conversion & validation
  const rawVariants = parseVariants(fields);
  const variants = [];
  const allowedSizes = ["S", "M", "L", "XL"];
  const seenSizes = new Set();

  if (!rawVariants || rawVariants.length === 0) {
    errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANTS_REQUIRED;
  } else {
    for (let i = 0; i < rawVariants.length; i++) {
      const v = rawVariants[i];
      const s = typeof v?.size === "string" ? v.size.trim().toUpperCase() : "";
      const stockRaw = v?.stock !== undefined ? v.stock : v?.quantity;

      // Size present
      if (!s) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_REQUIRED;
        break;
      }

      // Allowed sizes check
      if (!allowedSizes.includes(s)) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_INVALID;
        break;
      }

      // Stock present
      if (stockRaw === undefined || stockRaw === null || (typeof stockRaw === "string" && stockRaw.trim() === "")) {
        errors.variants = `Stock is required for size ${s}`;
        break;
      }

      // Stock valid non-negative integer
      const stockNum = Number(stockRaw);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.variants = `Stock for size ${s} must be a non-negative whole integer`;
        break;
      }

      // Duplicate sizes rejected
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
    errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANTS_REQUIRED;
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error(Object.values(errors)[0]);
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
    name: trimmedName,
    description: trimmedDescription,
    brand: trimmedBrand,
    category: trimmedCategory,
    regularPrice: regNum,
    salePrice: saleNum,
    variants,
    images: imagePaths,
    highlights: highlightsArray
  });

  return await newProduct.save();
};

export const updateProduct = async (id, fields, files) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }

  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }

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

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedBrand = typeof brand === "string" ? brand.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";
  const trimmedCategory = typeof category === "string" ? category.trim() : "";

  // 1. Name validation
  if (!trimmedName) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_REQUIRED;
  } else if (trimmedName.length < 3) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_MIN;
  } else if (trimmedName.length > 100) {
    errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_MAX;
  } else {
    const existingProduct = await Product.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      isDeleted: false
    });
    if (existingProduct) {
      errors.name = MESSAGES.VALIDATION.PRODUCT.NAME_EXISTS;
    }
  }

  // 2. Brand validation
  if (!trimmedBrand) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_REQUIRED;
  } else if (trimmedBrand.length < 2) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_MIN;
  } else if (trimmedBrand.length > 50) {
    errors.brand = MESSAGES.VALIDATION.PRODUCT.BRAND_MAX;
  }

  // 3. Category validation
  if (!trimmedCategory) {
    errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_REQUIRED;
  } else if (!mongoose.Types.ObjectId.isValid(trimmedCategory)) {
    errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_INVALID;
  } else {
    const activeCategory = await Category.findOne({ _id: trimmedCategory, isDeleted: false });
    if (!activeCategory) {
      errors.category = MESSAGES.VALIDATION.PRODUCT.CATEGORY_INVALID;
    }
  }

  // 4. Regular Price validation
  const regNum = Number(regularPrice);
  if (regularPrice === undefined || regularPrice === null || regularPrice === "" || isNaN(regNum)) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_REQUIRED;
  } else if (regNum <= 0 || !Number.isFinite(regNum)) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_INVALID;
  } else if (regNum > 1000000) {
    errors.regularPrice = MESSAGES.VALIDATION.PRODUCT.REGULAR_PRICE_MAX;
  }

  // 5. Sale Price validation
  const saleNum = Number(salePrice);
  if (salePrice === undefined || salePrice === null || salePrice === "" || isNaN(saleNum)) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_REQUIRED;
  } else if (saleNum <= 0 || !Number.isFinite(saleNum)) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_INVALID;
  } else if (!errors.regularPrice && saleNum > regNum) {
    errors.salePrice = MESSAGES.VALIDATION.PRODUCT.SALE_PRICE_EXCEEDS_REGULAR;
  }

  // 6. Description validation
  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_REQUIRED;
  } else if (trimmedDescription.length < 10) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MIN;
  } else if (trimmedDescription.length > 2000) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MAX;
  }

  // 7. Highlights validation
  if (highlights && typeof highlights === "string" && highlights.trim().length > 500) {
    errors.highlights = MESSAGES.VALIDATION.PRODUCT.HIGHLIGHTS_MAX;
  }

  // 8. Image calculations & validation
  let images = product.images || [];
  let deletedImages = [];
  try {
    if (fields.deletedImages) {
      deletedImages = typeof fields.deletedImages === "string" ? JSON.parse(fields.deletedImages) : fields.deletedImages;
    }
  } catch {
    deletedImages = [];
  }

  if (Array.isArray(deletedImages) && deletedImages.length > 0) {
    images = images.filter((img) => !deletedImages.includes(img));
  }

  const newFilesCount = files && Array.isArray(files) ? files.length : 0;
  if (images.length + newFilesCount < 3) {
    errors.images = MESSAGES.VALIDATION.PRODUCT.IMAGES_MIN;
  }

  // 9. Variants conversion & validation
  const rawVariants = parseVariants(fields);
  const variants = [];
  const allowedSizes = ["S", "M", "L", "XL"];
  const seenSizes = new Set();

  if (!rawVariants || rawVariants.length === 0) {
    errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANTS_REQUIRED;
  } else {
    for (let i = 0; i < rawVariants.length; i++) {
      const v = rawVariants[i];
      const s = typeof v?.size === "string" ? v.size.trim().toUpperCase() : "";
      const stockRaw = v?.stock !== undefined ? v.stock : v?.quantity;

      if (!s) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_REQUIRED;
        break;
      }
      if (!allowedSizes.includes(s)) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_INVALID;
        break;
      }
      if (stockRaw === undefined || stockRaw === null || (typeof stockRaw === "string" && stockRaw.trim() === "")) {
        errors.variants = `Stock is required for size ${s}`;
        break;
      }
      const stockNum = Number(stockRaw);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.variants = `Stock for size ${s} must be a non-negative whole integer`;
        break;
      }
      if(stockNum < 1){
        errors.variants = `stock for size ${s} must be at least 1`;
        break;
      }
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
    errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANTS_REQUIRED;
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error(Object.values(errors)[0]);
    err.validationErrors = errors;
    throw err;
  }

  // Process new uploaded images
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

        images.push("/uploads/products/" + fileName);
      } else if (file.path || typeof file === "string") {
        images.push(typeof file === "string" ? file : file.path);
      }
    }
  }

  const highlightsArray = highlights
    ? (Array.isArray(highlights) ? highlights : highlights.split(",")).map((item) => item.trim()).filter(Boolean)
    : [];

  return await Product.findByIdAndUpdate(
    id,
    {
      name: trimmedName,
      description: trimmedDescription,
      brand: trimmedBrand,
      category: trimmedCategory,
      regularPrice: regNum,
      salePrice: saleNum,
      variants,
      images,
      highlights: highlightsArray
    },
    { new: true }
  );
};

export const deleteProduct = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  const product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  return product;
};

export const blockProduct = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  const product = await Product.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  return product;
};

export const unblockProduct = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  const product = await Product.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
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
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
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
