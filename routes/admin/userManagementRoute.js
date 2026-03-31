import express from "express";
import {
  listUsers,
  blockUser,
  unblockUser
} from "../../controllers/userManagementController.js";

const router = express.Router();

// users listing page
router.get("/users", listUsers);

// router.use("/",userManagementRoute);

// block user
router.put("/admin/block/:id", blockUser);

// unblock user
router.put("/admin/unblock/:id", unblockUser);

export default router;
