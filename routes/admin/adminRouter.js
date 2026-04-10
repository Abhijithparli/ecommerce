// routes/admin/adminRouter.js
import express from "express";
import {
  loadAdminLogin,
  adminLogin,
  adminLogout,
  loadDashboard,
  getForgotPassword,
  postForgotPassword,
  getResetPassword,
  postResetPassword,
  listUsers,
  blockUser,
  unblockUser,
} from "../../controllers/admin/adminController.js";

const router = express.Router();

// ── Auth middleware ────────────────────────────────────────
const isAdminAuth = (req, res, next) => {
  if (req.session?.admin?.isAdmin) return next();
  return res.redirect("/admin/login");
};

// ── Public routes ──────────────────────────────────────────
router.get("/login",  loadAdminLogin);
router.post("/login", adminLogin);

router.get("/forgot-password",        getForgotPassword);
router.post("/forgot-password",       postForgotPassword);
router.get("/reset-password/:token",  getResetPassword);
router.post("/reset-password/:token", postResetPassword);

// Logout — no auth check needed, works from any page
router.get("/logout", adminLogout);

// ── Protected routes ───────────────────────────────────────
router.get("/dashboard", isAdminAuth, loadDashboard);

router.get("/users",              isAdminAuth, listUsers);
router.post("/users/block/:id",   isAdminAuth, blockUser);
router.post("/users/unblock/:id", isAdminAuth, unblockUser);

export default router;
