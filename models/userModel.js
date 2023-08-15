const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/** Create schema for model, defining properties */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name']
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email']
    },
    photo: {
      type: String,
      default: 'default.jpg'
    },
    role: {
      type: String,
      enum: ['user', 'guide', 'lead-guide', 'admin'],
      default: 'user'
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false //hide it from any output. We don't want any requests showing the password
    },
    passwordConfirm: {
      type: String,
      required: [true, 'Please confirm the password'],
      validate: {
        validator: function(val) {
          //`this` has access to the inputted object with all of its values.
          // this only points to current doc on NEW document creation. Not on updating
          return val === this.password; //the password confirmation must be exactly the same as the regular password
        },
        message: 'The passwords do not match!'
      }
    },
    passwordChangedAt: {
      type: Date
    },
    passwordResetToken: {
      type: String
    },
    passwordResetExpires: {
      type: Date
    },
    active: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  {
    toJSON: {
      virtuals: true
    },
    toObject: {
      virtuals: true
    }
  }
);

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next(); //if password has not been modified, just go to next

  this.password = await bcrypt.hash(this.password, 12); // 12 is the length of the salt
  this.passwordConfirm = undefined; //empty the passwordConfirm field so it's not persisted in the DB

  next();
});

/** pre-save hook to set the password changedat timestamp */
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next(); //if password has not been modified OR document was created new entirely, just go to next

  this.passwordChangedAt = Date.now() - 1000; // make sure to put the changedat property a bit earlier to be sure to set it earlier than the passwordToken
  next();
});

/** Query middleware */
userSchema.pre(/^find/, function(next) {
  /** this = current query */
  // get users that are true. Use the $ne (not equal) operator to also include users that do not have the active property
  this.find({ active: { $ne: false } });
  next();
});

/** Instance method - available on all User documents
 * Create function to check wether provided password (candidate) is correct. If so, a user is allowed to log in
 *
 * See authcontroller for usage
 * */
userSchema.methods.correctPassword = async function(
  candidatePassword, //a password provided
  userPassword //the encrypted password that's mapped to the user
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

/** Instance method
 * Check if user password has changed since the JWT token was issued
 */
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    ); //convert date to timestamp and then move from milliseconds to seconds
    return JWTTimestamp < changedTimeStamp; //returns true if password was changed since IAT (Issued At)
  }
  return false; //false meanse NOT changed
};

/** Instance method
 * Generate token for resetting password
 */
userSchema.methods.createPasswordResetToken = function() {
  // generate token to send to user to create a new password
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; //token expires in 10 minutes

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
