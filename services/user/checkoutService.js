import Cart from "../../models/cartModel.js";
import User from "../../models/userModel.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Checkout business logic (User)
 */

export const getCheckoutData = async (userId) => {
  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: { path: "category" }
  });
  if (!cart || cart.items.length === 0) {
    const error = new Error(MESSAGES.CART.EMPTY);
    error.isEmptyCart = true;
    throw error;
  }

  // 2. Validate all cart items before proceeding to checkout
  for (const item of cart.items) {
    const product = item.product;
    if (!product || product.isDeleted || product.isBlocked) {
      throw new Error(`Item "${product ? product.name : 'Unknown'}" is currently unavailable`);
    }

    if (product.category && product.category.isDeleted) {
      throw new Error(`Item "${product.name}" belongs to an inactive category`);
    }

    const variant = product.variants?.find(
      (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
    );

    if (!variant) {
      throw new Error(`Size ${item.size} for "${product.name}" is no longer available`);
    }

    if (variant.stock <= 0) {
      throw new Error(`Size ${item.size} for "${product.name}" is out of stock`);
    }

    if (item.quantity > variant.stock) {
      throw new Error(`Only ${variant.stock} item(s) left in stock for "${product.name}" (${item.size})`);
    }
  }

  // 3. Get User Addresses
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  // 4. Calculate Cart Total with variant pricing
  let total = 0;
  cart.items.forEach((item) => {
    if (item.product) {
      const variant = item.product.variants?.find(
        (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
      );
      const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
      total += itemPrice * item.quantity;
    }
  });

  return {
    cart,
    addresses: user.addresses || [],
    total
  };
};
