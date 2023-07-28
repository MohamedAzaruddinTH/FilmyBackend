const express = require("express");
const multer = require("multer");
const path = require("path");

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, "..", "uploads/user"));
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});

const {
  registerUser,
  LoginUser,
  LogoutUser,
  forgotPassword,
  resetPassword,
  getUserProfile,
  ChangePassword,
  updateProfile,
  addToWatchlist,
  removeFromWatchlist,
} = require("../controllers/authController");
const router = express.Router();

const {
  isAuthenticatedUser,
  authorizeRoles,
} = require("../midlewares/authenticate");

//Routes for authentication and user profile management
router.post("/register", upload.single("avatar"), registerUser);
router.post("/login", LoginUser);
router.get("/logout", LogoutUser);
router.post("/password/forgot", forgotPassword);
router.post("/password/reset/:token", resetPassword);
router.put("/password/change", isAuthenticatedUser, ChangePassword);
router.get("/myProfile", isAuthenticatedUser, getUserProfile);
router.put(
  "/update",
  isAuthenticatedUser,
  upload.single("avatar"),
  updateProfile
);
router.post("/watchlist/:movieId", isAuthenticatedUser, addToWatchlist);
router.delete("/watchlist/:movieId", isAuthenticatedUser, removeFromWatchlist);

module.exports = router;
