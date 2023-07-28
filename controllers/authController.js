const catchAsyncError = require("../midlewares/catchAsyncError");
const User = require("../models/userModel");
const sendEmail = require("../utils/email");
const ErrorHandler = require("../utils/errorHandler");
const sendToken = require("../utils/jwt");
const crypto = require("crypto");

//Register User - /api/v1/register
exports.registerUser = catchAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;

  let avatar;

  let BASE_URL = process.env.BACKEND_URL;
  if (process.env.NODE_ENV === "production") {
    BASE_URL = `${req.protocol}://${req.get("host")}`;
  }

  if (req.file) {
    avatar = `${BASE_URL}/uploads/user/${req.file.originalname}`;
  }

  const user = await User.create({
    name,
    email,
    password,
    avatar,
  });

  sendToken(user, 201, res);
});

//Login User - /api/v1/login
exports.LoginUser = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ErrorHandler("please enter email & password", 400));
  }
  // finding the user from Database
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }
  if (!(await user.isValidPassword(password))) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }
  sendToken(user, 201, res);
});

//Logout - /api/v1/logout
exports.LogoutUser = (req, res, next) => {
  res
    .cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .status(200)
    .json({
      success: true,
      message: "loggedout successfully",
    });
};

//Forgot Password - /api/v1/password/forgot
exports.forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHandler("User not found with this email", 404));
  }

  const resetToken = user.getResetToken();
  await user.save({ validateBeforeSave: false });

  let BASE_URL = process.env.FRONTEND_URL;
  if (process.env.NODE_ENV === "production") {
    BASE_URL = `${req.protocol}://${req.get("host")}`;
  }

  //create reset url
  const resetUrl = `${BASE_URL}/password/reset/${resetToken}`;

  const message = `Your password reset url is as follows \n\n ${resetUrl}
     \n\n If you have not requested this email, then ignore it. `;

  try {
    sendEmail({
      email: user.email,
      subject: "Filmy password Recovery",
      message,
    });

    res.status(200).json({
      success: true,
      message: `email sent to ${user.email}`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message), 500);
  }
});

// reset Password -> /api/v1/password/reset/:token
exports.resetPassword = catchAsyncError(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordTokenExpire: {
      $gt: Date.now(),
    },
  });
  if (!user) {
    return next(
      new ErrorHandler("Password reset token is invalid or expired", 400)
    );
  }
  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Confirm password doesn't match"));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordTokenExpire = undefined;
  await user.save({ validateBeforeSave: false });

  sendToken(user, 201, res);
});

// Get User Profile - api/v1/myProfile
exports.getUserProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user,
  });
});

//Change Password -/api/v1/password/change
exports.ChangePassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check old password
  if (!(await user.isValidPassword(req.body.oldPassword))) {
    return next(new ErrorHandler("Old password is incorrect", 401));
  }
  //assigning new password
  user.password = req.body.password;
  await user.save();
  res.status(200).json({
    success: true,
  });
});

// Update Profile
exports.updateProfile = catchAsyncError(async (req, res, next) => {
  let newUserData = {
    name: req.body.name,
    email: req.body.email,
  };
  let avatar;
  let BASE_URL = process.env.BACKEND_URL;
  if (process.env.NODE_ENV === "production") {
    BASE_URL = `${req.protocol}://${req.get("host")}`;
  }

  if (req.file) {
    avatar = `${BASE_URL}/uploads/user/${req.file.originalname}`;
    newUserData = { ...newUserData, avatar };
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    success: true,
    user,
  });
});

// Add Movie to Watchlist - /api/v1/watchlist/:movieId
exports.addToWatchlist = catchAsyncError(async (req, res, next) => {
  const { movieId } = req.params;
  try {
    const user = await User.findById(req.user.id);
    // Check if the movie is already in the watchlist
    const existingMovie = user.watchlist.find(
      (movie) => movie.movieId.toString() === movieId
    );
    if (existingMovie) {
      return next(
        new ErrorHandler("Movie already exists exist in watchlist", 400)
      );
    }

    // Add the movie to the user's watchlist
    user.watchlist.push({ movieId });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Movie added to Watchlist",
      watchlist: user.watchlist,
    });
  } catch (error) {
    next(error);
  }
});

// Remove Movie from Watchlist - /api/v1/watchlist/:movieId
exports.removeFromWatchlist = catchAsyncError(async (req, res, next) => {
  const { movieId } = req.params;
  try {
    const user = await User.findById(req.user.id);
    // Find the index of the movie in the watchlist
    const movieIndex = user.watchlist.findIndex(
      (movie) => movie.movieId.toString() === movieId
    );
    if (movieIndex === -1) {
      return next(new ErrorHandler("Movie does not exist in watchlist", 400));
    }
    // Remove the movie from the watchlist
    user.watchlist.splice(movieIndex, 1);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Movie removed from watchlist",
      watchlist: user.watchlist,
    });
  } catch (error) {
    next(error);
  }
});
