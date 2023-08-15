const AppError = require('../utils/appError');

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  //create array from objects found in err.errors
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again', 401);

const sendErrorDev = (err, req, res) => {
  /** If the API is called, but gives an error. Return the error in JSON format */
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  console.error('ERROR', err);
  /** IF NOT /API error: return an actual rendered error page instead */
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message
  });
};

const sendErrorProd = (err, req, res) => {
  /** If the API is called, but gives an error. Return the error in JSON format */
  if (req.originalUrl.startsWith('/api')) {
    if (err.isOperational) {
      //Operational/trusted error. Show message to client
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
    //programming or other unknown error
    console.error('ERROR', err);
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }

  /** IF NOT /API error: return an actual rendered error page instead */
  res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.isOperational ? err.message : 'Please try again later'
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  }
  if (process.env.NODE_ENV === 'production') {
    // let error = { ...err };
    let error = Object.assign(err);
    error.name = err.name;
    error.code = err.code;
    error.message = err.message;

    if (error.name === 'CastError') {
      //in the case of a CastError, we know an incorrect value is trying to be put into a field (eg. string into a number field). Throw an operational error
      error = handleCastErrorDB(error);
    }
    if (error.code === 11000) {
      //a post request was made with a duplicate field
      error = handleDuplicateFieldsDB(error);
    }
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }
    sendErrorProd(error, req, res);
  }
  // next();
};
