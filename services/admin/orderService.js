import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Order business logic (Admin)
 */

export const getAdminOrders = async (search = "", status = "", page = 1, limit = 10) => {
  const query = {};

  if (status && status.trim() !== "") {
    query.status = status;
  }

  if (search && search.trim() !== "") {
    query.orderId = { $regex: search.trim(), $options: "i" };
  }

  const skip = (page - 1) * limit;
  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .populate("user", "name email")
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

export const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  const oldStatus = order.status;
  if (oldStatus === ORDER_STATUS.CANCELLED || oldStatus === ORDER_STATUS.DELIVERED) {
    throw new Error(`Cannot change status of a ${oldStatus} order`);
  }

  order.status = status;
  order.statusHistory.push({ status, updatedAt: new Date() });

  // If order is cancelled, restore variant stock
  if (status === ORDER_STATUS.CANCELLED) {
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product, "variants.size": item.size },
        { $inc: { "variants.$.stock": item.quantity } }
      );
    }
  }

  // If order is delivered, set payment status to Paid for COD
  if (status === ORDER_STATUS.DELIVERED && order.paymentMethod === PAYMENT_METHOD.COD) {
    order.paymentStatus = PAYMENT_STATUS.PAID;
  }

  await order.save();
  return order;
};
