import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import Cart from "../models/cartModel.js";

export const createOrder = async ({ userId, addressId, paymentMethod }) => {
  if (!addressId) {
    throw new Error("Delivery address is required");
  }

  // 1. Get Cart
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    throw new Error("Your cart is empty");
  }

  // 2. Validate Stock
  for (const item of cart.items) {
    const product = item.product;
    if (!product || product.isDeleted || product.isBlocked) {
      throw new Error(`Product ${product ? product.name : 'Unknown'} is no longer available`);
    }
    if (item.quantity > product.quantity) {
      throw new Error(`Insufficient stock for product: ${product.name}. Available: ${product.quantity}`);
    }
  }

  // 3. Get Address
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const address = user.addresses.id(addressId);
  if (!address) {
    throw new Error("Delivery address not found in profile");
  }

  // 4. Calculate Prices
  let totalPrice = 0;
  cart.items.forEach((item) => {
    totalPrice += item.product.salePrice * item.quantity;
  });

  // 5. Generate unique Order ID
  const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Create Order
  const order = new Order({
    orderId,
    user: userId,
    items: cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.images[0] || "",
      quantity: item.quantity,
      price: item.product.salePrice,
    })),
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
    paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
    totalPrice,
    discount: 0,
    finalPrice: totalPrice,
    status: "Placed",
    statusHistory: [{ status: "Placed", updatedAt: new Date() }],
  });

  // 7. Save Order and update stock
  await order.save();

  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { quantity: -item.quantity },
    });
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
    throw new Error("Order not found");
  }
  return order;
};

export const cancelOrder = async (orderId, userId) => {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status !== "Placed" && order.status !== "Shipped") {
    throw new Error(`Cannot cancel order in status: ${order.status}`);
  }

  order.status = "Cancelled";
  order.statusHistory.push({ status: "Cancelled", updatedAt: new Date() });
  await order.save();

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: item.quantity },
    });
  }

  return order;
};

export const getAdminOrders = async (search = "", status = "", page = 1, limit = 10) => {
  const query = {};

  if (status && status.trim() !== "") {
    query.status = status;
  }

  if (search && search.trim() !== "") {
    query.orderId = { $regex: search.trim(), $options: "i" };
  }

  const skip = (page - 1) * limit;
  const totalOrders = await Order.countDocuments(query);
  const totalPages = Math.ceil(totalOrders / limit);

  const orders = await Order.find(query)
    .populate("user", "name email")
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

export const updateOrderStatus = async (orderId, status) => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  const oldStatus = order.status;
  if (oldStatus === "Cancelled" || oldStatus === "Delivered") {
    throw new Error(`Cannot change status of a ${oldStatus} order`);
  }

  order.status = status;
  order.statusHistory.push({ status, updatedAt: new Date() });

  // If order is cancelled, restore stock
  if (status === "Cancelled") {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }
  }

  // If order is delivered, set payment status to Paid for COD
  if (status === "Delivered" && order.paymentMethod === "COD") {
    order.paymentStatus = "Paid";
  }

  await order.save();
  return order;
};
