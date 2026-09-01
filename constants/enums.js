export const ORDER_STATUS = Object.freeze({
  PLACED: "Placed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned"
});

export const PAYMENT_METHOD = Object.freeze({
  COD: "COD",
  RAZORPAY: "Razorpay",
  WALLET: "Wallet"
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed"
});