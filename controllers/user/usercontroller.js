import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";


// EMAIL:
// ==================================
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendMail(to, subject, html) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Headshield" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

function otpTemplate(otp) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;
                background:#0a0a0f;color:#e5e5e5;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:26px;letter-spacing:3px;">HEADSHIELD</h1>
      </div>
      <div style="padding:36px;">
        <p style="color:#9ca3af;font-size:15px;">Your OTP code:</p>
        <div style="background:#13131a;border:2px solid #f97316;border-radius:10px;
                    padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:38px;font-weight:700;letter-spacing:10px;color:#f97316;">
            ${otp}
          </span>
        </div>
        <p style="color:#6b7280;font-size:13px;">
          Expires in <strong style="color:white;">10 minutes</strong>. 
          If you didn't request this, ignore this email.
        </p>
      </div>
    </div>
  `;
}


// otp generator
// ================================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


// multer — profile image upload
// =================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/profiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.session.user.id}-${Date.now()}${ext}`);
  },
});

export const uploadProfileImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG or WEBP allowed"), false);
    }
    cb(null, true);
  },
});


// home
// =====================================
export const loadHomepage = (req, res) => {
  res.render("user/home", { user: req.session.user || null });
};


// signup
// =====================================
export const loadSignup = (req, res) => {
  res.render("user/signup", { error: null, success: null });
};

export const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    const name = `${firstName} ${lastName}`.trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.render("user/signup", { error: "All fields are required", success: null });
    }
    if (password !== confirmPassword) {
      return res.render("user/signup", { error: "Passwords do not match", success: null });
    }
    if (password.length < 6) {
      return res.render("user/signup", { error: "Password must be at least 6 characters", success: null });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", { error: "Email already registered", success: null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    console.log("Signup OTP:", otp);

    req.session.tempUser = { name, email, password: hashedPassword, otp, otpExpiry };

    await sendMail(email, "Verify your email - Headshield", otpTemplate(otp));

    res.render("user/otp", { email, error: null, success: "OTP sent to your email" });
  } catch (error) {
    console.error("Signup error:", error);
    res.render("user/signup", { error: "Server error. Please try again.", success: null });
  }
};


// otp verify
// ==========================================
export const loadVerifyOtp = (req, res) => {
  const email = req.session.tempUser?.email || req.session.forgotEmail;
  if (!email) return res.redirect("/signup");
  res.render("user/otp", { email, error: null, success: null });
};

