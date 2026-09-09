import * as cartService from "../../services/user/cartService.js";
import * as checkoutService from "../../services/user/checkoutService.js";
import { MESSAGES } from "../../constants/messages.js";

// ADD TO CART
export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const size = (req.body.size || "M").toUpperCase();
    const quantity = parseInt(req.body.quantity) || 1;

    await cartService.addToCart({ userId, productId, size, quantity });

    res.json({
      success: true,
      message: MESSAGES.CART.ADDED,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
  }
};

// LOAD CART PAGE
export const loadCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { cart, total } = await cartService.getUserCart(userId);

    res.render("user/cart", {
      cart,
      total,
    });
  } catch (error) {
    console.error("Load cart error:", error);
    res.redirect("/");
  }
};

// UPDATE CART QUANTITY
export const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { productId, action } = req.body;
    const size = (req.body.size || "M").toUpperCase();

    const result = await cartService.updateCartQuantity({
      userId,
      productId,
      size,
      action,
    });

    res.json({
      success: true,
      quantity: result.quantity,
      subtotal: result.subtotal,
      grandTotal: result.grandTotal,
    });
  } catch (error) {
    console.error("Update cart quantity error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
  }
};

// REMOVE CART ITEM
export const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.productId;
    const size = (req.query.size || "M").toUpperCase();

    const result = await cartService.removeCartItem({
      userId,
      productId,
      size,
    });

    res.json({
      success: true,
      message: MESSAGES.CART.ITEM_REMOVED,
      grandTotal: result.grandTotal,
      cartEmpty: result.cartEmpty,
    });
  } catch (error) {
    console.error("Remove cart item error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
  }
};

// LOAD CHECKOUT PAGE
export const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const data = await checkoutService.getCheckoutData(userId);

    res.render("user/checkout", {
      cart: data.cart,
      addresses: data.addresses,
      total: data.total,
    });
  } catch (error) {
    console.error("Load checkout error:", error);
    res.redirect("/cart");
  }
};
