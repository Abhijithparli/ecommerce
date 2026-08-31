import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";


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
  const category = await Category.findById(id);
  if (!category || category.isDeleted) {
    throw new Error("Category not found");
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
    errors.name = "Category name is required";
  } else if (trimmedName.length < 3) {
    errors.name = "Category name must be at least 3 characters long";
  } else if (trimmedName.length > 50) {
    errors.name = "Category name must not exceed 50 characters";
  } else if (!/^[a-zA-Z0-9\s\-&]+$/.test(trimmedName)) {
    errors.name = "Category name can only contain letters, numbers, spaces, hyphens (-), and ampersands (&)";
  } else if (!/[a-zA-Z]/.test(trimmedName)) {
    errors.name = "Category name must contain at least one letter";
  }

  if (!trimmedDescription) {
    errors.description = "Description is required";
  } else if (trimmedDescription.length < 5) {
    errors.description = "Description must be at least 5 characters long";
  } else if (trimmedDescription.length > 500) {
    errors.description = "Description cannot exceed 500 characters";
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
    const error = new Error("A category with this name already exists");
    error.validationErrors = { name: "A category with this name already exists" };
    throw error;
  }

  return await Category.create({
    name: trimmedName,
    description: trimmedDescription,
  });
};

export const updateCategory = async (id, { name, description }) => {
  const errors = {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";

  if (!trimmedName) {
    errors.name = "Category name is required";
  } else if (trimmedName.length < 3) {
    errors.name = "Category name must be at least 3 characters long";
  } else if (trimmedName.length > 50) {
    errors.name = "Category name must not exceed 50 characters";
  } else if (!/^[a-zA-Z0-9\s\-&]+$/.test(trimmedName)) {
    errors.name = "Category name can only contain letters, numbers, spaces, hyphens (-), and ampersands (&)";
  } else if (!/[a-zA-Z]/.test(trimmedName)) {
    errors.name = "Category name must contain at least one letter";
  }

  if (!trimmedDescription) {
    errors.description = "Description is required";
  } else if (trimmedDescription.length < 5) {
    errors.description = "Description must be at least 5 characters long";
  } else if (trimmedDescription.length > 500) {
    errors.description = "Description cannot exceed 500 characters";
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
    const error = new Error("Another category with this name already exists");
    error.validationErrors = { name: "Another category with this name already exists" };
    throw error;
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    {
      name: trimmedName,
      description: trimmedDescription,
    },
    { new: true }
  );

  if (!updatedCategory) {
    throw new Error("Category not found");
  }

  return updatedCategory;
};

export const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Category not found");
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

