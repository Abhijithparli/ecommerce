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
    res.render("user/orderSuccess", { order });
  } catch (error) {
    console.error("Load order success error:", error);
    res.redirect("/");
  }
};

export const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const data = await orderService.getUserOrders(userId, page, limit);
    res.render("user/orderList", {
      orders: data.orders,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
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

    await orderService.cancelOrder(orderId, userId);

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

