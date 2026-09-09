import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Cart business logic (User)
 */

export const addToCart = async ({ userId, productId, size = "M", quantity = 1 }) => {
  const normalizedSize = size.toUpperCase();
  const qty = parseInt(quantity) || 1;

  // Check product
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  });

  if (!product) {
    const error = new Error(MESSAGES.PRODUCT.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  // Check if the size variant exists
  const variant = product.variants?.find(
    (v) => v.size.toUpperCase() === normalizedSize
  );

  if (!variant) {
    const error = new Error(`Size ${normalizedSize} variant is not available for this product`);
    error.statusCode = 400;
    throw error;
  }

  // Out of stock check for variant
  if (variant.stock <= 0) {
    const error = new Error(`Size ${normalizedSize} is out of stock`);
    error.statusCode = 400;
    throw error;
  }

  if (qty > variant.stock) {
    const error = new Error(`Only ${variant.stock} item(s) available for Size ${normalizedSize}`);
    error.statusCode = 400;
    throw error;
  }

  // Find user cart
  let cart = await Cart.findOne({ user: userId });

  // Create new cart if not exists
  if (!cart) {
    cart = new Cart({
      user: userId,
      items: [
        {
          product: productId,
          size: normalizedSize,
          quantity: qty,
        },
      ],
    });

    await cart.save();
    return cart;
  }

  // Check if product + size exists in cart
  const existingItem = cart.items.find(
    (item) =>
      item.product.toString() === productId.toString() &&
      item.size.toUpperCase() === normalizedSize
  );

  if (existingItem) {
    if (existingItem.quantity + qty > variant.stock) {
      const error = new Error(`Cannot add more. Only ${variant.stock} item(s) available in stock.`);
      error.statusCode = 400;
      throw error;
    }
    existingItem.quantity += qty;
  } else {
    cart.items.push({
      product: productId,
      size: normalizedSize,
      quantity: qty,
    });
  }

  await cart.save();
  return cart;
};

export const getUserCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");

  let total = 0;
  if (cart) {
    cart.items.forEach((item) => {
      if (item.product) {
        const variant = item.product.variants?.find(
          (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
        );
        const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
        total += itemPrice * item.quantity;
      }
    });
  }

  return { cart, total };
};

export const updateCartQuantity = async ({ userId, productId, size = "M", action }) => {
  const normalizedSize = size.toUpperCase();

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    const error = new Error(MESSAGES.CART.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const item = cart.items.find(
    (item) =>
      item.product.toString() === productId.toString() &&
      item.size.toUpperCase() === normalizedSize
  );

  if (!item) {
    const error = new Error("Item not found in cart");
    error.statusCode = 404;
    throw error;
  }

  const product = await Product.findById(productId);
  if (!product) {
    const error = new Error(MESSAGES.PRODUCT.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  const variant = product.variants?.find(
    (v) => v.size.toUpperCase() === normalizedSize
  );

  if (!variant) {
    const error = new Error(`Size ${normalizedSize} variant is not available`);
    error.statusCode = 400;
    throw error;
  }

  if (action === "increase") {
    if (item.quantity >= variant.stock) {
      const error = new Error(`Only ${variant.stock} item(s) available in stock.`);
      error.statusCode = 400;
      throw error;
    }
    item.quantity += 1;
  } else if (action === "decrease") {
    if (item.quantity > 1) {
      item.quantity -= 1;
    }
  }

  await cart.save();

  // Recalculate totals
  const populatedCart = await Cart.findById(cart._id).populate("items.product");
  let grandTotal = 0;
  populatedCart.items.forEach((cItem) => {
    if (cItem.product) {
      const v = cItem.product.variants?.find(
        (varItem) => varItem.size.toUpperCase() === (cItem.size || "M").toUpperCase()
      );
      const itemPrice = (v && v.price !== undefined) ? v.price : cItem.product.salePrice;
      grandTotal += itemPrice * cItem.quantity;
    }
  });

  const activeItemVariant = product.variants?.find(
    (v) => v.size.toUpperCase() === normalizedSize
  );
  const activeItemPrice = (activeItemVariant && activeItemVariant.price !== undefined) ? activeItemVariant.price : product.salePrice;

  return {
    quantity: item.quantity,
    subtotal: activeItemPrice * item.quantity,
    grandTotal
  };
};

export const removeCartItem = async ({ userId, productId, size = "M" }) => {
  const normalizedSize = size.toUpperCase();

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    const error = new Error(MESSAGES.CART.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  cart.items = cart.items.filter(
    (item) =>
      !(
        item.product.toString() === productId.toString() &&
        item.size.toUpperCase() === normalizedSize
      )
  );

  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate("items.product");
  let grandTotal = 0;
  populatedCart.items.forEach((cItem) => {
    if (cItem.product) {
      const v = cItem.product.variants?.find(
        (varItem) => varItem.size.toUpperCase() === (cItem.size || "M").toUpperCase()
      );
      const itemPrice = (v && v.price !== undefined) ? v.price : cItem.product.salePrice;
      grandTotal += itemPrice * cItem.quantity;
    }
  });

  return {
    grandTotal,
    cartEmpty: populatedCart.items.length === 0
  };
};
