
import User  from "../../models/userModel.js";

// const pageNotFound = async(req,res)=>{
//     try{
//         res.render("page-404")
//     }catch (error) {
//         res.redirect("/pageNotFound")
//     }
// }
import bcrypt from "bcryptjs";
import { error } from "console";
import crypto from "crypto";
import { name } from "ejs";
import { existsSync } from "fs";
import nodemailer from "nodemailer";

//email service
const transporter = nodemailer.createTransport({
    
    service:"gmail",
    auth:{
        user:"abhijithts2004@gmail.com",
        pass: 'fcrccimfspsbbsvf'

    }
});

//otp generate

function generateOTP(){
    return Math.floor(100000 + Math.random() * 900000).toString();
}

//load home page

export const loadHomepage = async (req,res)=>{
    try{
        res.render("user/home",{
            user:req.session.user || null
        });
    }catch (error){
        console.error(error);
        res.status(500).send("server error");
        
    }
};

//load signup page
export const loadSignup = async(req,res)=>{
    try{
        

        res.render("user/signup",{error:null,sucess:null});
    }catch (error){
        console.error(error);
        res.status(500).send("server error");
    }
};

// signup with OTP

export const signup = async (req, res) => {
  try {
    console.log("Signup request:", req.body);

    const { firstName, lastName, email, password, confirmPassword } = req.body;

    const name = `${firstName} ${lastName}`.trim();

    //  fields required
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.render("signup", {
        error: "All fields are required",
        success: null
      });
    }

    // Password match
    if (password !== confirmPassword) {
      return res.render("signup", {
        error: "Passwords do not match",
        success: null
      });
    }
    //  Password length check
    if (password.length < 6) {
        return res.render("signup", {
            error: "Password must be at least 6 characters",
            success: null
        });
    }
    
    // check  user exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
        return res.render("signup", {
            error: "Email already registered",
            success: null
        });
    }
    
    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 6) Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    
    //Create user
    const user = new User({
        name,
        email,
        password: hashedPassword,
        otp,
        otpExpiry,
        isVerified: false
    });

    console.log("hehehehehhehehehehhehehe")
    await user.save();
    console.log("didi worj")
    // Send OTP Email
    await transporter.sendMail({
      from: "headshield@gmail.com",
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Welcome to HeadShield</h2>
        <p>Your OTP is:</p>
        <h1><strong>${otp}</strong></h1>
        <p>Valid for 10 minutes</p>
      `
    });

    return res.render("signup", {
      error: null,
      success: "Account created — OTP sent to your email"
    });

  } catch (error) {
    console.error(error);
    return res.render("signup", {
      error: "Server error. Please try again.",
      success: null
    });
  }
};

//load login page

export const loadLogin = async (req, res) => {
  try {
    res.render("login", { error: null });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};



//login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.render("user/login", { 
        error: "Email and password are required" 
      });
    }

//find users
 const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/login", { 
        error: "Invalid email or password" 
      });
    }

    //check if blocked or not

     if (user.isBlocked) {
      return res.render("user/login", { 
        error: "Your account has been blocked. Please contact support." 
      });
    }

 // Check if verified
    if (!user.isVerified) {
      return res.render("user/login", { 
        error: "Please verify your email first" 
      });
    }


     // Check if verified
    if (!user.isVerified) {
      return res.render("user/login", { 
        error: "Please verify your email" 
      });
    }

     //  session create
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    res.redirect("/");

  } catch (error) {
    console.error(error);
    res.render("user/login", { 
      error: "Server error. Please try again." 
    });
  }
};


// logout
export const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
        return res.redirect("/");
      }
      res.clearCookie('connect.sid');
      res.redirect("/login");
    });
  } catch (error) {
    console.error(error);
    res.redirect("/");
  }
};

//  forgot password page
export const loadForgotPassword = async (req, res) => {
  try {
    res.render("user/forgotPassword", { error: null, success: null });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

// forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgotPassword", { 
        error: "No account found with this email",
        success: null 
      });
    }

 //  reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();


// Send reset email
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: 'abhijiith@gmail.com',
      to: email,
      subject: 'Password Reset',
      html: 
      `<h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>`
    };

    await transporter.sendMail(mailOptions);

    res.render("user/forgotPassword", { 
      error: null,
      success: "Password reset link sent to your email" 
    });

  } catch (error) {
    console.error(error);
    res.render("user/forgotPassword", { 
      error: "Server error. Please try again.",
      success: null 
    });
  }
};


// reset password page
export const loadResetPassword = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.render("user/resetPassword", { 
        error: "Invalid or expired reset link",
        token: null 
      });
    }

    res.render("user/resetPassword", { error: null, token });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};



// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("user/resetPassword", { 
        error: "Passwords do not match",
        token 
      });
    }

    if (password.length < 6) {
      return res.render("user/resetPassword", { 
        error: "Password must be at least 6 characters",
        token 
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.render("user/resetPassword", { 
        error: "Invalid or expired reset link",
        token: null 
      });
    }


    // hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.redirect("/login?reset=success");

  } catch (error) {
    console.error(error);
    res.render("user/resetPassword", { 
      error: "Server error. Please try again.",
      token 
    });
  }
};


// export const loadSignup = (req,res)=>{
//     res.render("user/signup",{error:null});
// };
// 
