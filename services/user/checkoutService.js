import Cart from "../../models/cartModel.js";
import User from "../../models/userModel.js";
import { MESSAGES } from "../../constants/messages.js";
import { getCartStockStatus, removeItemsWithoutSize } from "./cartService.js";
import * as walletService from "./walletService.js";
import { applyOffersToProducts } from "../common/offerCalculator.js";

/**
 * Service to handle Checkout business logic (User)
 */

export const getCheckoutData = async (userId) => {
  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: { path: "category" }
  });
  if (removeItemsWithoutSize(cart)) {
    await cart.save();
  }
  if (!cart || cart.items.length === 0) {
    const error = new Error(MESSAGES.CART.EMPTY);
    error.isEmptyCart = true;
    throw error;
  }

  // 2. Check every cart item. Unavailable items are shown on the page and
  //    the Place Order button is disabled (createOrder re-validates on submit).
  const { itemStatus, hasUnavailableItems } = getCartStockStatus(cart);

  // 3. Get User Addresses
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  // 4. Calculate Cart Total with variant pricing (applying best product/category offers)
  let total = 0;
  if (cart && cart.items.length > 0) {
    const products = cart.items.map((i) => i.product).filter(Boolean);
    const processedProducts = await applyOffersToProducts(products);
    const prodMap = new Map(processedProducts.map((p) => [p._id.toString(), p]));

    cart.items.forEach((item) => {
      if (item.product) {
        const prodId = item.product._id ? item.product._id.toString() : item.product.toString();
        const p = prodMap.get(prodId) || item.product;
        item.product = p;
        const variant = p.variants?.find(
          (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
        );
        const itemPrice = (variant && variant.price !== undefined) ? variant.price : p.salePrice;
        total += itemPrice * item.quantity;
      }
    });
  }

  // 5. Get Wallet Balance
  const walletBalance = await walletService.getWalletBalance(userId);

  return {
    cart,
    addresses: user.addresses || [],
    total,
    itemStatus,
    hasUnavailableItems,
    walletBalance,
  };
};
