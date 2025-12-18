export const loadAdminLogin = async (req, res) => {
  try {
    res.render("admin/login", { error: null });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL = "admin@gmail.com";
    const ADMIN_PASSWORD = "12345";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      console.log("Redirecting to dashboard");
      return res.redirect("/admin/dashboard");
    }

    return res.render("admin/login", {
      error: "Invalid email or password",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

// export const loadlogin = async(req,res)=>{
//     try{
//          res.render("login");

//     }catch (error){
//         console.log("error")

//         console.log("admin page not found");
//         res.status(500).send("server error");

//     }

// }

// module.exports ={
//     loadlogin
// }
