import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS
} from "../../constants/enums.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle Order business logic (User)
 */

export const createOrder = async ({ userId, addressId, paymentMethod }) => {
  if (!addressId) {
    throw new Error("Delivery address is required");
  }

  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    throw new Error(MESSAGES.CART.EMPTY);
  }

  // 2. Validate Stock
  for (const item of cart.items) {
    const product = item.product;
    if (!product || product.isDeleted || product.isBlocked) {
      throw new Error(`Product ${product ? product.name : 'Unknown'} is no longer available`);
    }
    const variant = product.variants?.find(
      (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
    );
    if (!variant) {
      throw new Error(`Variant size ${item.size} not found for product: ${product.name}`);
    }
    if (item.quantity > variant.stock) {
      throw new Error(`Insufficient stock for ${product.name} (Size: ${item.size}). Available: ${variant.stock}`);
    }
  }

  // 3. Get Address
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }
  const address = user.addresses.id(addressId);
  if (!address) {
    throw new Error("Delivery address not found in profile");
  }

  // 4. Calculate Prices (using selected variant price)
  let totalPrice = 0;
  cart.items.forEach((item) => {
    const variant = item.product.variants?.find(
      (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
    );
    const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
    totalPrice += itemPrice * item.quantity;
  });

  // 5. Generate unique Order ID
  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Create Order
  const order = new Order({
    orderId,
    user: userId,
    items: cart.items.map((item) => {
      const variant = item.product.variants?.find(
        (v) => v.size.toUpperCase() === (item.size || "M").toUpperCase()
      );
      const itemPrice = (variant && variant.price !== undefined) ? variant.price : item.product.salePrice;
      return {
        product: item.product._id,
        name: item.product.name,
        image: item.product.images[0] || "",
        size: item.size,
        quantity: item.quantity,
        price: itemPrice,
      };
    }),
    deliveryAddress: {
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || "India",
      type: address.type || "Home",
    },
    paymentMethod,
    paymentStatus: paymentMethod === PAYMENT_METHOD.COD ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PAID,
    totalPrice,
    discount: 0,
    finalPrice: totalPrice,
    status: ORDER_STATUS.PLACED,
    statusHistory: [{ status: ORDER_STATUS.PLACED, updatedAt: new Date() }],
  });

  // 7. Save Order and update variant stock
  await order.save();

  for (const item of cart.items) {
    await Product.updateOne(
      { _id: item.product._id, "variants.size": item.size },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }

  // 8. Clear Cart
  cart.items = [];
  await cart.save();

  return order;
};

export const getUserOrders = async (userId, page = 1, limit = 5) => {
  const query = { user: userId };
  const skip = (page - 1) * limit;

  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    currentPage: page,
    totalPages,
    totalOrders,
  };
};

export const getOrderById = async (orderId) => {
  const order = await Order.findById(orderId).populate("user", "name email");
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }
  return order;
};

export const cancelOrder = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error(MESSAGES.ORDER.NOT_FOUND);
  }

  if (order.status !== ORDER_STATUS.PLACED && order.status !== ORDER_STATUS.SHIPPED) {
    throw new Error(`Cannot cancel order in status: ${order.status}`);
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, updatedAt: new Date() });
  await order.save();

  // Restore variant stock
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, "variants.size": item.size },
      { $inc: { "variants.$.stock": item.quantity } }
    );
  }

  return order;
};
