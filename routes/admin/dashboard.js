 import express  from "express";

import { loadAdminLogin,adminLogin } from '../controllers/admin/adminController.js';
import {loadDashboard} from "../controllers/admin/dashboardController.js";
import { get } from "mongoose";

const router = express.Router();

//login

router.get("/login",loadAdminLogin);
router.post("/login",adminLogin);

//dashboard

router.get("/dashboard",loadDashboard);

export default router;

