import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import { generateOTP, sendMail, otpTemplate } from "./authService.js";
import { MESSAGES } from "../../constants/messages.js";

/**
 * Service to handle User profile, address, and password business logic
 */

export const getUserById = async (id) => {
  const user = await User.findById(id).select("-password");
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }
  return user;
};

export const updateProfile = async (userId, { name }, filename) => {
  if (!name || name.trim() === "") {
    throw new Error("Name is required");
  }

  const updates = { name: name.trim() };
  if (filename) {
    updates.profileImage = "/uploads/profiles/" + filename;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
  if (!updatedUser) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }
  return updatedUser;
};

export const changeUserEmailRequest = async (userId, newEmail) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
    throw new Error("Enter a valid email");
  }

  if (newEmail === user.email) {
    throw new Error("This is already your current email");
  }

  const existingUser = await User.findOne({ email: newEmail });
  if (existingUser) {
    throw new Error("Email already in use by another account");
  }

  const otp = generateOTP();
  const otpExpiry = Date.now() + 10 * 60 * 1000;

  await sendMail(newEmail, "Verify your new email - Headshield", otpTemplate(otp));

  return {
    newEmail,
    otp,
    otpExpiry
  };
};

export const changeUserEmailVerify = async (userId, newEmail, otp, emailChangeSession) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  if (!emailChangeSession || emailChangeSession.newEmail !== newEmail) {
    throw new Error("Session expired. Start again.");
  }

  if (emailChangeSession.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  if (Date.now() > emailChangeSession.otpExpiry) {
    throw new Error("OTP expired. Request a new one.");
  }

  user.email = newEmail;
  return await user.save();
};

export const changeUserPassword = async (userId, currentPassword, newPassword, confirmPassword) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const isGoogleUser = !user.password;

  if (!isGoogleUser) {
    if (!currentPassword) {
      throw new Error("Current password is required");
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 charcaters");
  }

  if (newPassword !== confirmPassword) {
    throw new Error(MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  return await user.save();
};

export const getUserAddresses = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }
  return user.addresses || [];
};

export const addUserAddress = async (userId, addressData) => {
  const { name, phone, street, city, state, pincode, country, type, isDefault } = addressData;

  if (!name || !phone || !street || !city || !state || !pincode) {
    throw new Error(MESSAGES.COMMON.ALL_FIELDS_REQUIRED);
  }

  if (!/^[A-Za-z\s]{3,50}$/.test(name.trim())) {
    throw new Error("Name must contain only letters (3-50 chars)");
  }

  if (!/^[6-9]\d{9}$/.test(phone.trim())) {
    throw new Error("invalid phone number");
  }

  if (street.trim().length < 5) {
    throw new Error("street must be at least 5 characters");
  }

  if (!/^[A-Za-z\s]{3,50}$/.test(city.trim())) {
    throw new Error("invalid city");
  }

  if (!/^[A-Za-z\s]{3,50}$/.test(state.trim())) {
    throw new Error("Invalid state");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const newAddr = {
    name: name.trim(),
    phone: phone.trim(),
    street: street.trim(),
    city: city.trim(),
    state: state.trim(),
    pincode: pincode.trim(),
    country: country || "India",
    type: type || "Home",
    isDefault: isDefault === "on"
  };

  if (newAddr.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }

  if (user.addresses.length === 0) {
    newAddr.isDefault = true;
  }

  user.addresses.push(newAddr);
  return await user.save();
};

export const updateUserAddress = async (userId, addressId, addressData) => {
  const { name, phone, street, city, state, pincode, country, type, isDefault } = addressData;

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const addr = user.addresses.id(addressId);
  if (!addr) {
    throw new Error(MESSAGES.ADDRESS.NOT_FOUND);
  }

  addr.name = name.trim();
  addr.phone = phone.trim();
  addr.street = street.trim();
  addr.city = city.trim();
  addr.state = state.trim();
  addr.pincode = pincode.trim();
  addr.country = country || "India";
  addr.type = type || "Home";

  if (isDefault === "on") {
    user.addresses.forEach((a) => (a.isDefault = false));
    addr.isDefault = true;
  }

  return await user.save();
};

export const deleteUserAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  const addr = user.addresses.id(addressId);
  if (!addr) {
    throw new Error(MESSAGES.ADDRESS.NOT_FOUND);
  }

  const wasDefault = addr.isDefault;
  user.addresses.pull(addressId);

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  return await user.save();
};

export const setDefaultAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  user.addresses.forEach((a) => {
    a.isDefault = a._id.toString() === addressId;
  });

  return await user.save();
};

export const setInitialPassword = async (userId, { password, confirmPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(MESSAGES.USER.NOT_FOUND);
  }

  if (user.password) {
    throw new Error("Password already set");
  }

  if (!password || !confirmPassword) {
    throw new Error(MESSAGES.COMMON.ALL_FIELDS_REQUIRED);
  }

  if (password !== confirmPassword) {
    throw new Error(MESSAGES.AUTH.PASSWORDS_DO_NOT_MATCH);
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  user.password = await bcrypt.hash(password, 10);
  return await user.save();
};
