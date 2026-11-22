import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";
import * as walletService from "../user/walletService.js";

/**
 * Service to handle Order business logic (Admin)
 */

export const getAdminOrders = async (search = "", status = "", sort = "", page = 1, limit = 10) => {
  const query = {};

  if (status && status.trim() !== "") {
    query.status = status;
  }

  if (search && search.trim() !== "") {
    query.orderId = { $regex: search.trim(), $options: "i" };
  }

  // Sort options — default to newest first if nothing selected
  let sortOption = { createdAt: -1 };
  if (sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (sort === "price-high") {
    sortOption = { finalPrice: -1 };
  } else if (sort === "price-low") {
    sortOption = { finalPrice: 1 }; 
  }

  const skip = (page - 1) * limit;
  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .populate("user", "name email")
    .sort(sortOption)
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

export const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  const oldStatus = order.status;
  if (
    oldStatus === ORDER_STATUS.CANCELLED ||
    oldStatus === ORDER_STATUS.RETURNED ||
    oldStatus === ORDER_STATUS.RETURN_REJECTED
  ) {
    throw new Error(`Cannot change status of a finalized (${oldStatus}) order`);
  }

  order.status = status;
  order.statusHistory.push({ status, updatedAt: new Date() });

  // If order is cancelled, restore variant stock ONLY for active items
  if (status === ORDER_STATUS.CANCELLED) {
    for (const item of order.items) {
      if (item.status !== "Cancelled") {
        item.status = "Cancelled";
        await Product.updateOne(
          { _id: item.product, "variants.size": item.size },
          { $inc: { "variants.$.stock": item.quantity } }
        );
      }
    }
    // Direct refund to wallet on cancellation if order was paid
    if (order.paymentStatus === PAYMENT_STATUS.PAID && !order.walletRefunded) {
      const refundAmount = Math.max(0, order.finalPrice - (order.walletRefundAmount || 0));
      if (refundAmount > 0) {
        await walletService.creditWallet(
          order.user,
          refundAmount,
          `Refund for cancellation of Order #${order.orderId}`,
          order._id,
          order.orderId
        );
        order.walletRefunded = true;
        order.walletRefundAmount = (order.walletRefundAmount || 0) + refundAmount;
      }
    }
  }

  // If order is returned, restore stock if not already restored
  if (status === ORDER_STATUS.RETURNED && !order.returnStockRestored) {
    for (const item of order.items) {
      if (item.status !== "Cancelled") {
        await Product.updateOne(
          { _id: item.product, "variants.size": item.size },
          { $inc: { "variants.$.stock": item.quantity } }
        );
      }
    }
    order.returnStockRestored = true;
  }

  // If order is delivered, set payment status to Paid for COD
  if (status === ORDER_STATUS.DELIVERED && order.paymentMethod === PAYMENT_METHOD.COD) {
    order.paymentStatus = PAYMENT_STATUS.PAID;
  }

  await order.save();
  return order;
};

/**
 * Approve Return: Marks order as Returned and increments variant stock back
 */
export const approveReturn = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new Error(`Cannot approve return for order in status: ${order.status}`);
  }

  order.status = ORDER_STATUS.RETURNED;
  order.statusHistory.push({
    status: ORDER_STATUS.RETURNED,
    updatedAt: new Date()
  });

  // Restore variant stock for all active items
  if (!order.returnStockRestored) {
    for (const item of order.items) {
      if (item.status !== "Cancelled") {
        await Product.updateOne(
          { _id: item.product, "variants.size": item.size },
          { $inc: { "variants.$.stock": item.quantity } }
        );
      }
    }
    order.returnStockRestored = true;
  }

  // Refund to wallet after admin confirmation for returns
  if (order.paymentStatus === PAYMENT_STATUS.PAID && !order.walletRefunded) {
    const refundAmount = Math.max(0, order.finalPrice - (order.walletRefundAmount || 0));
    if (refundAmount > 0) {
      await walletService.creditWallet(
        order.user,
        refundAmount,
        `Refund for approved return of Order #${order.orderId}`,
        order._id,
        order.orderId
      );
      order.walletRefunded = true;
      order.walletRefundAmount = (order.walletRefundAmount || 0) + refundAmount;
    }
  }

  await order.save();
  return order;
};

/**
 * Reject Return: Marks order as Return Rejected (no stock change)
 */
export const rejectReturn = async (orderId, adminReason = "") => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new Error(`Cannot reject return for order in status: ${order.status}`);
  }

  order.status = ORDER_STATUS.RETURN_REJECTED;
  if (adminReason) {
    order.returnRejectReason = adminReason.trim();
  }
  order.statusHistory.push({
    status: ORDER_STATUS.RETURN_REJECTED,
    updatedAt: new Date()
  });

  await order.save();
  return order;
};
