import express from "express";
import passport from "passport"; 
import {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadForgotPassword,
  forgotPassword,
  loadResetPassword,
  resetPassword,
  loadVerifyOtp   
} from "../../controllers/user/usercontroller.js";

import { isUserAuthenticated, isUserGuest } from "../../middlewares/userAuth.js";

const router = express.Router();

// Public routes
router.get("/", loadHomepage);

// Signup routes
router.get("/signup", isUserGuest, loadSignup);
router.post("/signup", isUserGuest, signup);

// Login routes  
router.get("/login", isUserGuest, loadLogin);
router.post("/login", isUserGuest, login);

// Logout
router.get("/logout", logout);

// OTP verification routes
router.get("/verify-otp", loadVerifyOtp);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// Forgot password routes
router.get("/forgot-password", loadForgotPassword);
router.post("/forgot-password", forgotPassword);

// Reset password routes
router.get("/reset-password/:token", loadResetPassword);
router.post("/reset-password/:token", resetPassword);

// ✅ Google OAuth routes
router.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication
    req.session.user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    };
    res.redirect("/");
  }
);

export default router;