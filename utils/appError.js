class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // for checking if fail/error is operational or programming or something else

    Error.captureStackTrace(this, this.constructor); //include stack trace into appError
  }
}

module.exports = AppError;
