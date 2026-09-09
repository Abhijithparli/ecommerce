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

export const CART_CONSTANTS = Object.freeze({
  MAX_QUANTITY_PER_ITEM: 5,
  MIN_QUANTITY_PER_ITEM: 1
});