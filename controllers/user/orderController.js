import * as orderService from "../../services/user/orderService.js";
import { PAYMENT_METHOD } from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { addressId, paymentMethod } = req.body;

    if (paymentMethod !== PAYMENT_METHOD.COD) {
      return res.status(400).json({
        success: false,
        message: "Only Cash on Delivery (COD) is supported at this time."
      });
    }

    const order = await orderService.createOrder({
      userId,
      addressId,
      paymentMethod
    });

    res.json({
      success: true,
      message: MESSAGES.ORDER.PLACED,
      orderId: order._id
    });
  } catch (error) {
    console.error("Place order error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to place order."
    });
  }
};

export const loadOrderSuccess = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId);
    if (!order || order.user._id.toString() !== req.session.user.id.toString()) {
      return res.redirect("/");
    }
    res.render("user/orderSuccess", { order });
  } catch (error) {
    console.error("Load order success error:", error);
    res.redirect("/");
  }
};

export const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const data = await orderService.getUserOrders(userId, search, page, limit);
    res.render("user/orderList", {
      orders: data.orders,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      search: search,
      user: req.session.user
    });
  } catch (error) {
    console.error("Load orders error:", error);
    res.redirect("/profile");
  }
};

export const loadOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (order.user._id.toString() !== req.session.user.id) {
      return res.redirect("/profile/orders");
    }
    res.render("user/orderDetails", { order, user: req.session.user });
  } catch (error) {
    console.error("Load order detail error:", error);
    res.redirect("/profile/orders");
  }
};

export const cancelOrderAction = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    const { reason } = req.body || {};

    await orderService.cancelOrder(orderId, userId, reason || "");

    res.json({
      success: true,
      message: MESSAGES.ORDER.CANCELLED
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel order."
    });
  }
};

/**
 * Controller: Cancel a specific item within an order
 * (POST /profile/orders/:orderId/items/:itemId/cancel)
 */
export const cancelOrderItemAction = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    await orderService.cancelOrderItem(orderId, userId, itemId, reason);

    res.json({
      success: true,
      message: "Item cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel order item error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel item.",
    });
  }
};

// request a return for a delivered order 
export const returnOrderAction = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const orderId = req.params.id;
    const { reason } = req.body;

    await orderService.requestReturn(orderId, userId, reason);

    res.json({
      success: true,
      message: "Return requested successfully.",
    });
  } catch (error) {
    console.error("Return order error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to request return.",
    });
  }
};

//download invoice pdf form an order 
export const downloadInvoice = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);

    // Ownership check — same pattern as loadOrderDetail
    if (order.user._id.toString() !== req.session.user.id.toString()) {
      return res.redirect("/profile/orders");
    }

    orderService.generateInvoicePDF(order, res);
  } catch (error) {
    console.error("Download invoice error:", error.message);
    res.redirect("/profile/orders");
  }
};
