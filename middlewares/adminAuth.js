// chek the admin login or not
export const isAdminAuthenticated = (req, res, next) => {
  if (req.session.admin) {
    return next();
  }
  res.redirect("/admin/login");
};

//  admin is already login or no 
export const isAdminGuest = (req, res, next) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  next();
};