const crypto = require('crypto');
const { promisify } = require('util'); //core node package
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

/** TODO: add password reset view
 * https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/learn/lecture/15087366#questions/14249130
 */

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  /** Save JWT into a secure cookie */
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000 //[days] * 24(hours) * 60(mins) * 60(secs) *1000 (to MS)
    ),
    httpOnly: true //cookie cannot be accessed or modified by the browser. To prevent cross-site-scripting attacks
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true; //cookie will only be sent if HTTPS is recognized
  }

  res.cookie('jwt', token, cookieOptions);

  /** Remove password from output */
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token, // pass token to client. Client needs to store it in storage or cookie for jwt verification
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // do not just simply send along the req.body. Instead only pass the minimal data in order to avoid a request to be modified witha new property, like 'admin: true'
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  /** 1. Check if email and password exist */
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  /** 2. Check if user exists && password is correct */
  //we need to manually include the password, because 'select' was set to false in the model
  const user = await User.findOne({ email }).select('+password');

  //correct password function is created in the user model
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  /** 3. If everything is OK, generate and send JWT token to client */
  // pass id to jwt to identify the user that needs to be logged in
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  // res.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now + 10 * 1000),
  //   httpOnly: true
  // });
  // req.cookie('jwt', 'null', {
  //   expires: new Date(Date.now() - 10 * 1000),
  //   httpOnly: true
  // });
  res.clearCookie('jwt');
  res.status(200).json({ status: 'success' });
};

/** Middleware function to handle protected routes. Not-logged-in users should not be allowed to access certain routes */
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  /** 1. Get the JWT token and check if it exists */
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  /** Also authenticate users that have a JWT cookie */
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in. Please log in to get access', 401)
    );
  }

  /** 2. Verify the JWT token */
  // make the verify function into a promise, so we can await it.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  /** 3. Check if user still exists
   * scenario: user might have been deleted in the meantime, but the token still exists
   */
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does no longer exist', 401)
    );
  }
  /** 4. Check if user changed password after the JWT was issued
   * scenario: token might be stolen by hacker. User quickly changes password, but we still need to verify against that
   */
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    //iat means Issued At
    return next(
      new AppError('User recently changed password. Please log in again!', 401)
    );
  }

  /** If everything was succesful. Grant access to protected rout */
  req.user = currentUser; //pass data from middleware on by appending it to the req
  res.locals.user = currentUser;
  next();
});

/** Only for rendered pages. Does not return errors */
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  const token = req.cookies.jwt;
  //check if token is found in cookies
  if (!token || token === 'loggedout') {
    return next();
  }
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);
  //check if user still exists
  if (!currentUser) {
    return next();
  }
  //check if password has changed after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next();
  }

  //No error was found. Send the user object along to the frontend
  res.locals.user = currentUser;

  next();
});

/** Middleware function for authorization for routes. Restrict based on provided roles */
exports.restrictTo = (...roles) => {
  //roles is array of roles
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    //if current user role is included in route roles, grant access to route by moving on to the next middleware in the middleware stack
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  /** 1. Get user based on POSTed email */
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address', 404));
  }

  /** 2. Generate random reset token */
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); //skip validators

  /** 3. Send it to the user email */
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/reset-password/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();
  } catch (err) {
    /** If email cannot be sent, catch the error. More importantly, reset the token and password expiry */
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Token sent to email'
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  /** 1. Get user based on the token sent along with the request */
  // token is sent along the URL params. Encrypt it, so it can be compared to the token applied to the user document
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // query DB. Find it based on the passwordResetToken
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() } // also check if token has expired right in the query
  });
  //if token has expired, it won't return a user anyway

  /** 2. If token has not expired (10 minutes) and if the user exists, set the new password */
  if (!user) {
    return next(new AppError('Token is invalid or has expired!', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.password;
  user.passwordResetToken = undefined; // remove property from document
  user.passwordResetExpires = undefined; // remove property from document
  /** For updating users, always use SAVE() instead of UPDATE(), because we want to run all user middlewares and run all validators */
  await user.save();

  /** 3. Update the changedPasswordAt property for the current user */
  // done through middleware. See usermodel

  /** 4. Log in the user. Send JWT */
  // If everything is OK, generate and send JWT token to client
  // pass id to jwt to identify the user that needs to be logged in
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //post should contain a body object holding: currentPassword, newPassword and newPasswordConfirm
  /** 1. Get user from collection */
  const user = await User.findById(req.user.id).select('+password'); //include password into output

  if (!user) {
    return next(new AppError('Could not find user', 404));
  }

  if (!req.body.currentPassword || !req.body.newPassword) {
    return next(
      new AppError(
        'Please provide your current password and a new password',
        400
      )
    );
  }

  /** 2. Check if POSTed password is correct. (ask user to provide current password and check if it's OK) */
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(
      new AppError('The current password you provided is incorrect', 401)
    );
  }

  /** 3. If password is correct. Update the password */
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  /** For updating users, always use SAVE() instead of UPDATE(), because we want to run all user middlewares and run all validators */
  await user.save();

  /** 4. Log the user in */
  createSendToken(user, 200, res);
});