export const verifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;
    const tempUser = req.session.tempUser;
    const forgotEmail = req.session.forgotEmail;

    // SIGNUP FLOW============

    if (tempUser && tempUser.email === email) {
      if (tempUser.otp !== otp) {
        return res.render("user/otp", { email, error: "Invalid OTP", success: null });
      }
      if (Date.now() > tempUser.otpExpiry) {
        return res.render("user/otp", { email, error: "OTP expired. Request a new one.", success: null });
      }
      await User.create({
        name: tempUser.name,
        email: tempUser.email,
        password: tempUser.password,
        isVerified: true,
      });
      req.session.tempUser = null;
      return res.redirect("/login");
    }

    // FORGOT PASSWORD FLOW==========

   if (user && user.isBlocked) {
  return done(null, false, { message: "User is blocked" });
      if (!user) return res.render("user/otp", { email, error: "User not found", success: null });
      if (user.otp !== otp) return res.render("user/otp", { email, error: "Invalid OTP", success: null });
      if (new Date() > user.otpExpiry) return res.render("user/otp", { email, error: "OTP expired", success: null });

      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.otp = null;
      user.otpExpiry = null;
      await user.save();
      req.session.forgotEmail = null;
      return res.redirect(`/reset-password/${resetToken}`);
    }

    res.render("user/otp", { email, error: "Session expired. Try again.", success: null });
  } catch (error) {
    console.error("OTP error:", error);
    res.redirect("/signup");
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    if (req.session.tempUser?.email === email) {
      req.session.tempUser.otp = otp;
      req.session.tempUser.otpExpiry = otpExpiry;
    } else if (req.session.forgotEmail === email) {
      const user = await User.findOne({ email });
      if (!user) return res.json({ success: false, message: "User not found" });
      user.otp = otp;
      user.otpExpiry = new Date(otpExpiry);
      await user.save();
    } else {
      return res.json({ success: false, message: "Session expired" });
    }

    await sendMail(email, "New OTP - Headshield", otpTemplate(otp));
    console.log("Resent OTP:", otp);
    res.json({ success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.json({ success: false, message: "Failed to send OTP" });
  }
};


// login
// =======================================
export const loadLogin = (req, res) => {
  
  res.render("user/login", { error: null });
};


export const login = async (req, res) => {
  
  try {
    const { email, password } = req.body;


    if (!email || !password) {
      return res.render("user/login", { error: "Email and password required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/login", { error: "Invalid credentials" });
    }

    if (user.isBlocked) {
      return res.render("user/login", { 
        error: "Your account has been blocked by admin" 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
  
    if (!isMatch) {
      return res.render("user/login", { error: "Invalid credentials" });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email
    };

    req.session.save(() => {
      res.redirect("/");
    });

  } catch (error) {
    console.error("Login error:", error);
    res.render("user/login", { error: "Server error" });
  }
};

export const logout = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};


// forgotpassword
// =============================================
export const loadForgotPassword = (req, res) => {
  res.render("user/forgotPassword", { 
    error: null, 
    message: null   
  });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgotPassword", { error: "No account found with this email", success: null });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    console.log("Forgot password OTP:", otp);
    await sendMail(email, "Password Reset OTP - Headshield", otpTemplate(otp));
    req.session.forgotEmail = email;

    res.render("user/otp", { email, error: null, success: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.render("user/forgotPassword", { error: "Server error. Please try again.", success: null });
  }
};


// reset password
// ====================================================
export const loadResetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpiry: { $gt: Date.now() },
    });
    if (!user) return res.render("user/resetPassword", { error: "Invalid or expired link", token: null });
    res.render("user/resetPassword", { error: null, token: req.params.token });
  } catch (error) {
    console.error(error);
    res.redirect("/forgot-password");
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const { token } = req.params;

    if (password !== confirmPassword) {
      return res.render("user/resetPassword", { error: "Passwords do not match", token });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) return res.render("user/resetPassword", { error: "Invalid or expired token", token: null });

const hashedPassword = await bcrypt.hash(password, 10);
user.password = hashedPassword;

await user.save();

// console.log(" Password updated correctly");

// console.log(" Password updated in DB");

    res.redirect("/login");
  } catch (error) {
    console.error("Reset password error:", error);
    res.render("user/resetPassword", { error: "Server error", token: null });
  }
};


// Profile— view
// ===============================================
export const loadProfile = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.session.user.id);

    res.render("user/profile", { user });

  } catch (error) {
    console.error(error);
    res.redirect("/login");
  }
};

// Profile — Edit 
// ==================================================
export const loadEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render("user/editprofile", { user });
  } catch (error) {
    console.error(error);
    res.redirect("/login");
  }
};


// P — Edit 
// ================================================
export const editProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect("/login");

    const { firstName, lastName, phone, dob, gender } = req.body;

    // name validation
    if (!/^[A-Za-z\s]{3,50}$/.test(firstName)) {
      return res.render("user/editProfile", {
        user,
        error: "Name must be 3–50 letters only"
      });
    }

    // phone validation
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.render("user/editProfile", {
        user,
        error: "Invalid phone number"
      });
    }

    // data save
    user.name = `${firstName.trim()} ${(lastName || "").trim()}`.trim();
    if (phone) user.phone = phone.trim();
    if (dob) user.dob = new Date(dob);
    if (gender) user.gender = gender;

    //  image upload
    if (req.file) {
      if (user.profileImage && user.profileImage.startsWith("/uploads/")) {
        const oldPath = `public${user.profileImage}`;
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();

    req.session.user.name = user.name;
    req.session.profileSuccess = "Profile updated successfully";

    res.redirect("/profile");

  } catch (error) {
    console.error("Edit profile error:", error);
    const user = await User.findById(req.session.user.id);
    res.render("user/editProfile", {
      user,
      error: "Server error"
    });
  }
};


// email change
// =================================================
export const loadEditEmail = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render("user/editEmail", { user, step: 1, newEmail: null, error: null, success: null });
  } catch (error) {
    res.redirect("/profile");
  }
};

