import * as couponService from "../../services/user/couponService.js";
import * as checkoutService from "../../services/user/checkoutService.js";

/**
 * Controller to handle Checkout Coupon application and removal
 */

export const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { couponCode } = req.body;

    if (!couponCode || !couponCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter a coupon code.",
      });
    }

    // Prevent multiple coupon applications (strictly one coupon per checkout)
    if (req.session.appliedCoupon && req.session.appliedCoupon.code) {
      return res.status(400).json({
        success: false,
        message: `Coupon "${req.session.appliedCoupon.code}" is already applied. Only one coupon can be applied per order. Please remove the existing coupon first.`,
      });
    }

    // 1. Get user cart and verified subtotal from server
    const { total } = await checkoutService.getCheckoutData(userId);

    if (total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    // 2. Validate and calculate discount
    const result = await couponService.validateAndCalculateDiscount(
      userId,
      couponCode,
      total
    );

    // 3. Save applied coupon in session
    req.session.appliedCoupon = {
      code: result.couponCode,
      discount: result.discount,
    };

    return res.json({
      success: true,
      message: `Coupon ${result.couponCode} applied successfully!`,
      couponCode: result.couponCode,
      discount: result.discount,
      subtotal: total,
      finalPrice: result.finalPrice,
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to apply coupon.",
    });
  }
};

export const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user.id;
    delete req.session.appliedCoupon;

    const { total } = await checkoutService.getCheckoutData(userId);

    return res.json({
      success: true,
      message: "Coupon removed successfully.",
      subtotal: total,
      finalPrice: total,
      discount: 0,
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to remove coupon.",
    });
  }
};

export const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { total } = await checkoutService.getCheckoutData(userId);
    const coupons = await couponService.getAvailableCoupons(userId, total);

    return res.json({
      success: true,
      coupons,
      subtotal: total,
    });
  } catch (error) {
    console.error("Get available coupons error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch available coupons.",
    });
  }
};
