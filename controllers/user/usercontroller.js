import * as authService from "../../services/authService.js";
import * as userService from "../../services/userService.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Multer Profile Image configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/profiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.session.user.id}-${Date.now()}${ext}`);
  }
});

export const uploadProfileImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG or WEBP allowed"), false);
    }
    cb(null, true);
  }
});

// ================= HOME =================
export const loadHomepage = (req, res) => {
  res.render("user/home", { user: req.session.user || null });
};

// ================= SIGNUP =================
export const loadSignup = (req, res) => {
  res.render("user/signup", { error: null, success: null });
};

export const signup = async (req, res) => {
  try {
    const tempUser = await authService.registerUserPreOtp(req.body);
    req.session.tempUser = tempUser;

    res.render("user/otp", {
      email: tempUser.email,
      error: null,
      success: "OTP sent to your email"
    });
  } catch (error) {
    console.error("Signup controller error:", error);
    res.render("user/signup", {
      error: error.message || "Server error",
      success: null
    });
  }
};

// ================= OTP VERIFICATION =================
export const loadVerifyOtp = (req, res) => {
  const email = req.session.tempUser?.email || req.session.forgotEmail;
  if (!email) return res.redirect("/signup");
  res.render("user/otp", { email, error: null, success: null });
};

export const verifyOtp = async (req, res) => {
  const email = req.body.email;
  try {
    const { otp } = req.body;
    const tempUser = req.session.tempUser;
    const forgotEmail = req.session.forgotEmail;

    // Signup OTP Flow
    if (tempUser && tempUser.email === email) {
      await authService.verifyRegisterOtp(tempUser, otp);
      req.session.tempUser = null;
      return res.redirect("/login");
    }

    // Forgot Password OTP Flow
    if (forgotEmail && forgotEmail === email) {
      const resetToken = await authService.verifyForgotPasswordOtp(email, otp);
      req.session.forgotEmail = null;
      return res.redirect(`/reset-password/${resetToken}`);
    }

    res.render("user/otp", { email, error: "Session expired. Try again.", success: null });
  } catch (error) {
    console.error("Verify OTP controller error:", error);
    res.render("user/otp", { email, error: error.message || "OTP verification failed", success: null });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = authService.generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    if (req.session.tempUser?.email === email) {
      req.session.tempUser.otp = otp;
      req.session.tempUser.otpExpiry = otpExpiry;
    } else if (req.session.forgotEmail === email) {
      const user = await userService.getUserById(req.session.user.id);
      user.otp = otp;
      user.otpExpiry = new Date(otpExpiry);
      await user.save();
    } else {
      return res.json({ success: false, message: "Session expired" });
    }

    await authService.sendMail(email, "New OTP - Headshield", authService.otpTemplate(otp));
    res.json({ success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.json({ success: false, message: "Failed to send OTP" });
  }
};

// ================= LOGIN =================
export const loadLogin = (req, res) => {
  res.render("user/login", { error: null });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await authService.loginUser(email, password);

    req.session.user = userData;
    req.session.save(() => {
      res.redirect("/");
    });
  } catch (error) {
    console.error("Login controller error:", error);
    res.render("user/login", { error: error.message || "Server error" });
  }
};

// ================= LOGOUT =================
export const logout = (req, res) => {
  delete req.session.user;
  res.redirect("/login");
};

// ================= FORGOT PASSWORD =================
export const loadForgotPassword = (req, res) => {
  res.render("user/forgotPassword", { error: null, message: null });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await authService.forgotPasswordRequest(email);

    req.session.forgotEmail = email;
    res.render("user/otp", {
      email,
      error: null,
      success: "OTP sent to your email"
    });
  } catch (error) {
    console.error("Forgot password controller error:", error);
    res.render("user/forgotPassword", {
      error: error.message || "Server error",
      message: null
    });
  }
};

// ================= RESET PASSWORD =================
export const loadResetPassword = (req, res) => {
  res.render("user/setPassword", { error: null, token: req.params.token });
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    await authService.resetPassword(token, password, confirmPassword);
    res.redirect("/login");
  } catch (error) {
    console.error("Reset password controller error:", error);
    res.render("user/setPassword", {
      error: error.message || "Reset failed",
      token: req.params.token
    });
  }
};

// ================= PROFILE =================
export const loadProfile = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    const success = req.session.profileSuccess || null;
    req.session.profileSuccess = null;

    res.render("user/profile", { user, success });
  } catch (error) {
    console.error("Load profile controller error:", error);
    res.redirect("/login");
  }
};

export const loadEditProfile = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    res.render("user/editProfile", { user, error: null });
  } catch (error) {
    res.redirect("/profile");
  }
};

export const editProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const updatedUser = await userService.updateProfile(
      userId,
      req.body,
      req.file ? req.file.filename : null
    );

    req.session.user.name = updatedUser.name;
    req.session.profileSuccess = "Profile updated successfully";
    res.redirect("/profile");
  } catch (error) {
    console.error("Edit profile controller error:", error);
    const user = await userService.getUserById(req.session.user.id);
    res.render("user/editProfile", { user, error: error.message || "Server error" });
  }
};

