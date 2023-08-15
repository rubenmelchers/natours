const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'Booking must belong to a tour']
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a user']
  },
  price: {
    type: Number,
    require: [true, 'A booking must have a price']
  },
  createdAt: {
    type: Date,
    default: Date.now()
  },
  // paid property might come in handy when inserting bookings outside the app. (directly in store for example)
  paid: {
    type: Boolean,
    default: true
  }
});

bookingSchema.pre(/^find/, async function(next) {
  this.populate({
    path: 'user'
  }).populate({
    path: 'tour',
    select: 'name'
  });
  next();
});

/** Create model Review based on schema */
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
