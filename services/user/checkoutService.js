import Cart from "../../models/cartModel.js";
import User from "../../models/userModel.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Checkout business logic (User)
 */

export const getCheckoutData = async (userId) => {
  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    const error = new Error(MESSAGES.CART.EMPTY);
    error.isEmptyCart = true;
    throw error;
  }

  // 2. Get User Addresses
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  // 3. Calculate Cart Total with variant pricing
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
