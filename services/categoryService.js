import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";
import { MESSAGES } from "../constants/messages.js";

/**
 * Service to handle Category business logic
 */

export const getCategories = async (search = "", page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const query = {
    isDeleted: false,
    name: { $regex: search, $options: "i" }
  };

  const totalCategories = await Category.countDocuments(query);
  const totalPages = Math.ceil(totalCategories / limit);

  const categories = await Category.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    categories,
    totalPages,
    currentPage: page,
    search,
    totalCategories
  };
};

export const getCategoryById = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }
  const category = await Category.findById(id);
  if (!category || category.isDeleted) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }
  return category;
};


const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const addCategory = async ({ name, description }) => {
  const errors = {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";

  if (!trimmedName) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_REQUIRED;
  } else if (trimmedName.length < 3) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_MIN;
  } else if (trimmedName.length > 50) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_MAX;
  } else if (!/^[a-zA-Z0-9\s\-&]+$/.test(trimmedName)) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_INVALID;
  } else if (!/[a-zA-Z]/.test(trimmedName)) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_NO_LETTER;
  }

  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_REQUIRED;
  } else if (trimmedDescription.length < 5) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_MIN;
  } else if (trimmedDescription.length > 500) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_MAX;
  }

  if (Object.keys(errors).length > 0) {
    const error = new Error(Object.values(errors)[0]);
    error.validationErrors = errors;
    throw error;
  }

  // Case-insensitive duplicate check among active categories
  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    isDeleted: false,
  });

  if (existingCategory) {
    const error = new Error(MESSAGES.VALIDATION.CATEGORY.EXISTS);
    error.validationErrors = { name: MESSAGES.VALIDATION.CATEGORY.EXISTS };
    throw error;
  }

  return await Category.create({
    name: trimmedName,
    description: trimmedDescription,
  });
};

export const updateCategory = async (id, { name, description }) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }

  const errors = {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";

  if (!trimmedName) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_REQUIRED;
  } else if (trimmedName.length < 3) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_MIN;
  } else if (trimmedName.length > 50) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_MAX;
  } else if (!/^[a-zA-Z0-9\s\-&]+$/.test(trimmedName)) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_INVALID;
  } else if (!/[a-zA-Z]/.test(trimmedName)) {
    errors.name = MESSAGES.VALIDATION.CATEGORY.NAME_NO_LETTER;
  }

  if (!trimmedDescription) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_REQUIRED;
  } else if (trimmedDescription.length < 5) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_MIN;
  } else if (trimmedDescription.length > 500) {
    errors.description = MESSAGES.VALIDATION.CATEGORY.DESC_MAX;
  }

  if (Object.keys(errors).length > 0) {
    const error = new Error(Object.values(errors)[0]);
    error.validationErrors = errors;
    throw error;
  }

  // Case-insensitive duplicate check excluding current id
  const existingCategory = await Category.findOne({
    _id: { $ne: id },
    name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
    isDeleted: false,
  });

  if (existingCategory) {
    const error = new Error(MESSAGES.VALIDATION.CATEGORY.EXISTS);
    error.validationErrors = { name: MESSAGES.VALIDATION.CATEGORY.EXISTS };
    throw error;
  }

  const updatedCategory = await Category.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      name: trimmedName,
      description: trimmedDescription,
    },
    { new: true }
  );

  if (!updatedCategory) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }

  return updatedCategory;
};

export const deleteCategory = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }

  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) {
    throw new Error(MESSAGES.CATEGORY.NOT_FOUND);
  }

  // Prevent deletion if active products are still linked to this category
  const linkedProducts = await Product.countDocuments({
    category: id,
    isDeleted: false
  });

  if (linkedProducts > 0) {
    throw new Error(
      `Cannot delete this category. It has ${linkedProducts} active product(s). Remove or reassign the products first.`
    );
  }

  const deletedCategory = await Category.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );

  return deletedCategory;
};

