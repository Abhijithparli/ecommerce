import * as adminService from "../../services/adminService.js";

// ================= LOAD ADMIN LOGIN PAGE =================
export const loadAdminLogin = (req, res) => {
  if (req.session?.admin?.isAdmin) return res.redirect("/admin/dashboard");
  res.render("admin/login", { error: null });
};

// ================= ADMIN LOGIN =================
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminData = await adminService.validateAdminLogin(email, password);

    req.session.admin = adminData;
    req.session.save((err) => {
      if (err) {
        console.error("Session error:", err);
        return res.render("admin/login", { error: "Session error. Try again." });
      }
      return res.redirect("/admin/dashboard");
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.render("admin/login", { error: error.message || "Server error" });
  }
};

// ================= ADMIN LOGOUT =================
export const adminLogout = (req, res) => {
  delete req.session.admin;
  res.redirect("/admin/login");
};

// ================= LOAD DASHBOARD =================
export const loadDashboard = (req, res) => {
  res.render("admin/dashboard");
};

// ================= LOAD FORGOT PASSWORD PAGE =================
export const getForgotPassword = (req, res) => {
  res.render("admin/forgotPassword", {
    message: null,
    error: null,
    formAction: "/admin/forgot-password"
  });
};

// ================= POST FORGOT PASSWORD =================
export const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const adminReset = await adminService.requestAdminPasswordReset(email);

    req.session.adminReset = adminReset;

    res.render("admin/forgotPassword", {
      error: null,
      message: "Reset link sent to your email."
    });
  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.render("admin/forgotPassword", {
      error: error.message || "Server error. Try again.",
      message: null
    });
  }
};

// ================= GET RESET PASSWORD =================
export const getResetPassword = (req, res) => {
  const { token } = req.params;
  const adminReset = req.session.adminReset;

  if (!adminReset || adminReset.token !== token || Date.now() > adminReset.expiry) {
    return res.render("admin/resetPassword", {
      error: "Invalid or expired reset link.",
      token: null
    });
  }

  res.render("admin/resetPassword", { error: null, token });
};

// ================= POST RESET PASSWORD =================
export const postResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    const adminReset = req.session.adminReset;

    if (!adminReset || adminReset.token !== token || Date.now() > adminReset.expiry) {
      return res.render("admin/resetPassword", {
        error: "Invalid or expired reset link.",
        token: null
      });
    }

    if (password !== confirmPassword) {
      return res.render("admin/resetPassword", {
        error: "Passwords do not match.",
        token
      });
    }

    if (password.length < 6) {
      return res.render("admin/resetPassword", {
        error: "Password must be at least 6 characters.",
        token
      });
    }

    req.session.adminReset = null;
    res.redirect("/admin/login");
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.render("admin/resetPassword", { error: "Server error.", token: null });
  }
};

// ================= LIST USERS =================
export const listUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const searchQuery = req.query.search || "";
    const filterStatus = req.query.status || "all";

    const data = await adminService.getUsersList({ page, limit, searchQuery, filterStatus });

    res.render("admin/userManagementpage", {
      users: data.users,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalUsers: data.totalUsers,
      searchQuery,
      filterStatus,
      limit
    });
  } catch (error) {
    console.error("List users error:", error);
    res.render("admin/userManagementpage", {
      users: [],
      currentPage: 1,
      totalPages: 0,
      totalUsers: 0,
      searchQuery: "",
      filterStatus: "all",
      limit: 5
    });
  }
};

// ================= BLOCK USER =================
export const blockUser = async (req, res) => {
  try {
    await adminService.blockUser(req.params.id);
    res.json({ success: true, message: "User blocked successfully" });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ success: false, message: error.message || "Error blocking user" });
  }
};

// ================= UNBLOCK USER =================
export const unblockUser = async (req, res) => {
  try {
    await adminService.unblockUser(req.params.id);
    res.json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    console.error("Unblock user error:", error);
    res.status(500).json({ success: false, message: error.message || "Error unblocking user" });
  }
};

// Temp placeholder helpers if verified elsewhere
export const verifyAdminOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (otp === "123456") return res.send("OTP Verified (Temporary)");
    return res.render("admin/enterOtp", { email, error: "Invalid OTP", success: null });
  } catch (error) {
    console.error(error);
  }
};

export const resendAdminOtp = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
};