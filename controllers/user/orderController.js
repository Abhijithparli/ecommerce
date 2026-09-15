import * as orderService from "../../services/user/orderService.js";
import { PAYMENT_METHOD } from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Controller: Place a new order (POST /checkout/place-order)
 *
 * Responsibilities:
 *  - Extract userId, addressId, paymentMethod from request
 *  - Validate paymentMethod is COD (only supported method)
 *  - Call orderService.createOrder (all business logic lives there)
 *  - Return JSON with success flag + order._id (for redirect to success page)
 *  - On failure: return JSON error (SweetAlert2 on frontend reads this)
 */
export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { addressId, paymentMethod } = req.body;

    // Frontend validation: also validated here on backend
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: MESSAGES.CHECKOUT.ADDRESS_REQUIRED,
      });
    }

    // Only COD is supported currently
    if (paymentMethod !== PAYMENT_METHOD.COD) {
      return res.status(400).json({
        success: false,
        message: "Only Cash on Delivery (COD) is supported at this time.",
      });
    }

    const order = await orderService.createOrder({
      userId,
      addressId,
      paymentMethod,
    });

    res.json({
      success: true,
      message: MESSAGES.ORDER.PLACED,
      orderId: order._id,   // MongoDB _id used in success page URL
    });
  } catch (error) {
    console.error("Place order error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || MESSAGES.CHECKOUT.ORDER_FAILED,
    });
  }
};

/**
 * Controller: Load Order Success page (GET /checkout/order-success/:orderId)
 *
 * SECURITY: Verify the logged-in user owns this order.
 * Without this check, User A could view User B's order by changing the URL.
 *
 * @param req.params.orderId  - MongoDB _id of the order (not the human-readable orderId)
 */
export const loadOrderSuccess = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId);

    // ── Ownership check ──────────────────────────────────────────────────────
    // order.user is populated as an object { _id, name, email }
    // req.session.user.id is a string
    // We use toString() on both to safely compare ObjectIds
    if (order.user._id.toString() !== req.session.user.id.toString()) {
      // Do NOT give a 403 — just silently redirect to avoid leaking information
      return res.redirect("/profile/orders");
    }

    res.render("user/orderSuccess", {
      order,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Load order success error:", error.message);
    res.redirect("/profile/orders");
  }
};

/**
 * Controller: Load Orders list (GET /profile/orders)
 */
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
      user: req.session.user,
    });
  } catch (error) {
    console.error("Load orders error:", error.message);
    res.redirect("/profile");
  }
};

/**
 * Controller: Load a single Order Detail (GET /profile/orders/:id)
 *
 * SECURITY: Ownership check — order.user must match session user.
 */
export const loadOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);

    // Ownership check
    if (order.user._id.toString() !== req.session.user.id.toString()) {
      return res.redirect("/profile/orders");
    }

    res.render("user/orderDetails", { order, user: req.session.user });
  } catch (error) {
    console.error("Load order detail error:", error.message);
    res.redirect("/profile/orders");
  }
};

/**
 * Controller: Cancel an order (POST /profile/orders/:id/cancel)
 *
 * Returns JSON (called via fetch from the frontend SweetAlert2 confirmation).
 */
export const cancelOrderAction = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const orderId = req.params.id;

    await orderService.cancelOrder(orderId, userId);

    res.json({
      success: true,
      message: MESSAGES.ORDER.CANCELLED,
    });
  } catch (error) {
    console.error("Cancel order error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to cancel order.",
    });
  }
};
