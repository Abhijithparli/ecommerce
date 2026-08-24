import User from "../models/userModel.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

/**
 * Transporter & Mail Helper
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

export const sendAdminMail = async (to, subject, html) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Headshield Admin" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};

/**
 * Admin Business Logic
 */

export const validateAdminLogin = async (email, password) => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345";

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return { email: ADMIN_EMAIL, isAdmin: true };
  }
  throw new Error("Invalid email or password");
};

export const requestAdminPasswordReset = async (email) => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";

  if (email !== ADMIN_EMAIL) {
    throw new Error("No admin account found with this email");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

  const resetLink = `${process.env.BASE_URL || "http://localhost:3000"}/admin/reset-password/${token}`;

  await sendAdminMail(
    email,
    "Admin Password Reset - Headshield",
    `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <h2 style="color:#4f46e5;">Admin Password Reset</h2>
        <p>Click the button below to reset your admin password. This link expires in <strong>10 minutes</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;
                  background:#4f46e5;color:white;border-radius:6px;
                  text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  );

  return { token, expiry };
};

export const getUsersList = async ({ page = 1, limit = 5, searchQuery = "", filterStatus = "all" }) => {
  const skip = (page - 1) * limit;
  const filter = {}; 

  if (searchQuery) {
    filter.$or = [
      { name: { $regex: searchQuery, $options: "i" } },
      { email: { $regex: searchQuery, $options: "i" } }
    ];
  }

  if (filterStatus === "blocked") filter.isBlocked = true;
  if (filterStatus === "unblocked") filter.isBlocked = false;

  const totalUsers = await User.countDocuments(filter);
  const totalPages = Math.ceil(totalUsers / limit);

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("-password");

  return {
    users,
    totalUsers,
    totalPages,
    currentPage: page
  };
};

export const blockUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await User.findByIdAndUpdate(userId, { isBlocked: true });
  return true;
};

export const unblockUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await User.findByIdAndUpdate(userId, { isBlocked: false });
  return true;
};
