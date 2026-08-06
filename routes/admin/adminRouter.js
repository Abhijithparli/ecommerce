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
  resendAdminOtp,
} from "../../controllers/admin/adminController.js";

// CATEGORY CONTROLLER IMPORT
import {
  loadCategories,
  addCategory,
  editCategory,
  deleteCategory,
  loadEditCategory,
  loadAddCategory
} from "../../controllers/admin/categoryController.js";

import upload from "../../config/multer.js";

import {
  loadProducts,
  loadAddProduct,
  addProduct,
  loadEditProduct,
  editProduct,
  deleteProduct,
  blockProduct,
  unblockProduct
} from "../../controllers/admin/productController.js";

import {
  listAdminOrders,
  loadAdminOrderDetail,
  updateAdminOrderStatus
} from "../../controllers/admin/adminOrderController.js";


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
router.get("/categories/add", isAdminAuth, loadAddCategory);
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

// load add product router
router.get(

  "/products/add",

  isAdminAuth,

  loadAddProduct
);

// Add product
router.post(

  "/products/add",

  isAdminAuth,

  (req, res, next) => {

    upload.array("images", 10)(

      req,
      res,

      function (err) {

        if (err) {

          req.session.error = err.message;

          return res.redirect(

            "/admin/products"
          );
        }

        next();
      }
    );
  },

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

// block/unblock product
router.post("/products/block/:id", isAdminAuth, blockProduct);
router.post("/products/unblock/:id", isAdminAuth, unblockProduct);

// ================= ORDER MANAGEMENT =================
router.get("/orders", isAdminAuth, listAdminOrders);
router.get("/orders/:id", isAdminAuth, loadAdminOrderDetail);
router.post("/orders/:id/status", isAdminAuth, updateAdminOrderStatus);
export default router;
