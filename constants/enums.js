export const ORDER_STATUS = Object.freeze({
  PLACED: "Placed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RETURN_REQUESTED: "Return Requested",
  RETURN_APPROVED: "Return Approved",
  RETURN_REJECTED: "Return Rejected",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
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