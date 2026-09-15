import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import { MESSAGES } from "../../constants/messages.js";
import { CHECKOUT_CONSTANTS } from "../../constants/enums.js";

/**
 * Service to handle Checkout business logic (User)
 *
 * Responsibilities:
 *  - Load and validate the cart (not empty, items still available)
 *  - Load user addresses
 *  - Calculate checkout totals using live DB variant prices
 *
 * NOTE: This service does NOT create the order.
 *       Order creation lives in orderService.js.
 */

/**
 * Helper: find the exact variant for a cart item.
 * Primary lookup: variantId (most precise — the exact subdocument the user selected)
 * Fallback: size string (for older cart items created before variantId was stored)
 *
 * @param {Array}  variants  - product.variants array
 * @param {Object} cartItem  - one cart item (has .variantId and .size)
 * @returns variant object or null
 */
const findVariantForCartItem = (variants, cartItem) => {
  if (!variants || variants.length === 0) return null;

  // Primary: match by variantId (ObjectId comparison using toString)
  if (cartItem.variantId) {
    const byId = variants.find(
      (v) => v._id.toString() === cartItem.variantId.toString()
    );
    if (byId) return byId;
  }

  // Fallback: match by size string
  if (cartItem.size) {
    return variants.find(
      (v) => v.size.toUpperCase() === cartItem.size.toUpperCase()
    ) || null;
  }

  return null;
};

/**
 * Load all data required to render the Checkout page.
 *
 * Flow:
 *  1. Find cart → throw if empty
 *  2. For each cart item: find product, validate it is available, find variant,
 *     validate variant exists and has sufficient stock
 *  3. Load user + addresses
 *  4. Calculate totals: itemTotal per line, subtotal, tax, shipping, grandTotal
 *
 * @param {string} userId
 * @returns {Object} { processedItems, addresses, defaultAddressId, subtotal, tax, shipping, grandTotal }
 */
export const getCheckoutData = async (userId) => {
  // ─── 1. Load Cart ────────────────────────────────────────────────────────────
  const cart = await Cart.findOne({ user: userId });

  if (!cart || cart.items.length === 0) {
    const error = new Error(MESSAGES.CART.EMPTY);
    error.isEmptyCart = true;
    error.statusCode = 400;
    throw error;
  }

  // ─── 2. Load User + Addresses ───────────────────────────────────────────────
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const addresses = user.addresses || [];

  // Find which address should be pre-selected (the one marked isDefault)
  const defaultAddress = addresses.find((a) => a.isDefault);
  const defaultAddressId = defaultAddress ? defaultAddress._id.toString() : null;

  // ─── 3. Validate cart items and calculate totals ─────────────────────────────
  //
  // We do NOT trust the price stored in the cart item.
  // We fetch the live product from MongoDB and use the variant's current price.
  // This is the "price snapshot at display time" — the order creation will do
  // the same check again immediately before creating the order.

  let subtotal = 0;
  const processedItems = [];

  for (const cartItem of cart.items) {
    // 3a. Fetch the live product (not from cart populate — from DB directly)
    const product = await Product.findById(cartItem.product);

    // 3b. Product-level validation
    if (!product || product.isDeleted) {
      const error = new Error(
        `Product is no longer available. Please remove it from your cart.`
      );
      error.statusCode = 400;
      error.redirectToCart = true;
      throw error;
    }

    if (product.isBlocked) {
      const error = new Error(
        `"${product.name}" is currently unavailable. Please remove it from your cart.`
      );
      error.statusCode = 400;
      error.redirectToCart = true;
      throw error;
    }

    // 3c. Find the exact variant (variantId first, then size fallback)
    const variant = findVariantForCartItem(product.variants, cartItem);

    if (!variant) {
      const error = new Error(
        `Size ${cartItem.size} variant for "${product.name}" is no longer available. Please update your cart.`
      );
      error.statusCode = 400;
      error.redirectToCart = true;
      throw error;
    }

    // 3d. Stock validation
    if (variant.stock <= 0) {
      const error = new Error(
        `"${product.name}" (Size: ${variant.size}) is out of stock. Please remove it from your cart.`
      );
      error.statusCode = 400;
      error.redirectToCart = true;
      throw error;
    }

    if (cartItem.quantity > variant.stock) {
      const error = new Error(
        `Only ${variant.stock} unit(s) of "${product.name}" (Size: ${variant.size}) are available. You have ${cartItem.quantity} in your cart.`
      );
      error.statusCode = 400;
      error.redirectToCart = true;
      throw error;
    }

    // 3e. Calculate item pricing using LIVE variant price (not cart-stored price)
    const unitPrice = variant.price;
    const itemTotal = unitPrice * cartItem.quantity;
    subtotal += itemTotal;

    // 3f. Build processed item object for EJS
    processedItems.push({
      _id: cartItem._id,
      productId: product._id,
      variantId: variant._id,
      productName: product.name,
      productImage: product.images?.[0] || "",
      size: variant.size,
      quantity: cartItem.quantity,
      unitPrice,
      itemTotal,
      availableStock: variant.stock,
    });
  }

  // ─── 4. Calculate totals using named constants ───────────────────────────────
  const shipping = CHECKOUT_CONSTANTS.SHIPPING_FEE;
  const tax = Math.round(subtotal * CHECKOUT_CONSTANTS.TAX_RATE);  // ₹0 until tax is configured
  const grandTotal = subtotal + shipping + tax;

  return {
    processedItems,
    addresses,
    defaultAddressId,
    subtotal,
    tax,
    shipping,
    grandTotal,
  };
};
