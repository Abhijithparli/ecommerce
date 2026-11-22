import Offer from "../../models/offerModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

/**
 * Service to handle Admin Offer operations
 */

export const getOffers = async (search = "", type = "", page = 1, limit = 10) => {
  const query = {};

  if (search && search.trim() !== "") {
    query.name = { $regex: search.trim(), $options: "i" };
  }

  if (type && type !== "all") {
    query.offerType = type;
  }

  const skip = (page - 1) * limit;
  const totalOffers = await Offer.countDocuments(query);
  const totalPages = Math.ceil(totalOffers / limit);

  const offers = await Offer.find(query)
    .populate("product", "name brand images")
    .populate("category", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    offers,
    currentPage: page,
    totalPages,
    totalOffers,
    search,
    type,
  };
};

export const getOfferById = async (id) => {
  const offer = await Offer.findById(id)
    .populate("product", "name")
    .populate("category", "name");
  if (!offer) {
    throw new Error("Offer not found.");
  }
  return offer;
};

export const getActiveOfferOptions = async () => {
  const products = await Product.find({ isDeleted: false, isBlocked: false })
    .select("name brand regularPrice")
    .sort({ name: 1 });
  const categories = await Category.find({ isDeleted: false })
    .select("name")
    .sort({ name: 1 });
  return { products, categories };
};

export const createOffer = async (data) => {
  const {
    name,
    offerType,
    discountType,
    discountValue,
    product,
    category,
    referralReward,
    refereeReward,
    startDate,
    endDate,
  } = data;

  if (!name || !name.trim()) {
    throw new Error("Offer name is required.");
  }

  if (!["product", "category", "referral"].includes(offerType)) {
    throw new Error("Invalid offer type.");
  }

  if (!endDate) {
    throw new Error("End date is required.");
  }

  const start = startDate ? new Date(startDate) : new Date();
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error("End date must be after the start date.");
  }

  const offerData = {
    name: name.trim(),
    offerType,
    startDate: start,
    endDate: end,
    isActive: true,
  };

  if (offerType === "product") {
    if (!product) throw new Error("Please select a product for the product offer.");
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) throw new Error("Discount value must be greater than zero.");
    if (discountType === "percentage" && val > 90) {
      throw new Error("Percentage discount cannot exceed 90%.");
    }
    offerData.product = product;
    offerData.discountType = discountType || "percentage";
    offerData.discountValue = val;
  } else if (offerType === "category") {
    if (!category) throw new Error("Please select a category for the category offer.");
    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) throw new Error("Discount value must be greater than zero.");
    if (discountType === "percentage" && val > 90) {
      throw new Error("Percentage discount cannot exceed 90%.");
    }
    offerData.category = category;
    offerData.discountType = discountType || "percentage";
    offerData.discountValue = val;
  } else if (offerType === "referral") {
    const refReward = Number(referralReward);
    const refeeReward = Number(refereeReward);
    if (isNaN(refReward) || refReward < 0 || isNaN(refeeReward) || refeeReward < 0) {
      throw new Error("Referral rewards must be valid non-negative numbers.");
    }
    offerData.referralReward = refReward;
    offerData.refereeReward = refeeReward;
  }

  const offer = new Offer(offerData);
  await offer.save();
  return offer;
};

export const updateOffer = async (id, data) => {
  const offer = await Offer.findById(id);
  if (!offer) {
    throw new Error("Offer not found.");
  }

  const {
    name,
    offerType,
    discountType,
    discountValue,
    product,
    category,
    referralReward,
    refereeReward,
    startDate,
    endDate,
  } = data;

  if (name && name.trim()) offer.name = name.trim();
  if (offerType) offer.offerType = offerType;

  if (startDate) offer.startDate = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    if (offer.startDate && end <= offer.startDate) {
      throw new Error("End date must be after the start date.");
    }
    offer.endDate = end;
  }

  if (offer.offerType === "product") {
    if (product) offer.product = product;
    if (discountValue !== undefined) {
      const val = Number(discountValue);
      if (isNaN(val) || val <= 0) throw new Error("Discount value must be greater than zero.");
      if (discountType === "percentage" && val > 90) throw new Error("Percentage discount cannot exceed 90%.");
      offer.discountValue = val;
    }
    if (discountType) offer.discountType = discountType;
    offer.category = null;
  } else if (offer.offerType === "category") {
    if (category) offer.category = category;
    if (discountValue !== undefined) {
      const val = Number(discountValue);
      if (isNaN(val) || val <= 0) throw new Error("Discount value must be greater than zero.");
      if (discountType === "percentage" && val > 90) throw new Error("Percentage discount cannot exceed 90%.");
      offer.discountValue = val;
    }
    if (discountType) offer.discountType = discountType;
    offer.product = null;
  } else if (offer.offerType === "referral") {
    if (referralReward !== undefined) offer.referralReward = Number(referralReward);
    if (refereeReward !== undefined) offer.refereeReward = Number(refereeReward);
  }

  await offer.save();
  return offer;
};

export const toggleOfferStatus = async (id) => {
  const offer = await Offer.findById(id);
  if (!offer) {
    throw new Error("Offer not found.");
  }
  offer.isActive = !offer.isActive;
  await offer.save();
  return offer;
};

export const deleteOffer = async (id) => {
  const offer = await Offer.findById(id);
  if (!offer) {
    throw new Error("Offer not found.");
  }
  await Offer.findByIdAndDelete(id);
  return true;
};
