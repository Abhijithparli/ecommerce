import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Review from "../../models/reviewModel.js";
import mongoose from "mongoose";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Product business logic (User)
 */

export const getPublicProducts = async (queryParams) => {
  const search = queryParams.search?.trim() || "";
  const sort = queryParams.sort || "";
  const price = queryParams.price || "";
  const brand = queryParams.brand || "";
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

  // Base filter for public products
  const filter = {
    isDeleted: false,
    isBlocked: false
  };

  // Search filter
  if (search) {
    filter.name = {
      $regex: search,
      $options: "i"
    };
  }

  // Active categories lookup
  const activeCategories = await Category.find({ isDeleted: false });
  const activeCategoryIds = activeCategories.map((c) => c._id);
  const activeCategoryMap = new Map(activeCategories.map((c) => [c._id.toString(), c._id]));
  const activeCategoryNameMap = new Map(activeCategories.map((c) => [c.name.toLowerCase(), c._id]));

  // Multiple category simultaneous filtering (OR condition: category in selectedCategories)
  if (selectedCategories.length > 0) {
    const resolvedCategoryIds = [];
    for (const cat of selectedCategories) {
      if (mongoose.Types.ObjectId.isValid(cat) && activeCategoryMap.has(cat.toString())) {
        resolvedCategoryIds.push(activeCategoryMap.get(cat.toString()));
      } else if (activeCategoryNameMap.has(cat.toLowerCase())) {
        resolvedCategoryIds.push(activeCategoryNameMap.get(cat.toLowerCase()));
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

  // Price range filter
  if (price === "0-1000") {
    filter.$or = [
      { salePrice: { $gte: 0, $lte: 1000 } },
      { "variants.price": { $gte: 0, $lte: 1000 } }
    ];
  } else if (price === "1000-3000") {
    filter.$or = [
      { salePrice: { $gte: 1000, $lte: 3000 } },
      { "variants.price": { $gte: 1000, $lte: 3000 } }
    ];
  } else if (price === "3000-above") {
    filter.$or = [
      { salePrice: { $gte: 3000 } },
      { "variants.price": { $gte: 3000 } }
    ];
  }

  // Brand filter
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

  const products = await Product.find(filter)
    .populate("category")
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const totalProducts = await Product.countDocuments(filter);
  const totalPages = Math.ceil(totalProducts / limit);

  const brands = await Product.distinct("brand");
  const categories = await Category.find({ isDeleted: false });

  // Query string helper for categories in pagination links
  const categoryQueryString = selectedCategories
    .map((c) => `category=${encodeURIComponent(c)}`)
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
