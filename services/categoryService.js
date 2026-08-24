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

export const addCategory = async ({ name, description }) => {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }

  const trimmedName = name.trim();

  // case-insensitive duplicate check
  const existingCategory = await Category.findOne({
    name: { $regex: `^${trimmedName}$`, $options: "i" },
    isDeleted: false
  });

  if (existingCategory) {
    throw new Error("Category already exists");
  }

  return await Category.create({
    name: trimmedName,
    description: description?.trim() || ""
  });
};

export const updateCategory = async (id, { name, description }) => {
  if (!name || !name.trim()) {
    throw new Error("Category name is required");
  }

  const trimmedName = name.trim();

  // case-insensitive duplicate check excluding current id
  const existingCategory = await Category.findOne({
    _id: { $ne: id },
    name: { $regex: `^${trimmedName}$`, $options: "i" },
    isDeleted: false
  });

  if (existingCategory) {
    throw new Error("Another category already exists");
  }

  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    {
      name: trimmedName,
      description: description?.trim() || ""
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

