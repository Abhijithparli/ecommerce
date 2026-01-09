export const isUserAuthenticated = (req,res,next)=>{
    if(req.session.user){
        return next();
    }
    res.redirect("/login");
};

export const isUserGuest = (req,res,next)=>{
    if(req.session.user){
        return res.redirect("/");
    }
    next();
}