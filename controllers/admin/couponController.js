import * as couponService from "../../services/admin/couponService.js";

export const loadCoupons = async (req, res) => {
  try {
    const search = req.query.search || "";
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    const limit = 8;

    const data = await couponService.getCoupons(search, page, limit);

    res.render("admin/coupons", {
      coupons: data.coupons,
      search: data.search,
      currentPageNum: data.currentPage,
      totalPages: data.totalPages,
      totalCoupons: data.totalCoupons,
      currentPage: "coupons",
      success: req.session.success || null,
      error: req.session.error || null,
    });

    delete req.session.success;
    delete req.session.error;
  } catch (error) {
    console.error("Load coupons error:", error);
    res.redirect("/admin/dashboard");
  }
};

export const loadAddCoupon = async (req, res) => {
  try {
    res.render("admin/addCoupon", {
      currentPage: "coupons",
      error: req.session.error || null,
      formData: req.session.formData || {},
    });
    delete req.session.error;
    delete req.session.formData;
  } catch (error) {
    console.error("Load add coupon error:", error);
    res.redirect("/admin/coupons");
  }
};

export const addCoupon = async (req, res) => {
  try {
    await couponService.createCoupon(req.body);
    req.session.success = "Coupon created successfully!";
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Add coupon error:", error);
    req.session.error = error.message || "Failed to create coupon.";
    req.session.formData = req.body;
    res.redirect("/admin/coupons/add");
  }
};

export const loadEditCoupon = async (req, res) => {
  try {
    const coupon = await couponService.getCouponById(req.params.id);
    res.render("admin/editCoupon", {
      coupon,
      currentPage: "coupons",
      error: req.session.error || null,
    });
    delete req.session.error;
  } catch (error) {
    console.error("Load edit coupon error:", error);
    req.session.error = error.message || "Coupon not found.";
    res.redirect("/admin/coupons");
  }
};

export const updateCoupon = async (req, res) => {
  try {
    await couponService.updateCoupon(req.params.id, req.body);
    req.session.success = "Coupon updated successfully!";
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Update coupon error:", error);
    req.session.error = error.message || "Failed to update coupon.";
    res.redirect(`/admin/coupons/edit/${req.params.id}`);
  }
};

export const toggleCoupon = async (req, res) => {
  try {
    const coupon = await couponService.toggleCouponStatus(req.params.id);
    const statusText = coupon.isActive ? "activated" : "deactivated";
    req.session.success = `Coupon ${coupon.code} ${statusText} successfully!`;

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({ success: true, isActive: coupon.isActive, message: req.session.success });
    }
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Toggle coupon error:", error);
    req.session.error = error.message || "Failed to toggle coupon status.";
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.redirect("/admin/coupons");
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    await couponService.deleteCoupon(req.params.id);
    req.session.success = "Coupon deleted successfully!";

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({ success: true, message: "Coupon deleted successfully!" });
    }
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Delete coupon error:", error);
    req.session.error = error.message || "Failed to delete coupon.";
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.redirect("/admin/coupons");
  }
};