// ================= EMAIL CHANGE =================
export const loadEditEmail = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    res.render("user/editEmail", { user, step: 1, newEmail: null, error: null, success: null });
  } catch (error) {
    res.redirect("/profile");
  }
};

export const requestEmailChange = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { newEmail } = req.body;

    const emailChangeData = await userService.changeUserEmailRequest(userId, newEmail);
    req.session.emailChange = emailChangeData;

    const user = await userService.getUserById(userId);
    res.render("user/editEmail", {
      user,
      step: 2,
      newEmail,
      error: null,
      success: "OTP sent to new email"
    });
  } catch (error) {
    console.error("Request email change error:", error);
    const user = await userService.getUserById(req.session.user.id);
    res.render("user/editEmail", {
      user,
      step: 1,
      newEmail: null,
      error: error.message || "Server error",
      success: null
    });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otp, newEmail } = req.body;

    await userService.changeUserEmailVerify(userId, newEmail, otp, req.session.emailChange);

    req.session.user.email = newEmail;
    req.session.emailChange = null;
    req.session.profileSuccess = "Email updated successfully";
    res.redirect("/profile");
  } catch (error) {
    console.error("Verify email OTP error:", error);
    const user = await userService.getUserById(req.session.user.id);
    res.render("user/editEmail", {
      user,
      step: 2,
      newEmail: req.body.newEmail,
      error: error.message || "Email change failed",
      success: null
    });
  }
};

export const resendEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!req.session.emailChange) return res.json({ success: false, message: "Session expired" });

    const otp = authService.generateOTP();
    req.session.emailChange.otp = otp;
    req.session.emailChange.otpExpiry = Date.now() + 10 * 60 * 1000;

    await authService.sendMail(newEmail, "Verify your new email - Headshield", authService.otpTemplate(otp));
    res.json({ success: true });
  } catch (error) {
    console.error("Resend email OTP error:", error);
    res.json({ success: false, message: "Failed to resend OTP" });
  }
};

// ================= PASSWORD CHANGES =================
export const loadChangePassword = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    const isGoogleUser = !user.password;

    res.render("user/changePassword", {
      user,
      isGoogleUser,
      error: null,
      success: null
    });
  } catch (error) {
    res.redirect("/profile");
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    await userService.changeUserPassword(userId, currentPassword, newPassword, confirmPassword);

    delete req.session.user;
    res.redirect("/login");
  } catch (error) {
    console.error("Change password controller error:", error);
    const user = await userService.getUserById(req.session.user.id);
    const isGoogleUser = !user.password;

    res.render("user/changePassword", {
      user,
      isGoogleUser,
      error: error.message || "Failed to change password",
      success: null
    });
  }
};

// ================= ADDRESS MANAGEMENT =================
export const loadAddresses = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    const success = req.session.addressSuccess || null;
    req.session.addressSuccess = null;

    res.render("user/addresses", {
      user,
      addresses: user.addresses || [],
      error: null,
      success
    });
  } catch (error) {
    console.error(error);
    res.redirect("/profile");
  }
};

export const addAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await userService.addUserAddress(userId, req.body);

    req.session.addressSuccess = "Address added successfully";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Add address error:", error);
    req.session.error = error.message || "Something went wrong";
    res.redirect("/profile/addresses");
  }
};

export const loadEditAddress = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    const address = user.addresses.id(req.params.id);

    if (!address) return res.redirect("/profile/addresses");

    res.render("user/editAddress", { address });
  } catch (error) {
    res.redirect("/profile/addresses");
  }
};

export const editAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    await userService.updateUserAddress(userId, id, req.body);

    req.session.addressSuccess = "Address updated";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Edit address controller error:", error);
    req.session.error = error.message || "Update failed";
    res.redirect("/profile/addresses");
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    await userService.deleteUserAddress(userId, id);

    req.session.addressSuccess = "Address deleted";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Delete address controller error:", error);
    res.redirect("/profile/addresses");
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    await userService.setDefaultAddress(userId, id);

    req.session.addressSuccess = "Default address updated";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Set default address error:", error);
    res.redirect("/profile/addresses");
  }
};

// ================= GOOGLE PASSWORD SETUP =================
export const loadSetPassword = async (req, res) => {
  try {
    const user = await userService.getUserById(req.session.user.id);
    if (user.password) {
      return res.redirect("/");
    }
    res.render("user/setPassword", { error: null });
  } catch (error) {
    console.error("Load set password error:", error);
    res.redirect("/");
  }
};

export const savePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    await userService.setInitialPassword(userId, req.body);

    res.redirect("/");
  } catch (error) {
    console.error("Save password error:", error);
    res.render("user/setPassword", { error: error.message || "Server error" });
  }
};
