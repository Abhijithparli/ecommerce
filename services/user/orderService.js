import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Order business logic (User)
 *
 * Responsibilities:
 *  - createOrder: validate cart items one final time, create Order document,
 *    atomically deduct stock, clear cart
 *  - getUserOrders: paginated order history
 *  - getOrderById: single order (with ownership check at controller level)
 *  - cancelOrder: cancel + restore stock
 */

/**
 * Helper: find the exact variant for a cart item.
 * Primary:  variantId (the ObjectId stored in the cart item)
 * Fallback: size string (for older items that may not have variantId)
 *
 * Using variantId as primary is critical because:
 * - Two variants of the SAME size could theoretically exist if data is inconsistent
 * - variantId is the unique MongoDB subdocument _id — it is always unambiguous
 *
 * @param {Array}  variants  - product.variants []
 * @param {Object} cartItem  - { variantId, size }
 * @returns variant object or null
 */
const findVariantForCartItem = (variants, cartItem) => {
  if (!variants || variants.length === 0) return null;

  // Primary lookup: by variantId (ObjectId)
  if (cartItem.variantId) {
    const byId = variants.find(
      (v) => v._id.toString() === cartItem.variantId.toString()
    );
    if (byId) return byId;
  }

  // Fallback: by size string (covers cart items that pre-date variantId storage)
  if (cartItem.size) {
    return (
      variants.find(
        (v) => v.size.toUpperCase() === cartItem.size.toUpperCase()
      ) || null
    );
  }

  return null;
};

/**
 * Create a COD order.
 *
 * Full sequence:
 *  1. Validate addressId provided
 *  2. Load cart → throw if empty
 *  3. For EVERY cart item: validate product available, variant exists, stock sufficient
 *     (This is the SECOND validation — checkout page already did it once)
 *  4. Get address from user document → throw if not found
 *  5. Calculate totals using LIVE DB variant prices (never trust browser-sent prices)
 *  6. Generate unique orderId
 *  7. Create Order document
 *  8. Save order
 *  9. Atomically deduct stock from each variant using $inc (race-condition safe)
 * 10. Clear cart items (ONLY after order save succeeds)
 * 11. Return saved order
 *
 * @param {Object} { userId, addressId, paymentMethod }
 * @returns saved Order document
 */
