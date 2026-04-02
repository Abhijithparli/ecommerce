import express from "express";
import { loadAdminLogin, adminLogin, adminLogout } from "../../controllers/admin/adminController.js";
import { loadDashboard } from "../../controllers/admin/dashboardController.js";  
import { listUsers, blockUser, unblockUser } from "../../controllers/admin/userManagementController.js"; 
import { isAdminAuthenticated, isAdminGuest } from "../../middlewares/adminAuth.js";

const router = express.Router();

// Login routes
router.route('/login')
  .get(isAdminGuest, loadAdminLogin)
  .post(isAdminGuest, adminLogin);

// Logout route
router.post('/logout', adminLogout);

// Protected routes
router.get("/dashboard", isAdminAuthenticated, loadDashboard);

// User routes 
router.get("/users", isAdminAuthenticated, listUsers);
router.post("/users/block/:id", isAdminAuthenticated, blockUser);
router.post("/users/unblock/:id", isAdminAuthenticated, unblockUser);

export default router; 