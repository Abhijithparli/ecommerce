
import User from "../models/userModel.js";

// check logg in and block status 

export const isAuthenticated = async(req,res,next)=>{
  try{
    if(!req.session || !req.session.user){
      return res.redirect("/login");
    }
    const user = await User.findById(req.session.user.id);

    // check block

    if(!user || user.isBlocked){
      delete req.session.user;
      return res.redirect("/login?error=blocked");
    }

 //  force to set password
    if (!user.password && req.path !== "/set-password") {
      return res.redirect("/set-password");
    }
    next();

  }catch(err){
    console.error("Auth middleware error:",err);
    res.redirect("/login");
  }
};

//guest check
export const isGuest = (req,res,next)=>{
  if(req.session && req.session.user){
    return res.redirect("/");
  }
  next();  
}