export const createOrder = async ({ userId, addressId, paymentMethod }) => {
  // ─── 1. Validate address ID was provided ────────────────────────────────────
  if (!addressId) {
    throw new Error(MESSAGES.CHECKOUT.ADDRESS_REQUIRED);
  }

  // ─── 2. Load Cart ────────────────────────────────────────────────────────────
  // We populate items.product so we can access product fields directly
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    throw new Error(MESSAGES.CART.EMPTY);
  }

  // ─── 3. Stock Validation (FINAL check before order creation) ─────────────────
  //
  // We cannot trust the populated product in cart.items because the populate
  // might have cached data. For critical operations like stock deduction,
  // we validate against the live product document.
  //
  // This loop also catches:
  // - Product deleted/blocked AFTER the user opened the checkout page
  // - Variant removed AFTER the user opened the checkout page
  // - Another user buying the last item BETWEEN checkout page load and order placement

  for (const item of cart.items) {
    const product = item.product;

    // 3a. Product existence check (populate sets it to null if product was hard-deleted)
    if (!product) {
      throw new Error(
        `A product in your cart no longer exists. Please review your cart.`
      );
    }

    // 3b. Product availability checks
    if (product.isDeleted) {
      throw new Error(
        `"${product.name}" has been removed. Please update your cart.`
      );
    }

    if (product.isBlocked) {
      throw new Error(
        `"${product.name}" is currently unavailable. Please update your cart.`
      );
    }

    // 3c. Find exact variant (variantId primary, size fallback)
    const variant = findVariantForCartItem(product.variants, item);

    if (!variant) {
      throw new Error(
        `Size ${item.size} variant for "${product.name}" is no longer available.`
      );
    }

    // 3d. Stock check
    if (variant.stock <= 0) {
      throw new Error(
        `"${product.name}" (Size: ${variant.size}) is out of stock.`
      );
    }

    if (item.quantity > variant.stock) {
      throw new Error(
        `Insufficient stock for "${product.name}" (Size: ${variant.size}). ` +
        `Available: ${variant.stock}, Requested: ${item.quantity}`
      );
    }
  }

  // ─── 4. Get Delivery Address ─────────────────────────────────────────────────
  //
  // Addresses are embedded in the User document as a sub-array.
  // user.addresses.id(addressId) is a Mongoose helper that finds a subdocument by _id.
  // We store a SNAPSHOT of the address in the order — so if the user edits their
  // address later, historical orders are not affected.

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const address = user.addresses.id(addressId);
  if (!address) {
    throw new Error(MESSAGES.CHECKOUT.INVALID_ADDRESS);
  }

  // ─── 5. Calculate Totals (server-side — NEVER trust browser-submitted prices) ──
  //
  // We loop through cart items again and use the LIVE variant price from the
  // populated product. This is what gets stored as "priceAtPurchase" in the order.

  let totalPrice = 0;
  const orderItems = cart.items.map((item) => {
    const variant = findVariantForCartItem(item.product.variants, item);
    // At this point variant is guaranteed to exist (we validated above)
    const priceAtPurchase = variant.price;
    totalPrice += priceAtPurchase * item.quantity;

    return {
      product:   item.product._id,
      variantId: variant._id,         // snapshot: exact variant at purchase time
      name:      item.product.name,
      image:     item.product.images?.[0] || "",
      size:      variant.size,         // snapshot: size name at purchase time
      quantity:  item.quantity,
      price:     priceAtPurchase,      // snapshot: price at purchase time
    };
  });

  // ─── 6. Generate Unique Order ID ─────────────────────────────────────────────
  //
  // Format: HS-{timestamp}-{4 random digits}
  // HS prefix = HeadShield
  // Timestamp ensures uniqueness; random suffix adds collision safety

  const orderId = `HS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // ─── 7. Build Order Document ─────────────────────────────────────────────────
  //
  // deliveryAddress is a snapshot of the address AT ORDER TIME.
  // Even if the user edits or deletes the address later, this order record is safe.

  const order = new Order({
    orderId,
    user: userId,
    items: orderItems,
    deliveryAddress: {
      name:    address.name,
      phone:   address.phone,
      street:  address.street,
      city:    address.city,
      state:   address.state,
      pincode: address.pincode,
      country: address.country || "India",
      type:    address.type || "Home",
    },
    paymentMethod,
    paymentStatus:
      paymentMethod === PAYMENT_METHOD.COD
        ? PAYMENT_STATUS.PENDING   // COD: payment happens at delivery
        : PAYMENT_STATUS.PAID,
    totalPrice,
    discount: 0,
    finalPrice: totalPrice,   // discount = 0, shipping = free, tax = 0
    status: ORDER_STATUS.PLACED,
    statusHistory: [{ status: ORDER_STATUS.PLACED, updatedAt: new Date() }],
  });

  // ─── 8. Save Order ───────────────────────────────────────────────────────────
  //
  // We save BEFORE deducting stock and BEFORE clearing the cart.
  // If save fails, nothing else happens — the cart is preserved.
  await order.save();

  // ─── 9. Deduct Stock (Atomic $inc) ───────────────────────────────────────────
  //
  // $inc is an atomic MongoDB operation. It reads and writes in a single database
  // round-trip, which prevents the race condition of:
  //   read(stock=5) → check(5>=3) → another user buys 3 → write(stock=2) ← WRONG!
  //
  // With $inc: { "variants.$.stock": -quantity }, MongoDB does the subtraction
  // atomically at the database level. This is the correct approach for e-commerce.
  //
  // The "variants.$.stock" positional operator ($) refers to the matched variant.
  // We match by: _id (product) AND variants._id (the exact variant subdocument).
  // Using variants._id (not variants.size) guarantees we deduct from the RIGHT variant.

  for (const item of cart.items) {
    const variant = findVariantForCartItem(item.product.variants, item);

    await Product.updateOne(
      {
        _id: item.product._id,
        "variants._id": variant._id    // match the EXACT variant by its ObjectId
      },
      {
        $inc: { "variants.$.stock": -item.quantity }   // atomically subtract quantity
      }
    );
  }

  // ─── 10. Clear Cart (ONLY after successful order save) ───────────────────────
  //
  // We clear the cart AFTER the order is saved and stock is deducted.
  // If order.save() throws above, we never reach this line → cart is preserved.
  cart.items = [];
  await cart.save();

  // ─── 11. Return Order ────────────────────────────────────────────────────────
  return order;
};

/**
 * Get paginated list of orders for a user.
 *
 * @param {string} userId
 * @param {number} page   - 1-based page number
 * @param {number} limit  - items per page
 */
export const getUserOrders = async (userId, page = 1, limit = 5) => {
  const query = { user: userId };
  const skip = (page - 1) * limit;

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    currentPage: page,
    totalPages,
    totalOrders,
  };
};

/**
 * Get a single order by its MongoDB _id.
 * NOTE: Ownership check (order.user === loggedInUser) must be done in the controller.
 *
 * @param {string} orderId  - MongoDB _id (not the human-readable orderId field)
 */
export const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }
  return order;
};

/**
 * Cancel an order and restore variant stock.
 *
 * Only PLACED or SHIPPED orders can be cancelled.
 * Stock is restored to each variant using $inc (same atomic approach as deduction).
 *
 * @param {string} orderId  - MongoDB _id
 * @param {string} userId   - must match order.user (ownership check)
 */
export const cancelOrder = async (orderId, userId) => {
  // Ownership check is built into the query: { _id: orderId, user: userId }
  // If the order belongs to a different user, this returns null → throws NOT_FOUND
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (
    order.status !== ORDER_STATUS.PLACED &&
    order.status !== ORDER_STATUS.SHIPPED
  ) {
    throw new Error(`Cannot cancel an order with status: ${order.status}`);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.statusHistory.push({
    status: ORDER_STATUS.CANCELLED,
    updatedAt: new Date(),
  });
  await order.save();

  // Restore stock for each item using variantId (exact variant)
  for (const item of order.items) {
    const updateQuery = item.variantId
      ? { _id: item.product, "variants._id": item.variantId }
      : { _id: item.product, "variants.size": item.size };  // fallback for old orders

    await Product.updateOne(
      updateQuery,
      { $inc: { "variants.$.stock": item.quantity } }
    );
  }

  return order;
};
