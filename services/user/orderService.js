import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import PDFDocument from "pdfkit";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Order business logic (User)
 */

export const createOrder = async ({ userId, addressId, paymentMethod }) => {
  if (!addressId) {
    throw new Error("Delivery address is required");
  }

  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate({
    path: "items.product",
    populate: { path: "category" }
  });
  if (!cart || cart.items.length === 0) {
    throw new Error(MESSAGES.CART.EMPTY);
  }

  // 2. Validate Stock & Product/Category Status
  for (const item of cart.items) {
    const product = item.product;
    if (!product || product.isDeleted || product.isBlocked) {
      throw new Error(`Product ${product ? product.name : 'Unknown'} is no longer available`);
    }
    if (product.category && product.category.isDeleted) {
      throw new Error(`Category for ${product.name} is no longer active`);
    }
    const variant = product.variants?.find(
      (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
    );
    if (!variant) {
      throw new Error(`Variant size ${item.size} not found for product: ${product.name}`);
    }
    if (item.quantity > variant.stock) {
      throw new Error(`Insufficient stock for ${product.name} (Size: ${item.size}). Available: ${variant.stock}`);
    }
  }

  // 3. Get Address
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }
  const address = user.addresses.id(addressId);
  if (!address) {
    throw new Error("Delivery address not found in profile");
  }

  // 4. Calculate Prices (using selected variant price)
  let totalPrice = 0;
  cart.items.forEach((item) => {
    const variant = item.product.variants?.find(
      (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
    );
    const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
    totalPrice += itemPrice * item.quantity;
  });

  // 5. Generate unique Order ID
  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Create Order
  const order = new Order({
    orderId,
    user: userId,
    items: cart.items.map((item) => {
      const variant = item.product.variants?.find(
        (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
      );
      const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
      return {
        product: item.product._id,
        name: item.product.name,
        image: item.product.images[0] || "",
        size: item.size,
        quantity: item.quantity,
        price: itemPrice,
      };
    }),
    deliveryAddress: {
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || "India",
      type: address.type || "Home",
    },
    paymentMethod,
    paymentStatus: paymentMethod === PAYMENT_METHOD.COD ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID,
    totalPrice,
    discount: 0,
    finalPrice: totalPrice,
    status: ORDER_STATUS.PLACED,
    statusHistory: [{ status: ORDER_STATUS.PLACED, updatedAt: new Date() }],
  });

  // 7. Atomically deduct variant stock (safe against concurrent race conditions)
  const deductedItems = [];
  try {
    for (const item of cart.items) {
      const res = await Product.updateOne(
        {
          _id: item.product._id,
          variants: {
            $elemMatch: {
              size: item.size,
              stock: { $gte: item.quantity },
            },
          },
        },
        { $inc: { "variants.$.stock": -item.quantity } }
      );

      if (res.matchedCount === 0 || res.modifiedCount === 0) {
        throw new Error(
          `Insufficient stock for ${item.product.name} (Size: ${item.size}). Order could not be placed.`
        );
      }

      deductedItems.push({
        productId: item.product._id,
        size: item.size,
        quantity: item.quantity,
      });
    }

    // Save order
    await order.save();
  } catch (err) {
    // Rollback any stock deducted so far
    for (const dItem of deductedItems) {
      await Product.updateOne(
        { _id: dItem.productId, "variants.size": dItem.size },
        { $inc: { "variants.$.stock": dItem.quantity } }
      );
    }
    throw err;
  }

  // 8. Clear Cart
  cart.items = [];
  await cart.save();

  return order;
};
export const getUserOrders = async (userId, search = "", page = 1, limit = 5) => {
  const query = { user: userId };

  if (search && search.trim() !== "") {
    query.orderId = { $regex: search.trim(), $options: "i" };
  }

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

export const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }
  return order;
};

export const cancelOrder = async (orderId, userId, reason = "") => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.PLACED && order.status !== ORDER_STATUS.SHIPPED) {
    throw new Error(`Cannot cancel order in status: ${order.status}`);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelReason = reason;
  order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, updatedAt: new Date() });

  // Restore variant stock ONLY for items that have not been cancelled already
  for (const item of order.items) {
    if (item.status !== "Cancelled") {
      item.status = "Cancelled";
      if (!item.cancelReason) item.cancelReason = reason;
      await Product.updateOne(
        { _id: item.product, "variants.size": item.size },
        { $inc: { "variants.$.stock": item.quantity } }
      );
    }
  }

  await order.save();
  return order;
};
/**
 * Cancel ONE specific item within an order (not the whole order).
 *
 * Only allowed when:
 *  - The order belongs to this user
 *  - The order status is PLACED or SHIPPED
 *  - The specific item is not already cancelled
 *
 * After cancelling the item:
 *  - Stock is restored for that item's variant only
 *  - Order totalPrice/finalPrice is recalculated (excluding cancelled items)
 *  - If this was the LAST active item, the whole order is marked CANCELLED too
 *
 * @param {string} orderId  - MongoDB _id of the order
 * @param {string} userId   - must match order.user (ownership check)
 * @param {string} itemId   - MongoDB _id of the specific item subdocument
 * @param {string} reason   - optional cancellation reason
 */
