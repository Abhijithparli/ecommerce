import Coupon from "../../models/couponModel.js";

/**
 * Service to handle Admin Coupon CRUD operations
 */

export const getCoupons = async (search = "", page = 1, limit = 10) => {
  const query = {};
  if (search && search.trim() !== "") {
    query.code = { $regex: search.trim(), $options: "i" };
  }

  const skip = (page - 1) * limit;
  const totalCoupons = await Coupon.countDocuments(query);
  const totalPages = Math.ceil(totalCoupons / limit);

  const coupons = await Coupon.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    coupons,
    currentPage: page,
    totalPages,
    totalCoupons,
    search,
  };
};

export const getCouponById = async (id) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new Error("Coupon not found.");
  }
  return coupon;
};

export const createCoupon = async (data) => {
  const {
    code,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    expiryDate,
    usageLimit,
  } = data;

  if (!code || !code.trim()) {
    throw new Error("Coupon code is required.");
  }

  const normalizedCode = code.trim().toUpperCase();
  const existing = await Coupon.findOne({ code: normalizedCode });
  if (existing) {
    throw new Error("A coupon with this code already exists.");
  }

  const val = Number(discountValue);
  if (isNaN(val) || val <= 0) {
    throw new Error("Discount value must be greater than zero.");
  }

  if (discountType === "percentage" && val > 100) {
    throw new Error("Percentage discount cannot exceed 100%.");
  }

  if (!expiryDate || new Date(expiryDate) <= new Date()) {
    throw new Error("Expiry date must be in the future.");
  }

  const coupon = new Coupon({
    code: normalizedCode,
    discountType: discountType || "percentage",
    discountValue: val,
    minPurchase: minPurchase ? Math.max(0, Number(minPurchase)) : 0,
    maxDiscount: discountType === "percentage" && maxDiscount ? Number(maxDiscount) : null,
    expiryDate: new Date(expiryDate),
    usageLimit: usageLimit ? Number(usageLimit) : null,
    isActive: true,
  });

  await coupon.save();
  return coupon;
};

export const updateCoupon = async (id, data) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new Error("Coupon not found.");
  }

  const {
    code,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    expiryDate,
    usageLimit,
  } = data;

  if (code && code.trim().toUpperCase() !== coupon.code) {
    const existing = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) {
      throw new Error("A coupon with this code already exists.");
    }
    coupon.code = code.trim().toUpperCase();
  }

  if (discountValue !== undefined) {
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      throw new Error("Discount value must be greater than zero.");
    }
    if ((discountType || coupon.discountType) === "percentage" && val > 100) {
      throw new Error("Percentage discount cannot exceed 100%.");
    }
    coupon.discountValue = val;
  }

  if (discountType) {
    coupon.discountType = discountType;
  }

  if (minPurchase !== undefined) {
    coupon.minPurchase = Math.max(0, Number(minPurchase) || 0);
  }

  if (coupon.discountType === "percentage") {
    coupon.maxDiscount = maxDiscount ? Number(maxDiscount) : null;
  } else {
    coupon.maxDiscount = null;
  }

  if (expiryDate) {
    if (new Date(expiryDate) <= new Date()) {
      throw new Error("Expiry date must be in the future.");
    }
    coupon.expiryDate = new Date(expiryDate);
  }

  if (usageLimit !== undefined) {
    coupon.usageLimit = usageLimit ? Number(usageLimit) : null;
  }

  await coupon.save();
  return coupon;
};

export const toggleCouponStatus = async (id) => {
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new Error("Coupon not found.");
  }
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  return coupon;
};

export const deleteCoupon = async (id) => {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) {
    throw new Error("Coupon not found.");
  }
  return coupon;
};
