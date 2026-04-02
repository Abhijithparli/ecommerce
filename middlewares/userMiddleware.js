export const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.redirect("/login");
};

export const isGuest = (req, res, next) => {
  if (req.session && req.session.user) return res.redirect("/");
  next();
};