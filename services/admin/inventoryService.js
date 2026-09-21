import Product from "../../models/productModel.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Inventory and Stock operations (Admin)
 */

/**
 * Get all products with their variant stock levels, for the admin inventory page.
 *
 * @param {string} search - optional, filters by product name
 * @param {number} page
 * @param {number} limit
 */
export const getAllInventory = async (search = "", page = 1, limit = 10) => {
  const query = { isDeleted: false };

  if (search && search.trim() !== "") {
    query.name = { $regex: search.trim(), $options: "i" };
  }

  const skip = (page - 1) * limit;
  const totalProducts = await Product.countDocuments(query);
  const totalPages = Math.ceil(totalProducts / limit);

  const products = await Product.find(query)
    .select("name brand images variants")
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit);

  return {
    products,
    currentPage: page,
    totalPages,
    totalProducts,
  };
};

export const getInventoryStock = async (productId) => {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }
  return {
    productId: product._id,
    name: product.name,
    variants: product.variants || []
  };
};

export const updateVariantStock = async (productId, size, quantity) => {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new Error(MESSAGES.PRODUCT.NOT_FOUND);
  }

  const normalizedSize = (size || "").toUpperCase();
  const variant = product.variants?.find((v) => v.size.toUpperCase() === normalizedSize);
  if (!variant) {
    throw new Error(`Variant size ${normalizedSize} not found for product`);
  }

  const stockNum = Number(quantity);
  if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
    throw new Error("Stock must be a non-negative whole integer");
  }

  return await Product.updateOne(
    { _id: productId, "variants.size": normalizedSize },
    { $set: { "variants.$.stock": stockNum } }
  );
};

export const checkStockAvailability = async (productId, size, quantity) => {
  const product = await Product.findOne({ _id: productId, isDeleted: false, isBlocked: false });
  if (!product) {
    return { available: false, message: MESSAGES.PRODUCT.NOT_FOUND };
  }

  const normalizedSize = (size || "").toUpperCase();
  const variant = product.variants?.find((v) => v.size.toUpperCase() === normalizedSize);
  if (!variant) {
    return { available: false, message: `Size ${normalizedSize} not available` };
  }

  if (variant.stock < quantity) {
    return {
      available: false,
      availableStock: variant.stock,
      message: `Only ${variant.stock} item(s) available in stock`
    };
  }

  return { available: true, availableStock: variant.stock };
};
