import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

// ===============
// email helper
// ============================================================
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ====================
// admin login page
// ============================================================
export const loadAdminLogin = (req, res) => {
  if (req.session?.admin?.isAdmin) return res.redirect("/admin/dashboard");
  res.render("admin/login", { error: null });
};

// ============================================================
//admin login
// ============================================================
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@gmail.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      req.session.admin = { email: ADMIN_EMAIL, isAdmin: true };

      req.session.save((err) => {
        if (err) {
          console.error("Session error:", err);
          return res.render("admin/login", { error: "Session error. Try again." });
        }
        return res.redirect("/admin/dashboard");  
      });
    } else {
      return res.render("admin/login", { error: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.render("admin/login", { error: "Server error" });
  }
};


//forgotpassword

export const verifyAdminOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // TEMP LOGIC (you will replace later with real OTP check)
    if (otp === "123456") {
      return res.send("OTP Verified (Temporary)");
    }

    return res.render("admin/enterOtp", {
      email,
      error: "Invalid OTP",
      success: null
    });

  } catch (error) {
    console.error(error);
  }
};

export const resendAdminOtp = async (req, res) => {
  try {
    // send OTP logic here
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
};
// ===============
// admin logout
// ============================================================
export const adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout error:", err);
    res.clearCookie("connect.sid");
    res.redirect("/admin/login");
  });
};

// ============================================================
//dashboard
// ============================================================
export const loadDashboard = (req, res) => {
  res.render("admin/dashboard");
};

// ============================================================
// forgot password 
// ============================================================
export const getForgotPassword = (req, res) => {
  res.render("admin/forgotPassword", {
    message: null,
    error: null,
    formAction: "/admin/forgot-password"   
  });
};

// ==========================================
// forgot password — send reset email
// ============================================================
export const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";

    if (email !== ADMIN_EMAIL) {
      return res.render("admin/forgotPassword", {
        error: "No admin account found with this email",
        message: null,
      });
    }

    const token  = crypto.randomBytes(32).toString("hex");
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store in session (admin has no DB record)
    req.session.adminReset = { token, expiry };

    const resetLink = `${process.env.BASE_URL || "http://localhost:3000"}/admin/reset-password/${token}`;

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Headshield Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Admin Password Reset - Headshield",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
          <h2 style="color:#4f46e5;">Admin Password Reset</h2>
          <p>Click the button below to reset your admin password. 
             This link expires in <strong>10 minutes</strong>.</p>
          <a href="${resetLink}"
             style="display:inline-block;margin:20px 0;padding:12px 28px;
                    background:#4f46e5;color:white;border-radius:6px;
                    text-decoration:none;font-weight:600;">
            Reset Password
          </a>
          <p style="color:#888;font-size:13px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    console.log("Admin reset link:", resetLink);

    res.render("admin/forgotPassword", {
      error: null,
      message: "Reset link sent to your email.",
    });
  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.render("admin/forgotPassword", { error: "Server error. Try again.", message: null });
  }
};

// ============================================================
// reset password — show form
// ============================================================
export const getResetPassword = (req, res) => {
  const { token } = req.params;
  const adminReset = req.session.adminReset;

  if (!adminReset || adminReset.token !== token || Date.now() > adminReset.expiry) {
    return res.render("admin/resetPassword", {
      error: "Invalid or expired reset link.",
      token: null,
    });
  }

  res.render("admin/resetPassword", { error: null, token });
};

// ============================================================
// reset password — save new password
// ============================================================
export const postResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    const adminReset = req.session.adminReset;

    if (!adminReset || adminReset.token !== token || Date.now() > adminReset.expiry) {
      return res.render("admin/resetPassword", {
        error: "Invalid or expired reset link.",
        token: null,
      });
    }

    if (password !== confirmPassword) {
      return res.render("admin/resetPassword", {
        error: "Passwords do not match.",
        token,
      });
    }

    if (password.length < 6) {
      return res.render("admin/resetPassword", {
        error: "Password must be at least 6 characters.",
        token,
      });
    }

    // In a real app you'd save the hashed password to DB or .env
    // For now we clear the session token and redirect to login
    req.session.adminReset = null;

    console.log("Admin password reset successful");
    res.redirect("/admin/login");
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.render("admin/resetPassword", { error: "Server error.", token: null });
  }
};

// ============================================================
// user mangement — List users
// ============================================================
export const listUsers = async (req, res) => {
  try {
    const page        = parseInt(req.query.page)   || 1;
    const limit       = parseInt(req.query.limit)  || 5;
    const searchQuery = req.query.search           || "";
    const filterStatus = req.query.status          || "all";
    const skip = (page - 1) * limit;

    let filter = {};

    if (searchQuery) {
      filter.$or = [
        { name:  { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
      ];
    }

    if (filterStatus === "blocked")   filter.isBlocked = true;
    if (filterStatus === "unblocked") filter.isBlocked = false;

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password");

    res.render("admin/userManagementpage", {
      users,
      currentPage: page,
      totalPages,
      totalUsers,
      searchQuery,
      filterStatus,
      limit,
    });
  } catch (error) {
    console.error("List users error:", error);
    res.render("admin/userManagementpage", {
      users: [], currentPage: 1, totalPages: 0,
      totalUsers: 0, searchQuery: "", filterStatus: "all", limit: 5,
    });
  }
};

// ============================================================
// user management — Block user
// ============================================================
export const blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await User.findByIdAndUpdate(req.params.id, { isBlocked: true });
    res.json({ success: true, message: "User blocked successfully" });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ success: false, message: "Error blocking user" });
  }
};

// ============================================================
// usermanagement — Unblock user
// ============================================================
export const unblockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await User.findByIdAndUpdate(req.params.id, { isBlocked: false });
    res.json({ success: true, message: "User unblocked successfully" });
  } catch (error) {
    console.error("Unblock user error:", error);
    res.status(500).json({ success: false, message: "Error unblocking user" });
  }
};