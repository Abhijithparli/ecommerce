import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";


export const getAdminOrders = async (search = "", status = "", sort = "", page = 1, limit = 10) => {
  const query = {};

  if (status && status.trim() !== "") {
    query.status = status;``
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
  if (oldStatus === ORDER_STATUS.CANCELLED || oldStatus === ORDER_STATUS.DELIVERED || oldStatus === ORDER_STATUS.RETURN_APPROVED || oldStatus === ORDER_STATUS.RETURN_REJECTED || oldStatus === ORDER_STATUS.RETURN_REQUESTED) {
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
/**
 * Approve a return request.
 * - Only allowed when order status is RETURN_REQUESTED
 * - Sets status to RETURN_APPROVED
 * - Restores stock for each active item's variant
 * - Uses returnStockRestored flag to prevent duplicate restoration
 */
export const approveReturn = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new Error("Only orders with 'Return Requested' status can be approved for return.");
  }

  // Prevent duplicate stock restoration
  if (order.returnStockRestored) {
    throw new Error("Return has already been processed. Stock was already restored.");
  }

  // Restore stock for each active item
  for (const item of order.items) {
    if (item.status !== "Cancelled") {
      await Product.updateOne(
        { _id: item.product, "variants.size": item.size },
        { $inc: { "variants.$.stock": item.quantity } }
      );
    }
  }

  order.status = ORDER_STATUS.RETURN_APPROVED;
  order.returnStockRestored = true;
  order.statusHistory.push({ status: ORDER_STATUS.RETURN_APPROVED, updatedAt: new Date() });

  await order.save();
  return order;
};

/**
 * Reject a return request.
 * - Only allowed when order status is RETURN_REQUESTED
 * - Sets status to RETURN_REJECTED
 * - Does NOT restore stock
 */
export const rejectReturn = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.RETURN_REQUESTED) {
    throw new Error("Only orders with 'Return Requested' status can be rejected.");
  }

  order.status = ORDER_STATUS.RETURN_REJECTED;
  order.statusHistory.push({ status: ORDER_STATUS.RETURN_REJECTED, updatedAt: new Date() });

  await order.save();
  return order;
};

////
export const getOrderStatusCounts = async()=>{
  const statusCounts = await Order.aggregate([
    {
    $group:{
    _id:"$status",
    count:{$sum:1}
    }
  }
  ]);
  console.log("order status count:",statusCounts);
  return statusCounts;
}

