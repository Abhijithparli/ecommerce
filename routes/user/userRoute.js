
import express from "express";

import{
    loadHomepage,
    loadSignup,
    signup,
    loadLogin,
    login,
    logout,
    loadForgotPassword,
    forgotPassword,
    loadResetPassword,
    resetPassword 
}
from "../../controllers/user/usercontroller.js";

import { isUserAuthenticated,isUserGuest } from "../../middlewares/userAuth.js";



const router = express.Router();


// router.get("/pageNotFound",userController,pageNotFound);

router.get("/",loadHomepage);
router.get("/signup",isUserGuest,loadSignup);
router.post("/signup",isUserGuest,signup);
router.get("/login",isUserGuest,loadLogin);
router.post("/login",isUserGuest,login);
router.get("/logout",logout);

router.get("/forgot-password",loadForgotPassword);
router.post("/forgot-password",forgotPassword);
router.get("/reset-password/:token",loadResetPassword);
router.post("/reset-password/:token",resetPassword);


export default router;

