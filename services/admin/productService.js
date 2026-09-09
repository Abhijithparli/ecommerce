import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import mongoose from "mongoose";
import sharp from "sharp";
import path from "path";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Product business logic (Admin)
 */

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

  // Case 2: fields.variants is an object like { '0': { size: 'S', price: '1000', stock: '5' }, ... }
  if (fields.variants && typeof fields.variants === "object") {
    return Object.values(fields.variants);
  }

  // Case 3: fields has bracket notation keys like 'variants[0][size]', 'variants[0][price]', and 'variants[0][stock]'
  const variantMap = {};
  for (const key of Object.keys(fields)) {
    const match = key.match(/^variants\[(\d+)\]\[(size|price|stock)\]$/);
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

  // Case 4: legacy fields variantSize, variantPrice, and variantQuantity / stock
  if (fields.variantSize && (fields.variantQuantity !== undefined || fields.stock !== undefined || fields.variantPrice !== undefined)) {
    const sizes = Array.isArray(fields.variantSize) ? fields.variantSize : [fields.variantSize];
    const rawQty = fields.variantQuantity !== undefined ? fields.variantQuantity : fields.stock;
    const quantities = Array.isArray(rawQty) ? rawQty : [rawQty];
    const rawPrices = fields.variantPrice !== undefined ? fields.variantPrice : (fields.salePrice || fields.regularPrice);
    const prices = Array.isArray(rawPrices) ? rawPrices : [rawPrices];

    const legacyVariants = [];
    for (let i = 0; i < sizes.length; i++) {
      legacyVariants.push({
        size: sizes[i],
        price: prices[i] !== undefined ? prices[i] : (fields.salePrice || fields.regularPrice),
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

  // 4. Description validation
  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_REQUIRED;
  } else if (trimmedDescription.length < 10) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MIN;
  } else if (trimmedDescription.length > 2000) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MAX;
  }

  // 5. Highlights validation
  if (highlights && typeof highlights === "string" && highlights.trim().length > 500) {
    errors.highlights = MESSAGES.VALIDATION.PRODUCT.HIGHLIGHTS_MAX;
  }

  // 6. Images validation
  if (!files || files.length < 3) {
    errors.images = MESSAGES.VALIDATION.PRODUCT.IMAGES_MIN;
  }

  // 7. Variants conversion & validation (Price is part of variant management)
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
      const priceRaw = v?.price !== undefined ? v.price : (v?.regularPrice || v?.salePrice);
      const stockRaw = v?.stock !== undefined ? v.stock : v?.quantity;

      // Size present & allowed
      if (!s) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_REQUIRED;
        break;
      }
      if (!allowedSizes.includes(s)) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_INVALID;
        break;
      }

      // Duplicate sizes rejected
      if (seenSizes.has(s)) {
        errors.variants = `Duplicate variant size "${s}" is not allowed`;
        break;
      }

      // Price present & valid number > 0
      if (priceRaw === undefined || priceRaw === null || (typeof priceRaw === "string" && priceRaw.trim() === "")) {
        errors.variants = `Price is required for size ${s}`;
        break;
      }
      const priceNum = Number(priceRaw);
      if (isNaN(priceNum) || priceNum <= 0 || !Number.isFinite(priceNum)) {
        errors.variants = `Price for size ${s} must be a valid number greater than 0`;
        break;
      }
      if (priceNum > 1000000) {
        errors.variants = `Price for size ${s} cannot exceed 1,000,000`;
        break;
      }

      // Stock present & valid non-negative integer
      if (stockRaw === undefined || stockRaw === null || (typeof stockRaw === "string" && stockRaw.trim() === "")) {
        errors.variants = `Stock is required for size ${s}`;
        break;
      }
      const stockNum = Number(stockRaw);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.variants = `Stock for size ${s} must be a non-negative whole integer`;
        break;
      }

      seenSizes.add(s);
      variants.push({
        size: s,
        price: priceNum,
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
      } else if (file.path || file.filename || typeof file === "string") {
        imagePaths.push(typeof file === "string" ? file : (file.path || file.filename));
      }
    }
  }

  // Synchronize document-level price bounds for backward compatibility & sorting
  const variantPrices = variants.map((v) => v.price);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : (Number(salePrice) || 0);
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : (Number(regularPrice) || minPrice);

  const newProduct = new Product({
    name: trimmedName,
    description: trimmedDescription,
    brand: trimmedBrand,
    category: trimmedCategory,
    regularPrice: maxPrice,
    salePrice: minPrice,
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

  // 4. Description validation
  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_REQUIRED;
  } else if (trimmedDescription.length < 10) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MIN;
  } else if (trimmedDescription.length > 2000) {
    errors.description = MESSAGES.VALIDATION.PRODUCT.DESCRIPTION_MAX;
  }

  // 5. Highlights validation
  if (highlights && typeof highlights === "string" && highlights.trim().length > 500) {
    errors.highlights = MESSAGES.VALIDATION.PRODUCT.HIGHLIGHTS_MAX;
  }

  // 6. Image calculations & validation
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

  // 7. Variants conversion & validation (Price is part of variant management)
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
      const priceRaw = v?.price !== undefined ? v.price : (v?.regularPrice || v?.salePrice);
      const stockRaw = v?.stock !== undefined ? v.stock : v?.quantity;

      if (!s) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_REQUIRED;
        break;
      }
      if (!allowedSizes.includes(s)) {
        errors.variants = MESSAGES.VALIDATION.PRODUCT.VARIANT_SIZE_INVALID;
        break;
      }
      if (seenSizes.has(s)) {
        errors.variants = `Duplicate variant size "${s}" is not allowed`;
        break;
      }

      // Price validation
      if (priceRaw === undefined || priceRaw === null || (typeof priceRaw === "string" && priceRaw.trim() === "")) {
        errors.variants = `Price is required for size ${s}`;
        break;
      }
      const priceNum = Number(priceRaw);
      if (isNaN(priceNum) || priceNum <= 0 || !Number.isFinite(priceNum)) {
        errors.variants = `Price for size ${s} must be a valid number greater than 0`;
        break;
      }
      if (priceNum > 1000000) {
        errors.variants = `Price for size ${s} cannot exceed 1,000,000`;
        break;
      }

      // Stock validation
      if (stockRaw === undefined || stockRaw === null || (typeof stockRaw === "string" && stockRaw.trim() === "")) {
        errors.variants = `Stock is required for size ${s}`;
        break;
      }
      const stockNum = Number(stockRaw);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.variants = `Stock for size ${s} must be a non-negative whole integer`;
        break;
      }

      seenSizes.add(s);
      variants.push({
        size: s,
        price: priceNum,
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
      } else if (file.path || file.filename || typeof file === "string") {
        images.push(typeof file === "string" ? file : (file.path || file.filename));
      }
    }
  }

  const highlightsArray = highlights
    ? (Array.isArray(highlights) ? highlights : highlights.split(",")).map((item) => item.trim()).filter(Boolean)
    : [];

  const variantPrices = variants.map((v) => v.price);
  const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : (Number(salePrice) || product.salePrice || 0);
  const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : (Number(regularPrice) || product.regularPrice || minPrice);

  return await Product.findByIdAndUpdate(
    id,
    {
      name: trimmedName,
      description: trimmedDescription,
      brand: trimmedBrand,
      category: trimmedCategory,
      regularPrice: maxPrice,
      salePrice: minPrice,
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
