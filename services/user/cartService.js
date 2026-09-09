import Cart from "../../models/cartModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import { MESSAGES } from "../../constants/messages.js";
import { CART_CONSTANTS } from "../../constants/enums.js";

/**
 * Service to handle Cart business logic (User)
 */

export const addToCart = async ({ userId, productId, variantId, size = "M", quantity = 1 }) => {
  const qty = parseInt(quantity) || 1;
  if (qty < CART_CONSTANTS.MIN_QUANTITY_PER_ITEM) {
    const error = new Error("Invalid quantity specified");
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify Product exists, not deleted, and not blocked
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  });

  if (!product || product.isBlocked) {
    const error = new Error(MESSAGES.CART.PRODUCT_UNAVAILABLE);
    error.statusCode = 400;
    throw error;
  }

  // 2. Identify and Validate exact Variant
  let variant = null;
  const normalizedSize = size.trim().toUpperCase();

  if (variantId && product.variants && product.variants.length > 0) {
    variant = product.variants.find(
      (v) => v._id.toString() === variantId.toString()
    );
  }

  if (!variant && product.variants && product.variants.length > 0) {
    variant = product.variants.find(
      (v) => v.size.toUpperCase() === normalizedSize
    );
  }

  if (!variant) {
    const error = new Error(`Size ${normalizedSize} variant is not available for this product`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Stock & Quantity Validation
  if (variant.stock <= 0) {
    const error = new Error(`Size ${variant.size} is currently out of stock`);
    error.statusCode = 400;
    throw error;
  }

  const effectiveMax = Math.min(CART_CONSTANTS.MAX_QUANTITY_PER_ITEM, variant.stock);

  if (qty > effectiveMax) {
    const errorMsg = variant.stock < CART_CONSTANTS.MAX_QUANTITY_PER_ITEM
      ? `Only ${variant.stock} item(s) available in stock for Size ${variant.size}`
      : `Maximum quantity limit is ${CART_CONSTANTS.MAX_QUANTITY_PER_ITEM} units per item`;
    const error = new Error(errorMsg);
    error.statusCode = 400;
    throw error;
  }

  // 4. Find or Create User Cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({
      user: userId,
      items: [],
    });
  }

  // 5. Search for existing Cart Item with SAME product AND SAME variant
  const existingItem = cart.items.find((item) => {
    const isSameProduct = item.product.toString() === product._id.toString();
    const isSameVariant = item.variantId
      ? item.variantId.toString() === variant._id.toString()
      : item.size.toUpperCase() === variant.size.toUpperCase();
    return isSameProduct && isSameVariant;
  });

  if (existingItem) {
    const newQty = existingItem.quantity + qty;
    if (newQty > effectiveMax) {
      const errorMsg = existingItem.quantity >= effectiveMax
        ? (effectiveMax === CART_CONSTANTS.MAX_QUANTITY_PER_ITEM
            ? `You already have the maximum limit of ${CART_CONSTANTS.MAX_QUANTITY_PER_ITEM} units in your cart`
            : `Cannot add more. Available stock for Size ${variant.size} is ${variant.stock}`)
        : `Cannot add ${qty} more. You have ${existingItem.quantity} in cart and maximum limit is ${effectiveMax}`;
      const error = new Error(errorMsg);
      error.statusCode = 400;
      throw error;
    }

    const effectivePrice = (variant && typeof variant.price === 'number' && !isNaN(variant.price) && variant.price > 0)
      ? variant.price
      : (product.salePrice || product.regularPrice || 0);

    existingItem.quantity = newQty;
    existingItem.price = effectivePrice;
    existingItem.variantId = variant._id;
    existingItem.size = variant.size;
  } else {
    const effectivePrice = (variant && typeof variant.price === 'number' && !isNaN(variant.price) && variant.price > 0)
      ? variant.price
      : (product.salePrice || product.regularPrice || 0);

    // Add distinct variant as a separate Cart Item
    cart.items.push({
      product: product._id,
      variantId: variant._id,
      size: variant.size,
      quantity: qty,
      price: effectivePrice,
    });
  }

  await cart.save();

  // 6. Wishlist Integration: Remove from wishlist if exists
  try {
    const user = await User.findById(userId);
    if (user && Array.isArray(user.wishlist) && user.wishlist.includes(product._id)) {
      user.wishlist = user.wishlist.filter(
        (pId) => pId.toString() !== product._id.toString()
      );
      await user.save();
    }
  } catch (wishlistErr) {
    console.warn("Wishlist cleanup warning:", wishlistErr.message);
  }

  return cart;
};