export const cancelOrderItem = async (orderId, userId, itemId, reason = "") => {
  // Ownership check built into the query, same pattern as cancelOrder
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (
    order.status !== ORDER_STATUS.PLACED &&
    order.status !== ORDER_STATUS.SHIPPED
  ) {
    throw new Error(`Cannot cancel items in an order with status: ${order.status}`);
  }

  // Find the specific item subdocument by its _id
  const item = order.items.id(itemId);
  if (!item) {
    throw new Error("Order item not found.");
  }

  if (item.status === "Cancelled") {
    throw new Error("This item is already cancelled.");
  }

  // Mark just this item as cancelled
  item.status = "Cancelled";
  item.cancelReason = reason;

  // Restore stock for this item's variant only
  const updateQuery = item.variantId
    ? { _id: item.product, "variants._id": item.variantId }
    : { _id: item.product, "variants.size": item.size };

  await Product.updateOne(
    updateQuery,
    { $inc: { "variants.$.stock": item.quantity } }
  );

  // Recalculate totals using only items that are still Active
  const activeItems = order.items.filter((i) => i.status !== "Cancelled");
  const newTotal = activeItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );
  order.totalPrice = newTotal;
  order.finalPrice = newTotal - (order.discount || 0);

  // If NO active items remain, cancel the whole order too
  if (activeItems.length === 0) {
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelReason = reason;
    order.statusHistory.push({
      status: ORDER_STATUS.CANCELLED,
      updatedAt: new Date(),
    });
  }

  await order.save();
  return order;
};

/**
 * Request a return for a delivered order.
 *
 * Only allowed when order status is exactly DELIVERED.
 * Reason is MANDATORY — unlike cancellation, which is optional.
 *
 * NOTE: Stock is NOT restored here. Stock only gets restored once
 * an admin approves the return (the product physically comes back).
 * That approval flow is a separate future step, not part of this function.
 *
 * @param {string} orderId  - MongoDB _id of the order
 * @param {string} userId   - must match order.user (ownership check)
 * @param {string} reason   - REQUIRED, cannot be empty
 */
export const requestReturn = async (orderId, userId, reason) => {
  // Reason is mandatory — check this FIRST, before touching the database
  if (!reason || reason.trim() === "") {
    throw new Error("A reason is required to request a return.");
  }

  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new Error("Only delivered orders can be returned.");
  }

  order.status = ORDER_STATUS.RETURN_REQUESTED;
  order.returnReason = reason.trim();
  order.statusHistory.push({
    status: ORDER_STATUS.RETURN_REQUESTED,
    updatedAt: new Date(),
  });

  await order.save();
  return order;
};

/**
 * generate a pdf invoice for an order and stream it directly to the response.
 
 * @param {Object} order - the order document (already fetched, already ownership-checked)
 * @param {Object} res   - Express response object
 */
export const generateInvoicePDF = (order, res) => {
  const doc = new PDFDocument({ margin: 50 });

  // Tell the browser this is a downloadable PDF file, not a page to display
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.orderId}.pdf`);

  // Pipe the PDF output directly into the response stream
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────
  doc.fontSize(20).text("HeadShield - Invoice", { align: "center" });
  doc.moveDown();

  // ── Order Info ──────────────────────────────────────────
  doc.fontSize(12).text(`Order ID: ${order.orderId}`);
  doc.text(`Order Date: ${new Date(order.createdAt).toDateString()}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  // ── Delivery Address ────────────────────────────────────
  doc.fontSize(14).text("Delivery Address", { underline: true });
  doc.fontSize(12).text(order.deliveryAddress.name);
  doc.text(order.deliveryAddress.street);
  doc.text(`${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}`);
  doc.text(order.deliveryAddress.phone);
  doc.moveDown();

  // ── Items Table (simple version) ────────────────────────
  doc.fontSize(14).text("Items", { underline: true });
  doc.moveDown(0.5);

  order.items.forEach((item) => {
    doc.fontSize(11).text(
      `${item.name} (Size: ${item.size}) x${item.quantity} - Rs.${item.price} each - [${item.status}]`
    );
  });

  doc.moveDown();

  // ── Totals ───────────────────────────────────────────────
  doc.fontSize(12).text(`Total: Rs.${order.totalPrice}`);
  doc.text(`Discount: Rs.${order.discount}`);
  doc.fontSize(14).text(`Final Price: Rs.${order.finalPrice}`, { underline: true });

  // Finalize the PDF — this actually sends it
  doc.end();
};
