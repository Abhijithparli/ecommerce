import express from "express";
import passport from "passport";

// Controllers
import {
  loadHomepage,
  loadSignup,
  signup,
  loadVerifyOtp,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadForgotPassword,
  forgotPassword,
  loadResetPassword,
  resetPassword,
  loadProfile,
  loadEditProfile,
  editProfile,
  uploadProfileImage,
  loadEditEmail,
  requestEmailChange,
  verifyEmailOtp,
  resendEmailOtp,
  loadChangePassword,
  changePassword,
  loadAddresses,
  addAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
} from "../../controllers/user/usercontroller.js";


import { isAuthenticated, isGuest,

 } from "../../middlewares/userMiddleware.js";

const router = express.Router();


// ================= PUBLIC =================
router.get("/", loadHomepage);

// Signup
router.get("/signup", isGuest, loadSignup);
router.post("/signup", isGuest, signup);

// OTP
router.get("/verify-otp", loadVerifyOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Login
router.get("/login", isGuest, loadLogin);
router.post("/login", isGuest, login);

// Logout (POST = secure)
router.post("/logout", logout);


// ================= GOOGLE AUTH =================
router.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    };
    res.redirect("/");
  }
);


// ================= FORGOT / RESET PASSWORD =================
router.get("/forgot-password", isGuest, loadForgotPassword);
router.post("/forgot-password", isGuest, forgotPassword);

router.get("/reset-password/:token", loadResetPassword);
router.post("/reset-password/:token", resetPassword);


// ================= PROFILE =================
router.get("/profile", isAuthenticated, loadProfile);

router.get("/profile/edit", isAuthenticated, loadEditProfile);
router.post(
  "/profile/edit",
  isAuthenticated,
  uploadProfileImage.single("profileImage"),
  editProfile
);


// ================= EMAIL CHANGE =================
router.get("/profile/edit-email", isAuthenticated, loadEditEmail);
router.post("/profile/edit-email", isAuthenticated, requestEmailChange);
router.post("/profile/verify-email-otp", isAuthenticated, verifyEmailOtp);
router.post("/profile/resend-email-otp", isAuthenticated, resendEmailOtp);


// ================= PASSWORD CHANGE =================
router.get("/profile/change-password", isAuthenticated, loadChangePassword);
router.post("/profile/change-password", isAuthenticated, changePassword);


// ================= ADDRESS =================
router.get("/profile/addresses", isAuthenticated, loadAddresses);

router.post("/profile/addresses/add", isAuthenticated, addAddress);
router.post("/profile/addresses/:id/edit", isAuthenticated, editAddress);
router.post("/profile/addresses/:id/delete", isAuthenticated, deleteAddress);
router.post("/profile/addresses/:id/default", isAuthenticated, setDefaultAddress);


export default router;