// ============================================
// email change — send OTP to new email
// ============================================================
export const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const user = await User.findById(req.session.user.id);

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
      return res.render("user/editEmail", { user, step: 1, newEmail: null, error: "Enter a valid email", success: null });
    }
    if (newEmail === user.email) {
      return res.render("user/editEmail", { user, step: 1, newEmail: null, error: "This is already your current email", success: null });
    }

    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      return res.render("user/editEmail", { user, step: 1, newEmail: null, error: "Email already in use by another account", success: null });
    }

    const otp = generateOTP();
    console.log("Email change OTP:", otp);

    req.session.emailChange = {
      newEmail,
      otp,
      otpExpiry: Date.now() + 10 * 60 * 1000,
    };

    await sendMail(newEmail, "Verify your new email - Headshield", otpTemplate(otp));

    res.render("user/editEmail", { user, step: 2, newEmail, error: null, success: "OTP sent to new email" });
  } catch (error) {
    console.error("Email change error:", error);
    const user = await User.findById(req.session.user.id);
    res.render("user/editEmail", { user, step: 1, newEmail: null, error: "Server error", success: null });
  }
};

// ====================================================
// EMAIL CHANGE —  verify OTP and save new email
// ============================================================
export const verifyEmailOtp = async (req, res) => {
  try {
    const { otp, newEmail } = req.body;
    const user = await User.findById(req.session.user.id);
    const emailChange = req.session.emailChange;

    if (!emailChange || emailChange.newEmail !== newEmail) {
      return res.render("user/editEmail", { user, step: 2, newEmail, error: "Session expired. Start again.", success: null });
    }
    if (emailChange.otp !== otp) {
      return res.render("user/editEmail", { user, step: 2, newEmail, error: "Invalid OTP", success: null });
    }
    if (Date.now() > emailChange.otpExpiry) {
      return res.render("user/editEmail", { user, step: 2, newEmail, error: "OTP expired. Request a new one.", success: null });
    }

    user.email = newEmail;
    await user.save();
    req.session.user.email = newEmail;
    req.session.emailChange = null;
    req.session.profileSuccess = "Email updated successfully";
    res.redirect("/profile");
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.redirect("/profile/edit-email");
  }
};

// ===========================
// EMAIL CHANGE — Resend OTP
// ============================================================
export const resendEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!req.session.emailChange) return res.json({ success: false, message: "Session expired" });

    const otp = generateOTP();
    req.session.emailChange.otp = otp;
    req.session.emailChange.otpExpiry = Date.now() + 10 * 60 * 1000;

    await sendMail(newEmail, "New OTP - Headshield", otpTemplate(otp));
    console.log("Resent email change OTP:", otp);
    res.json({ success: true });
  } catch (error) {
    console.error("Resend email OTP error:", error);
    res.json({ success: false, message: "Failed to resend OTP" });
  }
};

