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
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${order.orderId}.pdf`);
  doc.pipe(res);

  const primaryColor = "#f97316";
  const darkColor = "#1f2937";
  const grayColor = "#6b7280";
  const lightGray = "#e5e7eb";

  // ── Header band ──────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(26).text("HEADSHIELD", 50, 32);
  doc.font("Helvetica").fontSize(10).text("Premium Motorcycle Helmets", 50, 64);
  doc.font("Helvetica-Bold").fontSize(20).text("INVOICE", 350, 32, { width: 195, align: "right" });
  doc.font("Helvetica").fontSize(10).text(`#${order.orderId}`, 350, 58, { width: 195, align: "right" });

  // ── Bill To / Order Info (two columns) ──────────────────
  let y = 130;
  doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(11);
  doc.text("BILL TO", 50, y);
  doc.text("ORDER INFO", 320, y);

  y += 18;
  doc.font("Helvetica").fontSize(10).fillColor(grayColor);
  doc.text(order.deliveryAddress.name, 50, y);
  doc.text(`Date: ${new Date(order.createdAt).toDateString()}`, 320, y);

  y += 15;
  doc.text(order.deliveryAddress.street, 50, y);
  doc.text(`Status: ${order.status}`, 320, y);

  y += 15;
  doc.text(`${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}`, 50, y);
  doc.text(`Payment: ${order.paymentMethod} (${order.paymentStatus})`, 320, y);

  y += 15;
  doc.text(`Phone: ${order.deliveryAddress.phone}`, 50, y);

  y += 35;

  // ── Items table header ───────────────────────────────────
  const tableTop = y;
  doc.rect(50, tableTop, 495, 25).fill("#f3f4f6");
  doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(10);
  doc.text("ITEM", 60, tableTop + 8);
  doc.text("SIZE", 300, tableTop + 8);
  doc.text("QTY", 350, tableTop + 8);
  doc.text("PRICE", 400, tableTop + 8);
  doc.text("TOTAL", 470, tableTop + 8, { width: 65, align: "right" });

  y = tableTop + 25;
  doc.font("Helvetica").fontSize(10);

  order.items.forEach((item, i) => {
    const rowY = y;
    if (i % 2 === 1) {
      doc.rect(50, rowY, 495, 22).fill("#fafafa");
    }
    const rowColor = item.status === "Cancelled" ? "#ef4444" : darkColor;
    doc.fillColor(rowColor);
    doc.text(item.name, 60, rowY + 6, { width: 230 });
    doc.text(item.size, 300, rowY + 6);
    doc.text(String(item.quantity), 350, rowY + 6);
    doc.text(`Rs.${item.price}`, 400, rowY + 6);
    doc.text(`Rs.${item.price * item.quantity}`, 470, rowY + 6, { width: 65, align: "right" });

    y += 22;
    if (item.status === "Cancelled") {
      doc.fontSize(8).fillColor("#ef4444").text("(Cancelled)", 60, y - 4);
      doc.fontSize(10);
    }
  });

  doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor(lightGray).stroke();
  y += 25;

  // ── Totals (right-aligned) ────────────────────────────────
  doc.fillColor(grayColor).fontSize(10);
  doc.text("Subtotal", 400, y, { width: 70 });
  doc.fillColor(darkColor).text(`Rs.${order.totalPrice}`, 470, y, { width: 65, align: "right" });
  y += 18;

  if (order.discount > 0) {
    doc.fillColor(grayColor).text("Discount", 400, y, { width: 70 });
    doc.fillColor("#ef4444").text(`- Rs.${order.discount}`, 470, y, { width: 65, align: "right" });
    y += 18;
  }

  doc.moveTo(400, y).lineTo(545, y).strokeColor(lightGray).stroke();
  y += 10;

  doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(13);
  doc.text("Grand Total", 400, y, { width: 70 });
  doc.fillColor(primaryColor).text(`Rs.${order.finalPrice}`, 470, y, { width: 65, align: "right" });

  // ── Footer ────────────────────────────────────────────────
  y += 60;
  doc.font("Helvetica").fontSize(9).fillColor(grayColor);
  doc.text("Thank you for shopping with HeadShield!", 50, y, { align: "center", width: 495 });
  doc.text("This is a computer-generated invoice and does not require a signature.", 50, y + 14, { align: "center", width: 495 });

  doc.end();
 };
