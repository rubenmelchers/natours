const mongoose = require('mongoose');
const Tour = require('./tourModel');

// review text, rating, createdAt, ref to tour, ref to user ( 2 parent references)
const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty!']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now()
    },
    tour:
      //referenced (normalized) data
      {
        type: mongoose.Schema.ObjectId, //set the type to a MongoDB ID
        ref: 'Tour', //set the reference to the User model. It doesn't have to be imported
        required: [true, 'Review must belong to a tour.']
      },
    user: {
      //referenced (normalized) data
      type: mongoose.Schema.ObjectId, //set the type to a MongoDB ID
      ref: 'User', //set the reference to the User model. It doesn't have to be imported
      required: [true, 'Review must belong to a user']
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

/** Only allow 1 review per user on a tour. A user may not have multiple reviews on a single tour */
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function(next) {
  //   this.populate({
  //     path: 'tour',
  //     select: 'name'
  //   });
  this.populate({
    path: 'user',
    select: 'name photo'
  });
  next();
});

/** Calculate and set the average rating. Update the corresponding tour when a rating is added */
reviewSchema.statics.calcAverageRatings = async function(tourId) {
  //this = current model
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour', //group reviews by tour ID
        nRating: { $sum: 1 }, //add 1 for each review/rating found
        avgRating: { $avg: '$rating' } //calculate average rating based on the rating field from the review
      }
    }
  ]);

  if (stats && stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: stats[0].avgRating,
      ratingsQuantity: stats[0].nRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: 0,
      ratingsQuantity: 4.5
    });
  }
};

/** After creating a new review, update the corresponding tour rating (average and quantity) */
reviewSchema.post('save', function() {
  //this = document currently being saved; current review
  //this.constructor = the model that corresponds to the document
  this.constructor.calcAverageRatings(this.tour); // normally, we'd use Review.calcAverageRatings, but Review does not exist yet
});

/** After updating or deleting a review, update the corresponding tour rating (average and quantity) */
reviewSchema.pre(/^findOneAnd/, async function(next) {
  /** Bind the review document to this so it can be passed along to the .post function */
  this._review = await this.findOne();
  next();
});

reviewSchema.post(/^findOneAnd/, async function(doc) {
  /** Use the review document passed from the .pre function and run the calcAverageRatings function to update the rating properties */
  // await this.constructor.calcAverageRatings(this._review.tour);
  //we cannot use this.findOne here, because the query has already executed at this point in the .post

  if (doc) {
    await doc.constructor.calcAverageRatings(doc.tour._id);
  }
});

/** Create model Review based on schema */
const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
