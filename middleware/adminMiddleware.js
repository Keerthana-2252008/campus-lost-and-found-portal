
const adminMiddleware = (req, res, next) => {
  // Check whether the user is logged in
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Please login first."
    });
  }

  // Check whether the logged-in user is an admin
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required."
    });
  }

  next();
};

module.exports = adminMiddleware;
