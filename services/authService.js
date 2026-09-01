import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { MESSAGES } from "../constants/messages.js";

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

export const sendMail = async (to, subject, html) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Headshield" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};

export const otpTemplate = (otp) => {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;
                background:#0a0a0f;color:#e5e5e5;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:26px;letter-spacing:3px;">HEADSHIELD</h1>
      </div>
      <div style="padding:36px;">
        <p style="color:#9ca3af;font-size:15px;">Your OTP code:</p>
        <div style="background:#13131a;border:2px solid #f97316;border-radius:10px;
                    padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:38px;font-weight:700;letter-spacing:10px;color:#f97316;">
            ${otp}
          </span>
        </div>
        <p style="color:#6b7280;font-size:13px;">
          Expires in <strong style="color:white;">10 minutes</strong>. 
          If you didn't request this, ignore this email.
        </p>
      </div>
    </div>
  `;
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Authentication Business Logic


export const registerUserPreOtp = async ({ firstName, lastName, email, password, confirmPassword }) => {
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    throw new Error(MESSAGES.COMMON.ALL_FIELDS_REQUIRED);
  }
  if (password !== confirmPassword) {
    throw new Error(MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH);
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOTP();
  const otpExpiry = Date.now() + 10 * 60 * 1000;

  const tempUser = {
    name: `${firstName} ${lastName}`.trim(),
    email,
    password: hashedPassword,
    otp,
    otpExpiry
  };

  await sendMail(email, "Verify your email - Headshield", otpTemplate(otp));

  return tempUser;
};

export const verifyRegisterOtp = async (tempUser, userOtp) => {
  if (!tempUser) {
    throw new Error("Session expired. Please sign up again.");
  }
  if (tempUser.otp !== userOtp) {
    throw new Error(MESSAGES.AUTH.INVALID_OTP);
  }
  if (Date.now() > tempUser.otpExpiry) {
    throw new Error(MESSAGES.AUTH.OTP_EXPIRED);
  }

  return await User.create({
    name: tempUser.name,
    email: tempUser.email,
    password: tempUser.password,
    isVerified: true
  });
};

export const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  if (user.isBlocked) {
    throw new Error(MESSAGES.AUTH.ACCOUNT_BLOCKED);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error(MESSAGES.AUTH.INVALID_CREDENTIALS);
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email
  };
};

export const forgotPasswordRequest = async (email) => {
  if (!email) {
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  if (user.isBlocked) {
    throw new Error("Account is blocked");
  }

  const otp = generateOTP();
  const otpExpiry = Date.now() + 10 * 60 * 1000;

  user.otp = otp;
  user.otpExpiry = new Date(otpExpiry);
  await user.save();

  await sendMail(email, "Reset Password OTP - Headshield", otpTemplate(otp));

  return true;
};

export const verifyForgotPasswordOtp = async (email, userOtp) => {
  if (!email || !userOtp) {
    throw new Error("Email and OTP are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  if (user.otp !== userOtp) {
    throw new Error(MESSAGES.AUTH.INVALID_OTP);
  }

  if (new Date() > user.otpExpiry) {
    throw new Error(MESSAGES.AUTH.OTP_EXPIRED);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpiry = new Date(Date.now() + 10 * 60 * 1000);
  user.otp = null;
  user.otpExpiry = null;
  await user.save();

  return resetToken;
};

export const resetPassword = async (token, password, confirmPassword) => {
  if (!password || !confirmPassword) {
    throw new Error(MESSAGES.COMMON.ALL_FIELDS_REQUIRED);
  }
  if (password !== confirmPassword) {
    throw new Error(MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH);
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpiry: { $gt: new Date() }
  });

  if (!user) {
    throw new Error("Invalid or expired reset token");
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = null;
  user.resetPasswordExpiry = null;
  await user.save();

  return user;
};

