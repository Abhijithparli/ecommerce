import * as cartService from "../../services/user/cartService.js";
import * as checkoutService from "../../services/user/checkoutService.js";
import { MESSAGES } from "../../constants/messages.js";

// ADD TO CART
export const addToCart = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to add items to your cart",
        redirectTo: "/login"
      });
    }

    const productId = req.params.productId;
    const { variantId, size, quantity } = req.body;

    await cartService.addToCart({
      userId,
      productId,
      variantId,
      size,
      quantity,
    });

    res.json({
      success: true,
      message: MESSAGES.CART.ADDED,
    });
  } catch (error) {
    console.error("Add to cart error:", error.message);
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
  }
};

// LOAD CART PAGE
export const loadCart = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const cartData = await cartService.getUserCart(userId);

    res.render("user/cart", {
      cart: cartData.cart,
      items: cartData.items,
      total: cartData.total,
      validTotal: cartData.validTotal,
      hasUnavailableItems: cartData.hasUnavailableItems,
      maxQuantity: cartData.maxQuantity,
      user: req.session.user,
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
    const { itemId, productId, size, action } = req.body;

    const result = await cartService.updateCartQuantity({
      userId,
      itemId,
      productId,
      size,
      action,
    });

    res.json(result);
  } catch (error) {
    console.error("Update cart quantity error:", error.message);
    res.status(error.statusCode || 400).json({
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
    const itemId = req.params.itemId || req.body.itemId || req.query.itemId;
    const size = req.query.size || req.body.size;

    const result = await cartService.removeCartItem({
      userId,
      itemId,
      productId,
      size,
    });

    res.json(result);
  } catch (error) {
    console.error("Remove cart item error:", error.message);
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
  }
};

// LOAD CHECKOUT PAGE (Preserved for upcoming checkout milestone)
export const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Check for unavailable items before allowing checkout
    await cartService.validateCartForCheckout(userId);

    const data = await checkoutService.getCheckoutData(userId);

    res.render("user/checkout", {
      cart: data.cart,
      addresses: data.addresses,
      total: data.total,
    });
  } catch (error) {
    console.error("Load checkout error:", error.message);
    req.session.error = error.message;
    res.redirect("/cart");
  }
};
