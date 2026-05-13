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
  verifyAdminOtp,
  resendAdminOtp
} from "../../controllers/admin/adminController.js";

// CATEGORY CONTROLLER IMPORT
import {
  loadCategories,
  addCategory,
  editCategory,
  deleteCategory,
  loadEditCategory
} from "../../controllers/admin/categoryController.js";

import upload from "../../config/multer.js";

import {
  loadProducts,
  addProduct,
  loadEditProduct,
  editProduct,
  deleteProduct
} from "../../controllers/admin/productController.js";


const router = express.Router();


// ── Auth middleware ────────────────────────────────────────
const isAdminAuth = (req, res, next) => {
  if (req.session?.admin?.isAdmin) return next();
  return res.redirect("/admin/login");
};

// ── Public routes ──────────────────────────────────────────
router.get("/login",  loadAdminLogin);
router.post("/login", adminLogin);


router.get("/forgot-password", getForgotPassword);
router.post("/forgot-password", postForgotPassword);

router.post("/verify-otp", verifyAdminOtp);
router.post("/resend-otp", resendAdminOtp);

router.get("/reset-password/:token", getResetPassword);
router.post("/reset-password/:token", postResetPassword);



// Logout — no auth check needed, works from any page
router.get("/logout", adminLogout);

// ── Protected routes ───────────────────────────────────────
router.get("/dashboard", isAdminAuth, loadDashboard);

router.get("/users",              isAdminAuth, listUsers);
router.post("/users/block/:id",   isAdminAuth, blockUser);
router.post("/users/unblock/:id", isAdminAuth, unblockUser);

// routes/admin/adminRoute.js

router.get("/categories", isAdminAuth, loadCategories);
router.post("/categories/add", isAdminAuth, addCategory);
router.get("/categories/:id/edit", isAdminAuth, loadEditCategory);

router.post("/categories/:id/edit", isAdminAuth, editCategory);
router.post("/categories/:id/delete", isAdminAuth, deleteCategory);

// ================= PRODUCT MANAGEMENT =================

// Load products page
router.get(
  "/products",
  isAdminAuth,
  loadProducts
);

// Add product
router.post(
  "/products/add",
  isAdminAuth,
  upload.array("images", 10),
  addProduct
);

// laod edit product page
router.get(
  "/products/:id/edit",
  isAdminAuth,
  loadEditProduct
);

// DELETE PRODUCT
router.post(
  "/products/:id/delete",
  isAdminAuth,
  deleteProduct
);

// update product
router.post(
  "/products/:id/edit",
  isAdminAuth,
  upload.array("images", 10),
  editProduct
);
export default router;
