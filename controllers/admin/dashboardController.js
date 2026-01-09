export const loadDashboard = async (req, res) => {
  try {
    // Session is already checked by middleware, so just render
    console.log('Loading dashboard for admin:', req.session.admin.email);
    res.render("admin/dashboard");
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).send("Server error");
  }
};

//  console.log(error);
        
//         console.log("Home page not found");
//         res.status(500).send("server error");