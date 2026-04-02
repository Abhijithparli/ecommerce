import mongoose from "mongoose";

// ── Address sub-schema ─────────────────────────────────────
const addressSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  phone:     { type: String, required: true },
  street:    { type: String, required: true },
  city:      { type: String, required: true },
  state:     { type: String, required: true },
  pincode:   { type: String, required: true },
  country:   { type: String, default: "India" },
  type:      { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  isDefault: { type: Boolean, default: false },
});

// ── Main User schema ───────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      default: null,          // null for Google OAuth users
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      default: null,          // for Google OAuth
    },

    // ── Extra profile fields ─────────────────────────────
    phone: {
      type: String,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say", null],
      default: null,
    },
    profileImage: {
      type: String,
      default: null,          // stores image path like /uploads/profiles/xxx.jpg
    },

    // ── OTP fields ───────────────────────────────────────
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },

    // ── Password reset fields ────────────────────────────
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpiry: {
      type: Date,
      default: null,
    },

    // ── Addresses ────────────────────────────────────────
    addresses: [addressSchema],
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
