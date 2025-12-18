
import express from "express";
import {loadHomepage} from "../controllers/user/usercontroller.js";

const router = express.Router();

router.get("/",loadHomepage);

export default router;










// const express = require("express");
// const router = express.Router();
// const userController = require("../controllers/user/usercontroller");

// router.get("/",userController.loadHomepage);




// module.exports = router;