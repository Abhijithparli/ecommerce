import Coupon from "../../models/couponModel.js";

/**
 * Service to handle User Coupon validation and discount calculations
 */

export const validateAndCalculateDiscount = async (userId, couponCode, subtotal) => {
  if (!couponCode || !couponCode.trim()) {
    throw new Error("Please enter a coupon code.");
  }

  const normalizedCode = couponCode.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: normalizedCode });

  if (!coupon) {
    throw new Error("Invalid coupon code.");
  }

  if (!coupon.isActive) {
    throw new Error("This coupon is currently inactive.");
  }

  if (new Date() > new Date(coupon.expiryDate)) {
    throw new Error("This coupon has expired.");
  }

  if (coupon.minPurchase > 0 && subtotal < coupon.minPurchase) {
    throw new Error(
      `Minimum purchase amount of ₹${coupon.minPurchase} required to use this coupon.`
    );
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new Error("This coupon usage limit has been reached.");
  }

  // Check if user already used this coupon (enforces 1 use per customer)
  const alreadyUsed = coupon.usersUsed.some(
    (u) => u.user && u.user.toString() === userId.toString()
  );
  if (alreadyUsed) {
    throw new Error("You have already used this coupon.");
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.discountValue, subtotal);
  }

  const finalPrice = Math.max(0, subtotal - discount);

  return {
    coupon,
    couponCode: coupon.code,
    discount,
    finalPrice,
  };
};

export const getAvailableCoupons = async (userId, subtotal = 0) => {
  const coupons = await Coupon.find({
    isActive: true,
    expiryDate: { $gt: new Date() },
  }).sort({ discountValue: -1 });

  return coupons
    .filter((c) => {
      // Exclude if global usage limit reached
      if (c.usageLimit && c.usedCount >= c.usageLimit) return false;
      // Exclude if this user already used it
      const userUsed = c.usersUsed.some(
        (u) => u.user && u.user.toString() === userId.toString()
      );
      return !userUsed;
    })
    .map((c) => ({
      _id: c._id,
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minPurchase: c.minPurchase,
      maxDiscount: c.maxDiscount,
      expiryDate: c.expiryDate,
      isEligible: subtotal >= c.minPurchase,
      neededAmount: Math.max(0, c.minPurchase - subtotal),
    }));
};

export const recordCouponUsage = async (userId, couponCode) => {
  if (!couponCode) return;
  const normalizedCode = couponCode.trim().toUpperCase();

  await Coupon.updateOne(
    { code: normalizedCode },
    {
      $inc: { usedCount: 1 },
      $push: { usersUsed: { user: userId, usedAt: new Date() } },
    }
  );
};