export const getUserCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");

  if (!cart) {
    return {
      cart: null,
      items: [],
      total: 0,
      validTotal: 0,
      hasUnavailableItems: false,
      maxQuantity: CART_CONSTANTS.MAX_QUANTITY_PER_ITEM,
    };
  }

  let total = 0;
  let validTotal = 0;
  let hasUnavailableItems = false;

  const processedItems = cart.items.map((item) => {
    const itemObj = item.toObject ? item.toObject() : item;
    const product = item.product;

    // Check if product is unavailable, deleted or blocked
    if (!product || product.isDeleted || product.isBlocked) {
      itemObj.isUnavailable = true;
      itemObj.unavailableReason = "Product is unavailable";
      itemObj.unitPrice = item.price || 0;
      itemObj.itemTotal = (item.price || 0) * item.quantity;
      hasUnavailableItems = true;
      return itemObj;
    }

    // Match exact variant
    let variant = null;
    if (item.variantId && product.variants && product.variants.length > 0) {
      variant = product.variants.find(
        (v) => v._id.toString() === item.variantId.toString()
      );
    }
    if (!variant && product.variants && product.variants.length > 0) {
      variant = product.variants.find(
        (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
      );
    }

    if (!variant) {
      itemObj.isUnavailable = true;
      itemObj.unavailableReason = "Selected size variant is no longer available";
      itemObj.unitPrice = item.price || product.salePrice || product.regularPrice || 0;
      itemObj.itemTotal = itemObj.unitPrice * item.quantity;
      hasUnavailableItems = true;
      return itemObj;
    }

    const effectivePrice = (variant && typeof variant.price === 'number' && !isNaN(variant.price) && variant.price > 0)
      ? variant.price
      : (item.price || product.salePrice || product.regularPrice || 0);

    itemObj.variant = variant;
    itemObj.unitPrice = effectivePrice;
    itemObj.itemTotal = effectivePrice * item.quantity;
    itemObj.availableStock = variant.stock;

    if (variant.stock <= 0) {
      itemObj.isOutOfStock = true;
      itemObj.isUnavailable = true;
      itemObj.unavailableReason = "Out of stock";
      hasUnavailableItems = true;
    } else if (item.quantity > variant.stock) {
      itemObj.exceedsStock = true;
      itemObj.unavailableReason = `Only ${variant.stock} item(s) left in stock`;
      hasUnavailableItems = true;
    } else {
      itemObj.isAvailable = true;
      validTotal += itemObj.itemTotal;
    }

    total += itemObj.itemTotal;
    return itemObj;
  });

  return {
    cart,
    items: processedItems,
    total,
    validTotal,
    hasUnavailableItems,
    maxQuantity: CART_CONSTANTS.MAX_QUANTITY_PER_ITEM,
  };
};

