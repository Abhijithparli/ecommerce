import User from "../../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

// ================= EMAIL CONFIG (LAZY LOAD) =================
function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ================= OTP GENERATOR =================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ================= HOME =================
export const loadHomepage = async (req, res) => {
  try {
    res.render("user/home", { user: req.session.user || null });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

// ================= SIGNUP PAGE =================
export const loadSignup = (req, res) => {
  res.render("user/signup", { error: null, success: null });
};

// ================= SIGNUP =================
export const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    const name = `${firstName} ${lastName}`.trim();

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.render("user/signup", {
        error: "All fields are required",
        success: null,
      });
    }

    if (password !== confirmPassword) {
      return res.render("user/signup", {
        error: "Passwords do not match",
        success: null,
      });
    }

    if (password.length < 6) {
      return res.render("user/signup", {
        error: "Password must be at least 6 characters",
        success: null,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", {
        error: "Email already registered",
        success: null,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(otp)

    // Store in SESSION (not DB yet)
    req.session.tempUser = {
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpiry: otpExpiry.getTime(), // Store as timestamp
    };

    // Send OTP email
    try {
      const transporter = createTransporter(); // ✅ Create transporter here
      
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email - Headshield",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Headshield!</h2>
            <p>Your OTP for email verification is:</p>
            <h1 style="color: #ff6b47; letter-spacing: 5px; font-size: 36px;">${otp}</h1>
            <p>This OTP will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log("✅ OTP email sent successfully to:", email);
    } catch (mailError) {
      console.error("❌ Mail error:", mailError);
      return res.render("user/signup", {
        error: "Failed to send OTP email. Please try again.",
        success: null,
      });
    }

    // Redirect to OTP page
    res.render("user/otp", {
      email,
      error: null,
      success: "OTP sent to your email",
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.render("user/signup", {
      error: "Server error. Please try again.",
      success: null,
    });
  }
};

// ================= VERIFY OTP PAGE =================
export const loadVerifyOtp = (req, res) => {
  const tempUser = req.session.tempUser;
  const forgotEmail = req.session.forgotEmail;

  const email = tempUser?.email || forgotEmail;

  if (!email) {
    return res.redirect("/signup");
  }

  res.render("user/otp", { email, error: null, success: null });
};

// ================= VERIFY OTP (FIXED - SINGLE FUNCTION) =================
export const verifyOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!email || !otp) {
      return res.render("user/otp", {
        email: email || "",
        error: "Please enter OTP",
        success: null,
      });
    }

    // Check if this is SIGNUP flow or FORGOT PASSWORD flow
    const tempUser = req.session.tempUser;
    const forgotEmail = req.session.forgotEmail;

    // ========== SIGNUP FLOW ==========
    if (tempUser && tempUser.email === email) {
      // Verify OTP from session
      if (tempUser.otp !== otp) {
        return res.render("user/otp", {
          email,
          error: "Invalid OTP",
          success: null,
        });
      }

      // Check expiry
      if (Date.now() > tempUser.otpExpiry) {
        return res.render("user/otp", {
          email,
          error: "OTP expired. Please request a new one.",
          success: null,
        });
      }

      // OTP is valid - Save user to database
      const newUser = new User({
        name: tempUser.name,
        email: tempUser.email,
        password: tempUser.password,
        isVerified: true,
      });

      await newUser.save();

      // Clear session
      req.session.tempUser = null;

      console.log("✅ User verified and saved:", email);

      return res.redirect("/login");
    }

    // ========== FORGOT PASSWORD FLOW ==========
    if (forgotEmail === email) {
      const user = await User.findOne({ email });

      if (!user) {
        return res.render("user/otp", {
          email,
          error: "User not found",
          success: null,
        });
      }

      // Verify OTP from database
      if (user.otp !== otp) {
        return res.render("user/otp", {
          email,
          error: "Invalid OTP",
          success: null,
        });
      }

      // Check expiry
      if (new Date() > user.otpExpiry) {
        return res.render("user/otp", {
          email,
          error: "OTP expired",
          success: null,
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.otp = null;
      user.otpExpiry = null;

      await user.save();

      req.session.forgotEmail = null;

      console.log("✅ Password reset token generated for:", email);

      return res.redirect(`/reset-password/${resetToken}`);
    }

    // If neither flow matches
    return res.render("user/otp", {
      email,
      error: "Session expired. Please try again.",
      success: null,
    });

  } catch (error) {
    console.error("OTP verification error:", error);
    res.redirect("/signup");
  }
};

// ================= RESEND OTP =================
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    // Check if this is signup or forgot password flow
    const tempUser = req.session.tempUser;
    const forgotEmail = req.session.forgotEmail;

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // SIGNUP FLOW - Update session
    if (tempUser && tempUser.email === email) {
      req.session.tempUser.otp = otp;
      req.session.tempUser.otpExpiry = otpExpiry.getTime();
    }
    // FORGOT PASSWORD FLOW - Update database
    else if (forgotEmail === email) {
      const user = await User.findOne({ email });
      if (!user) {
        return res.json({ success: false, message: "User not found" });
      }
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    } else {
      return res.json({ success: false, message: "Session expired" });
    }

    // Send new OTP email
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "New OTP - Headshield",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New OTP Request</h2>
          <p>Your new OTP is:</p>
          <h1 style="color: #ff6b47; letter-spacing: 5px; font-size: 36px;">${otp}</h1>
          <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        </div>
      `,
    });

    console.log("✅ New OTP sent to:", email);

    res.json({ success: true, message: "New OTP sent successfully" });

  } catch (error) {
    console.error("Resend OTP error:", error);
    res.json({ success: false, message: "Failed to send OTP" });
  }
};

// ================= LOGIN =================
export const loadLogin = (req, res) => {
  res.render("user/login", { error: null });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("user/login", {
        error: "Email and password required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/login", {
        error: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.render("user/login", {
        error: "Invalid credentials",
      });
    }

    if (user.isBlocked) {
      return res.render("user/login", {
        error: "Your account has been blocked",
      });
    }

    // if (!user.isVerified) {
    //   return res.render("user/login", {
    //     error: "Please verify your email first",
    //   });
    // }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
    };

    console.log("✅ Login success:", user.email);

    res.redirect("/");

  } catch (error) {
    console.error("Login error:", error);
    res.render("user/login", { error: "Server error" });
  }
};

// ================= LOGOUT =================
export const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};

// ================= FORGOT PASSWORD =================
export const loadForgotPassword = (req, res) => {
  res.render("forgotpassword", { error: null, success: null });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("forgotpassword", {
        error: "Email not found",
        success: null,
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP - Headshield",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Your OTP for password reset is:</p>
          <h1 style="color: #ff6b47; letter-spacing: 5px; font-size: 36px;">${otp}</h1>
          <p>This OTP will expire in <strong>10 minutes</strong>.</p>
        </div>
      `,
    });

    req.session.forgotEmail = email;

    console.log("✅ Password reset OTP sent to:", email);

    res.render("user/otp", {
      email,
      error: null,
      success: "OTP sent to your email",
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.render("forgotpassword", {
      error: "Server error",
      success: null,
    });
  }
};

// ================= RESET PASSWORD =================
export const loadResetPassword = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("user/resetPassword", {
        error: "Invalid or expired link",
        token: null,
      });
    }

    res.render("user/resetPassword", { error: null, token });

  } catch (error) {
    console.error(error);
    res.redirect("/forgot-password");
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("user/resetPassword", {
        error: "Passwords do not match",
        token,
      });
    }

    if (password.length < 6) {
      return res.render("user/resetPassword", {
        error: "Password must be at least 6 characters",
        token,
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("user/resetPassword", {
        error: "Invalid or expired token",
        token: null,
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;

    await user.save();

    console.log("✅ Password reset successful for:", user.email);

    res.redirect("/login");

  } catch (error) {
    console.error("Reset password error:", error);
    res.render("user/resetPassword", {
      error: "Server error",
      token: null,
    });
  }
};