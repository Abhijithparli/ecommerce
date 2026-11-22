import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Review from "../../models/reviewModel.js";
import mongoose from "mongoose";
import { MESSAGES } from "../../constants/messages.js";
import { ORDER_STATUS } from "../../constants/enums.js";
import { applyOffersToProducts } from "../common/offerCalculator.js";

/**
 * Service to handle Product business logic (User)
 */

export const getPublicProducts = async (queryParams) => {
  const search = queryParams.search?.trim() || "";
  const sort = queryParams.sort || "";
  const price = queryParams.price || "";
  const page = parseInt(queryParams.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  // Normalize multiple category selections (e.g. ['cat1', 'cat2'], 'cat1,cat2', or 'cat1')
  let rawCategory = queryParams.category;
  let selectedCategories = [];
  if (rawCategory) {
    if (Array.isArray(rawCategory)) {
      selectedCategories = rawCategory
        .flatMap((c) => (typeof c === "string" ? c.split(",") : c))
        .map((c) => String(c).trim())
        .filter(Boolean);
    } else if (typeof rawCategory === "string") {
      selectedCategories = rawCategory
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }

  // Normalize brand selection (supports single string or array)
  let rawBrand = queryParams.brand;
  let selectedBrands = [];
  if (rawBrand) {
    if (Array.isArray(rawBrand)) {
      selectedBrands = rawBrand
        .flatMap((b) => (typeof b === "string" ? b.split(",") : b))
        .map((b) => String(b).trim())
        .filter(Boolean);
    } else if (typeof rawBrand === "string") {
      selectedBrands = rawBrand
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
    }
  }

  // Base filter for public products
  const filter = {
    isDeleted: false,
    isBlocked: false
  };

  const andConditions = [];

  // Search filter across name, brand, and description (case-insensitive regex)
  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    andConditions.push({
      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex }
      ]
    });
  }

  // Active categories lookup
  const activeCategories = await Category.find({ isDeleted: false });
  const activeCategoryIds = activeCategories.map((c) => c._id);
  const activeCategoryMap = new Map(activeCategories.map((c) => [c._id.toString(), c._id]));
  const activeCategoryNameMap = new Map(activeCategories.map((c) => [c.name.toLowerCase(), c._id]));
  const normalizeKey = (str) => String(str).toLowerCase().replace(/[\s\-_]/g, "");
  const activeCategoryNormalizedMap = new Map(
    activeCategories.map((c) => [normalizeKey(c.name), c._id])
  );

  // Multiple category simultaneous filtering (OR condition: category in selectedCategories)
  if (selectedCategories.length > 0) {
    const resolvedCategoryIds = [];
    for (const cat of selectedCategories) {
      if (mongoose.Types.ObjectId.isValid(cat) && activeCategoryMap.has(cat.toString())) {
        resolvedCategoryIds.push(activeCategoryMap.get(cat.toString()));
      } else if (activeCategoryNameMap.has(cat.toLowerCase())) {
        resolvedCategoryIds.push(activeCategoryNameMap.get(cat.toLowerCase()));
      } else if (activeCategoryNormalizedMap.has(normalizeKey(cat))) {
        resolvedCategoryIds.push(activeCategoryNormalizedMap.get(normalizeKey(cat)));
      }
    }

    if (resolvedCategoryIds.length > 0) {
      filter.category = { $in: resolvedCategoryIds };
    } else {
      // Specified categories do not exist or are inactive -> produce empty results
      filter.category = { $in: [new mongoose.Types.ObjectId()] };
    }
  } else {
    // No category filter applied -> restrict to active categories only
    filter.category = { $in: activeCategoryIds };
  }

  // Price range filter using andConditions to prevent $or collisions
  if (price === "0-1000") {
    andConditions.push({
      $or: [
        { salePrice: { $gte: 0, $lte: 1000 } },
        { "variants.price": { $gte: 0, $lte: 1000 } }
      ]
    });
  } else if (price === "1000-3000") {
    andConditions.push({
      $or: [
        { salePrice: { $gte: 1000, $lte: 3000 } },
        { "variants.price": { $gte: 1000, $lte: 3000 } }
      ]
    });
  } else if (price === "3000-above") {
    andConditions.push({
      $or: [
        { salePrice: { $gte: 3000 } },
        { "variants.price": { $gte: 3000 } }
      ]
    });
  }

  // Brand filter
  if (selectedBrands.length === 1) {
    filter.brand = selectedBrands[0];
  } else if (selectedBrands.length > 1) {
    filter.brand = { $in: selectedBrands };
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
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
  } else if (sort === "newest") {
    sortOption = { createdAt: -1 };
  } else {
    sortOption = { createdAt: -1 };
  }

  const rawProducts = await Product.find(filter)
    .populate("category")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const products = await applyOffersToProducts(rawProducts);

  const totalProducts = await Product.countDocuments(filter);
  const totalPages = Math.ceil(totalProducts / limit);

  const brands = await Product.distinct("brand");
  const categories = await Category.find({ isDeleted: false });

  // Query string helper for categories in pagination links
  const categoryQueryString = selectedCategories
    .map((c) => `category=${encodeURIComponent(c)}`)
    .join("&");

  const brandQueryString = selectedBrands
    .map((b) => `brand=${encodeURIComponent(b)}`)
    .join("&");

  return {
    products,
    categories,
    brands,
    currentPage: page,
    totalPages,
    totalProducts,
    search,
    category: selectedCategories.length === 1 ? selectedCategories[0] : selectedCategories,
    selectedCategories,
    categoryQueryString,
    brand: selectedBrands.length === 1 ? selectedBrands[0] : (selectedBrands.length > 1 ? selectedBrands : ""),
    selectedBrands,
    brandQueryString,
    sort,
    price
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

  const processedProduct = await applyOffersToProducts(product);
  const processedRelated = await applyOffersToProducts(relatedProducts);

  return {
    product: processedProduct,
    relatedProducts: processedRelated,
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
  const rawProducts = await Product.find({ isDeleted: false, isBlocked: false })
    .populate("category")
    .sort({ createdAt: -1 })
    .limit(6);
  const products = await applyOffersToProducts(rawProducts);
  return { categories, products }; 
};
