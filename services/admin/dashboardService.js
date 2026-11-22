import Order from "../../models/orderModel.js";
import User from "../../models/userModel.js";
import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import { ORDER_STATUS } from "../../constants/enums.js";

/**
 * Service to handle dynamic Dashboard stats, charts, and Top 10 rankings
 */

export const getDashboardOverview = async () => {
  const [totalUsers, totalOrders, pendingOrders, returnRequests, salesAgg, totalProducts, totalCategories] =
    await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY] },
      }),
      Order.countDocuments({ status: ORDER_STATUS.RETURN_REQUESTED }),
      Order.aggregate([
        { $match: { status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$finalPrice" },
            totalDiscount: { $sum: "$discount" },
          },
        },
      ]),
      Product.countDocuments({ isDeleted: false }),
      Category.countDocuments({ isDeleted: false }),
    ]);

  const totalRevenue = salesAgg.length > 0 ? salesAgg[0].totalRevenue : 0;
  const totalDiscount = salesAgg.length > 0 ? salesAgg[0].totalDiscount : 0;

  return {
    totalUsers,
    totalOrders,
    totalRevenue,
    totalDiscount,
    pendingOrders,
    returnRequests,
    totalProducts,
    totalCategories,
  };
};

export const getChartData = async (period = "monthly") => {
  const now = new Date();

  if (period === "yearly") {
    // Last 5 years
    const currentYear = now.getFullYear();
    const startYear = currentYear - 4;
    const startDate = new Date(startYear, 0, 1);

    const agg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] },
        },
      },
      {
        $group: {
          _id: { $year: "$createdAt" },
          revenue: { $sum: "$finalPrice" },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const labels = [];
    const salesData = [];
    const ordersData = [];

    for (let yr = startYear; yr <= currentYear; yr++) {
      labels.push(yr.toString());
      const found = agg.find((a) => a._id === yr);
      salesData.push(found ? found.revenue : 0);
      ordersData.push(found ? found.ordersCount : 0);
    }

    return { labels, salesData, ordersData };
  } else if (period === "weekly" || period === "daily") {
    // Last 7 days
    const startDate = new Date();
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const agg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$finalPrice" },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const labels = [];
    const salesData = [];
    const ordersData = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const str = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      labels.push(dayName);
      const found = agg.find((a) => a._id === str);
      salesData.push(found ? found.revenue : 0);
      ordersData.push(found ? found.ordersCount : 0);
    }

    return { labels, salesData, ordersData };
  } else {
    // Default: monthly for current year (Jan - Dec)
    const currentYear = now.getFullYear();
    const startDate = new Date(currentYear, 0, 1);

    const agg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: { $sum: "$finalPrice" },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = monthNames;
    const salesData = [];
    const ordersData = [];

    for (let m = 1; m <= 12; m++) {
      const found = agg.find((a) => a._id === m);
      salesData.push(found ? found.revenue : 0);
      ordersData.push(found ? found.ordersCount : 0);
    }

    return { labels, salesData, ordersData };
  }
};

export const getTop10Rankings = async () => {
  const [topProducts, topCategories, topBrands] = await Promise.all([
    // Top 10 Best Selling Products
    Order.aggregate([
      { $match: { status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      { $unwind: "$items" },
      { $match: { "items.status": { $ne: "Cancelled" } } },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          image: { $first: "$items.image" },
          totalUnitsSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
      { $limit: 10 },
    ]),

    // Top 10 Best Selling Categories
    Order.aggregate([
      { $match: { status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      { $unwind: "$items" },
      { $match: { "items.status": { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: "$productDoc" },
      {
        $lookup: {
          from: "categories",
          localField: "productDoc.category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      { $unwind: "$categoryDoc" },
      {
        $group: {
          _id: "$categoryDoc._id",
          name: { $first: "$categoryDoc.name" },
          totalUnitsSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
      { $limit: 10 },
    ]),

    // Top 10 Best Selling Brands
    Order.aggregate([
      { $match: { status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED] } } },
      { $unwind: "$items" },
      { $match: { "items.status": { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: "$productDoc" },
      {
        $group: {
          _id: "$productDoc.brand",
          name: { $first: "$productDoc.brand" },
          totalUnitsSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return { topProducts, topCategories, topBrands };
};

export const getLedgerBook = async () => {
  const orders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: 1 });

  let runningBalance = 0;
  const ledgerEntries = [];

  for (const o of orders) {
    if (o.status !== ORDER_STATUS.CANCELLED && o.status !== ORDER_STATUS.RETURNED) {
      runningBalance += o.finalPrice;
      ledgerEntries.push({
        date: o.createdAt,
        type: "Sale (Credit)",
        orderId: o.orderId,
        customer: o.user ? o.user.name : "Customer",
        description: `Order #${o.orderId} placed (${o.paymentMethod})`,
        credit: o.finalPrice,
        debit: 0,
        balance: runningBalance,
      });
    } else {
      const refundAmt = o.walletRefundAmount || o.finalPrice;
      runningBalance -= refundAmt;
      ledgerEntries.push({
        date: o.updatedAt || o.createdAt,
        type: "Refund / Return (Debit)",
        orderId: o.orderId,
        customer: o.user ? o.user.name : "Customer",
        description: `Order #${o.orderId} ${o.status.toLowerCase()} refund`,
        credit: 0,
        debit: refundAmt,
        balance: runningBalance,
      });
    }
  }

  // Reverse to show newest on top for view
  return ledgerEntries.reverse();
};
