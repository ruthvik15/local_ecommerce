const { validatetoken } = require("../utils/auth");

function checkcookie(cookie) {
  return (req, res, next) => {
    const cookieValue = req.cookies[cookie];
    if (!cookieValue) {
      res.locals.user = null;
      return next();
    }
    try {
      const payload = validatetoken(cookieValue);
      req.user = payload;
      res.locals.user = payload; // 🔥 This makes it available in all EJS files
    } catch (error) {
      req.user = null;
      res.locals.user = null;
    }
    return next();
  };
}

module.exports = {
  checkcookie
};
