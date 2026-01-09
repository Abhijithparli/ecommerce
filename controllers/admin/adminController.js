import User from "../../models/userModel.js";

// Load admin login page
export const loadAdminLogin = async (req, res) => {
  try {
    res.render("admin/login", { error: null });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

// Admin login logic
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL = "admin@gmail.com";
    const ADMIN_PASSWORD = "12345";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Create admin session
      req.session.admin = {
        email: ADMIN_EMAIL,
        isAdmin: true,
        loginTime: new Date()
      };
      
      // Save session before redirecting
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.render("admin/login", {
            error: "Session error. Please try again."
          });
        }
        console.log("Admin logged in, session created");
        return res.redirect("/admin/dashboard");
      });
    } else {
      return res.render("admin/login", {
        error: "Invalid email or password"
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

// Admin logout
export const adminLogout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.redirect("/admin/dashboard");
      }
      res.clearCookie('connect.sid'); // Clear session cookie
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};