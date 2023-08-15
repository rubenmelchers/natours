const multer = require('multer'); //package for handling file uploads on forms
const sharp = require('sharp'); //image processing library for NodeJS. Handy for resizing
const factory = require('./handlerFactory');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/** Storage will configure the filename and destination */
// const multerStorage = multer.diskStorage({
//   destination: (req, file, callback) => {
//     callback(null, 'public/img/users');
//   },
//   filename: (req, file, callback) => {
//     const ext = file.mimetype.split('/')[1];
//     callback(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   }
// });
const multerStorage = multer.memoryStorage(); //store image in memory temporarily instead of storage, so we can process it (resizing). We'll save it afterwards

/** Filter will test if the uploaded file really is an image. If true, continue. If false, pass an error */
const multerFilter = (req, file, callback) => {
  if (file.mimetype.startsWith('image')) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        'Uploaded file is not an image! Please only upload images',
        400
      ),
      false
    );
  }
};
//8F874C
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

/** Middleware for resizing user avatar. Middleware runs on every user update request */
/* Example for uploading to S3 bucket: https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/learn/lecture/15087354#questions/8735090 */
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  // if no photo is uploaded, stop the function
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // get file from memory (buffer)
  await sharp(req.file.buffer)
    .resize(500, 500) //Resize it to square
    .toFormat('jpeg') //transform extension to a jpeg
    .jpeg({ quality: 90 }) //reduce quality to lower filesize
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

/** Take an object and reduce the unneeded keys. Only keep the allwowed fields */
const filterObj = (object, ...allowedFields) => {
  const newObj = {};

  Object.keys(object).forEach(key => {
    if (allowedFields.includes(key)) {
      newObj[key] = object[key];
    }
  });
  return newObj;
};

exports.updateCurrentUser = catchAsync(async (req, res, next) => {
  /** 1. Create error if user POSTs password data */
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not meant for password updates. Please use /update-password',
        400
      )
    );
  }

  /** 2. Filter out unwanted fieldnames that are not allowed to be updated, such as ROLE */
  const body = filterObj(req.body, 'name', 'email');

  /** If a file is found inside the request, also set the photo property to the filename */
  if (req.file) {
    body.photo = req.file.filename;
  }
  /** 3. Update user document */
  const updatedUser = await User.findByIdAndUpdate(req.user._id, body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteCurrentUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined. Please use /sign-up instead'
  });
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