// =====================
// CHANGE PASSWORD
// ============================================================
export const loadChangePassword = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render("user/changePassword", { user, error: null, success: null });
  } catch (error) {
    res.redirect("/profile");
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.session.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render("user/changePassword", {
        user,
        error: "Current password is incorrect",
        success: null
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render("user/changePassword", {
        user,
        error: "Passwords do not match",
        success: null
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    user.password = newHash;

    await user.save();

    req.session.destroy(() => {
      res.redirect("/login");
    });

  } catch (error) {
    res.redirect("/profile");
  }
};
// =======================
// address — view all
// ============================================================
export const loadAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const success = req.session.addressSuccess || null;
    req.session.addressSuccess = null;
    res.render("user/addresses", {
  user,
  addresses: user.addresses || [],
  error : null,
  success
});
  } catch (error) {
    console.error(error);
    res.redirect("/profile");
  }
};

// ===================
// ADDRESSES — Add
// ============================================================
export const addAddress = async (req,res)=>{
  try{

    const {name,phone, street,city,state,pincode,country,type,isDefault} = req.body;
    
     const user = await User.findById(req.session.user.id); 

    //check is empty or not
    if (!name || !phone || !street || !city||!state||!pincode){
      req.session.error = "All fields are required";
      return res.redirect("/profile/addresses");
    }

    //name validation 
    if(!/^[A-Za-z\s]{3,50}$/.test(name.trim())) {
      req.session.error = "Name must contain only letters (3-50 chars)";
      return res.redirect("/profile/addresses");
    }
    //phone validtion
    if(!/^[6-9]\d{9}$/.test(phone.trim())) {
      req.session.error = "invalid phone number";
      return res.redirect("/profile/addresses");
    }

    //street validation
    if(street.trim().length < 5){
      req.session.error = "street must be at least 5 characters";
      return res.redirect("/profile/addresses");
    }
    //city validation
    if(!/^[A-Za-z\s]{3,50}$/.test(city.trim())) {
      req.session.error = "invalid city";
      return res.redirect("/profile/addresses") 
    }
    
    // state validation
    if (!/^[A-Za-z\s]{3,50}$/.test(state.trim())) {
      req.session.error = "Invalid state";
      return res .redirect("/profile/addresses");
    }

    const newAddr = {
      name: name.trim(),
      phone: phone.trim(),
      street:street.trim(),
      city: city.trim(),
      state :state.trim(),
      pincode:pincode.trim(),
      country:country || "India",
      type : type||"Home",
      isDefault: isDefault === "on",
    };

    //default logic
    if(newAddr.isDefault){
      user.addresses.forEach(a=> a.isDefault = false);
    }
    if(user.addresses.length === 0){
      newAddr.isDefault = true;
    }

    user.addresses.push(newAddr);
    await user.save();

    req.session.success = "Address added successfully";
    res.redirect("/profile/addresses");
  
  }catch(error){
    console.error("Add address error:",error);
    req.session.error = "something went wrong";
    res.redirect("/profile/addresses");
  }
};

// EDIT ADDRESS 
export const loadEditAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const address = user.addresses.id(req.params.id);

    if (!address) return res.redirect("/profile/addresses");

    res.render("user/editAddress", { address });

  } catch (error) {
    res.redirect("/profile/addresses");
  }
};

// ==================
// ADDRESSES — Edit
// ============================================================
export const editAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect("/login");

    const addr = user.addresses.id(req.params.id);
    if (!addr) {
      req.session.addressError = "Address not found";
      return res.redirect("/profile/addresses");
    }

    const { name, phone, street, city, state, pincode, country, type, isDefault } = req.body;

    addr.name = name;
    addr.phone = phone;
    addr.street = street;
    addr.city = city;
    addr.state = state;
    addr.pincode = pincode;
    addr.country = country || "India";
    addr.type = type || "Home";

    if (isDefault === "on") {
      user.addresses.forEach(a => a.isDefault = false);
      addr.isDefault = true;
    }

    await user.save();

    req.session.addressSuccess = "Address updated";
    res.redirect("/profile/addresses");

  } catch (err) {
    console.error(err);
    req.session.addressError = "Update failed";
    res.redirect("/profile/addresses");
  }
};

// ======================
// ADDRESSES — Delete
// ============================================================
export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const addr = user.addresses.id(req.params.id);
    const wasDefault = addr?.isDefault;

    user.addresses.pull(req.params.id);

    // If deleted address was default, make first remaining one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    req.session.addressSuccess = "Address deleted";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Delete address error:", error);
    res.redirect("/profile/addresses");
  }
};

// ==============================
// addressess — Set Default
// ============================================================
export const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    user.addresses.forEach((a) => {
      a.isDefault = a._id.toString() === req.params.id;
    });
    await user.save();
    req.session.addressSuccess = "Default address updated";
    res.redirect("/profile/addresses");
  } catch (error) {
    console.error("Set default error:", error);
    res.redirect("/profile/addresses");
  }
};

// ============================================================
// SET PASSWORD
// ============================================================
export const loadSetPassword = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (user.password) {
      return res.redirect("/");
    }
    res.render("user/setPassword", { error: null });
  } catch (error) {
    console.error("Load set password error:", error);
    res.redirect("/");
  }
};

export const savePassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    const user = await User.findById(req.session.user.id);

    if (user.password) {
      return res.redirect("/");
    }

    if (!password || !confirmPassword) {
      return res.render("user/setPassword", { error: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.render("user/setPassword", { error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.render("user/setPassword", { error: "Password must be at least 6 characters" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.redirect("/");
  } catch (error) {
    console.error("Save password error:", error);
    res.render("user/setPassword", { error: "Server error" });
  }
};
