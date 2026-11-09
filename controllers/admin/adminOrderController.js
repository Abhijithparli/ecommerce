import * as orderService from "../../services/admin/orderService.js";

export const listAdminOrders = async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || "";
     const sort = req.query.sort || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const data = await orderService.getAdminOrders(search, status,sort, page, limit);
    res.render("admin/orders", {
      orders: data.orders,
      currentPage: "orders",
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalOrders:data.totalOrders,
      search,
      status,
      sort,
      error: req.session.error || null,
      success: req.session.success || null,
    });

    ////
    // const statusCounts = await orderService.getOrderStatusCounts();

    res.render("admin/orders", {
      orders: data.orders,
      currentPage: "orders",
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalOrders: data.totalOrders,   
      search,
      status,
      sort
    });

    // clear notifications
    delete req.session.error;
    delete req.session.success;
  } catch (error) {
    console.error("List admin orders error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const loadAdminOrderDetail = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    res.render("admin/orderDetails", {
      order,
      currentPage: "orders",
      error: req.session.error || null,
      success: req.session.success || null,
    });

    // clear notifications
    delete req.session.error;
    delete req.session.success;
  } catch (error) {
    console.error("Load admin order detail error:", error);
    res.redirect("/admin/orders");
  }
};

export const updateAdminOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    await orderService.updateOrderStatus(orderId, status);
    req.session.success = `Order status updated to ${status} successfully!`;
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error("Update admin order status error:", error);
    req.session.error = error.message || "Failed to update status.";
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

export const getOrderStatusCounts = async (req,res)=>{
  try{
    const counts = await orderService.getOrderStatusCounts();

    res.json({
      success:true,
      counts
    });
  }catch (error){
console.error("Get order status counts error:",error);

res.status(500).json({
  success:false,
  meassage:"Failed to get order status counts"
});
  }
};

export const approveReturnAction = async (req, res) => {
  try {
    const orderId = req.params.id;
    await orderService.approveReturn(orderId);
    req.session.success = "Return approved successfully! Stock has been restored.";
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error("Approve return error:", error);
    req.session.error = error.message || "Failed to approve return.";
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};

export const rejectReturnAction = async (req, res) => {
  try {
    const orderId = req.params.id;
    await orderService.rejectReturn(orderId);
    req.session.success = "Return request has been rejected.";
    res.redirect(`/admin/orders/${orderId}`);
  } catch (error) {
    console.error("Reject return error:", error);
    req.session.error = error.message || "Failed to reject return.";
    res.redirect(`/admin/orders/${req.params.id}`);
  }
};