export const updateCartQuantity = async ({ userId, itemId, productId, size, action }) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    const error = new Error(MESSAGES.CART.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  // Find item by ID or product + size
  let item = null;
  if (itemId) {
    item = cart.items.id(itemId) || cart.items.find((i) => i._id.toString() === itemId.toString());
  }
  if (!item && productId) {
    const normalizedSize = (size || "M").toUpperCase();
    item = cart.items.find(
      (i) =>
        i.product.toString() === productId.toString() &&
        i.size.toUpperCase() === normalizedSize
    );
  }

  if (!item) {
    const error = new Error("Item not found in cart");
    error.statusCode = 404;
    throw error;
  }

  const product = await Product.findOne({
    _id: item.product,
    isDeleted: false,
    isBlocked: false,
  });

  if (!product) {
    const error = new Error(MESSAGES.CART.PRODUCT_UNAVAILABLE);
    error.statusCode = 400;
    throw error;
  }

  let variant = null;
  if (item.variantId && product.variants) {
    variant = product.variants.find((v) => v._id.toString() === item.variantId.toString());
  }
  if (!variant && product.variants) {
    variant = product.variants.find((v) => v.size.toUpperCase() === item.size.toUpperCase());
  }

  if (!variant) {
    const error = new Error(MESSAGES.CART.VARIANT_UNAVAILABLE);
    error.statusCode = 400;
    throw error;
  }

  const effectiveMax = Math.min(CART_CONSTANTS.MAX_QUANTITY_PER_ITEM, variant.stock);

  if (action === "increase") {
    if (item.quantity >= effectiveMax) {
      const errorMsg = effectiveMax === CART_CONSTANTS.MAX_QUANTITY_PER_ITEM
        ? MESSAGES.CART.MAX_QUANTITY_REACHED
        : `Only ${variant.stock} item(s) available in stock`;
      const error = new Error(errorMsg);
      error.statusCode = 400;
      throw error;
    }
    item.quantity += 1;
  } else if (action === "decrease") {
    if (item.quantity > CART_CONSTANTS.MIN_QUANTITY_PER_ITEM) {
      item.quantity -= 1;
    } else {
      const error = new Error("Minimum quantity is 1. Click Remove to delete this item.");
      error.statusCode = 400;
      throw error;
    }
  }

  const effectivePrice = (variant && typeof variant.price === 'number' && !isNaN(variant.price) && variant.price > 0)
    ? variant.price
    : (item.price || product.salePrice || product.regularPrice || 0);

  item.price = effectivePrice;
  await cart.save();

  // Recalculate populated cart totals
  const { total, items, hasUnavailableItems } = await getUserCart(userId);

  return {
    success: true,
    itemId: item._id,
    quantity: item.quantity,
    unitPrice: effectivePrice,
    subtotal: effectivePrice * item.quantity,
    grandTotal: total,
    availableStock: variant.stock,
    hasUnavailableItems,
  };
};

export const removeCartItem = async ({ userId, itemId, productId, size }) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    const error = new Error(MESSAGES.CART.NOT_FOUND);
    error.statusCode = 404;
    throw error;
  }

  if (itemId) {
    cart.items = cart.items.filter((i) => i._id.toString() !== itemId.toString());
  } else if (productId) {
    const normalizedSize = (size || "M").toUpperCase();
    cart.items = cart.items.filter(
      (i) =>
        !(
          i.product.toString() === productId.toString() &&
          i.size.toUpperCase() === normalizedSize
        )
    );
  }

  await cart.save();

  const { total, hasUnavailableItems } = await getUserCart(userId);

  return {
    success: true,
    message: MESSAGES.CART.ITEM_REMOVED,
    grandTotal: total,
    cartEmpty: cart.items.length === 0,
    totalItems: cart.items.length,
    hasUnavailableItems,
  };
};

export const validateCartForCheckout = async (userId) => {
  const { cart, items, total, hasUnavailableItems } = await getUserCart(userId);

  if (!cart || items.length === 0) {
    const error = new Error(MESSAGES.CART.EMPTY);
    error.isEmpty = true;
    error.statusCode = 400;
    throw error;
  }

  if (hasUnavailableItems) {
    const error = new Error(MESSAGES.CART.HAS_UNAVAILABLE_ITEMS);
    error.hasUnavailableItems = true;
    error.statusCode = 400;
    throw error;
  }

  return { cart, items, total };
};
