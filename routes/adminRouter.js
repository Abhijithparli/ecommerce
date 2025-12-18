
import express from "express";
import { loadAdminLogin, adminLogin } from "../controllers/admin/adminController.js";
import { loadDashboard } from "../controllers/admin/dashboardController.js";

const router = express.Router();

// router.get("/login",loadadminlogin);
// router.post("/login",postLogin);
router.route ('/login')
.get(loadAdminLogin)
.post(adminLogin);

//dashboard
router.get("/dashboard",loadDashboard);


export default router;




// const express = require("express");
// // import express from "express"
// const router = express.Router();
// const adminController = require("../controllers/admin/adminController");
// const dashboardController = require("../controllers/admin/dashboardController");


// router.get("/",adminController.loadlogin);
// router.get("/",dashboardController.dashboard);

// module.exports = router;