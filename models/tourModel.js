const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');
// const User = require('./userModel');

/** Create schema for model, defining properties */
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [50, 'A tour name cannot be longer than 50 characters'],
      minlength: [5, 'A tour name cannot be shorter than 5 characters']
      // validate: [
      //   validator.isAlpha,
      //   'A tour name must only contain alpha characters'
      // ]
    },
    slug: {
      type: String
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'], //only allow 3 options}
        message: 'Difficulty is either: easy, medium or difficult' //the validator error message
      }
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [0.1, 'Rating must be 0.1 or higher'],
      max: [5, 'Rating must be 5 or lower'],
      set: val => Math.round(val * 10) / 10
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price']
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          //`this` has access to the inputted object with all of its values.
          // this only points to current doc on NEW document creation. Not on updating
          return val < this.price; //the discount must be lower than the tour price
        },
        message: 'Discount price ({VALUE}) must be below regular price'
      }
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false // hide it from the results
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //embedded document - GeoJSON (DENORMALIZED DATA)
      type: {
        type: String,
        default: 'Point', //options: point, line or polygon
        enum: ['Point']
      },
      coordinates: [Number], //an array of numbers
      address: String,
      description: String
    },
    locations: [
      //array of embeded documents - GeoJSON (DENORMALIZED DATA)
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ],
    //guides: Array //example for embedded (denormalized) data
    guides: [
      //referenced (normalized) data
      {
        type: mongoose.Schema.ObjectId, //set the type to a MongoDB ID
        ref: 'User' //set the reference to the User model. It doesn't have to be imported
      }
    ]
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

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' }); //index startLocation to a 2dsphere in order for it to understand latLng coordinates on a world sphere
/**
 * Create a virtual property that doesn't have to be filled out when creating the document
 * Generate it by calculating the amount of weeks by dividing the total amount of days by 7
 * Note that durationWeeks cannot be queried as it's not persisted in the DB
 */
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

/**
 * Virtual populate the reviews to the tour.
 * A tour does not know about its reviews (not referenced). We can map these to eachother through virtual population
 */
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', //the model property of the connecting Review model that identifies the tour
  localField: '_id' // the local field _id from the tour model will reference the id from the tour used from the foreignField
});

/**
 * Document middleware
 * middleware that can act on the currently processed document
 *
 * pre = runs before an event
 * post = runs after an event
 */
tourSchema.pre('save', function(next) {
  //do not use arrow functions in order to preserve `this`. `this` now references to the currently executing document
  //runs before the .save and .create command
  this.slug = slugify(this.name, { lower: true }); //add a slug to the document based on the tour title
  next();
});

/** EMBEDDING (denormalize) EXAMPLE - Replace tour guide IDs with the actual user documents */
/** this.guides is an array of user IDs at the start of the function */
// tourSchema.pre('save', async function(next) {
//   const guidesPromises = this.guides.map(
//     async guideId => await User.findById(guideId)
//   );
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

//post middleware function has access to the document after its saved to the DB through the doc variable
// tourSchema.post('save', function(doc, next) {
//   console.log(doc);
//   next();
// });

/**
 * Query middleware
 * Case: hide some 'secret' tours that should only be available for VIPS or special guests
 */

// tourSchema.pre('find', function(next) {
tourSchema.pre(/^find/, function(next) {
  //regex: target all hooks that start with "find": find, findOne, findOneAndDelete, etc
  //before a find query is executed, chain another .find that is run first
  this.find({ secretTour: { $ne: true } }); //only find tours that are not secret. Don't query for `false` in order to also handle tours that do not have the secretTour property yet

  // set a timer to check the execution time for the function
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt' //omit __v and passwordChangedAt fields from the results
  });
  next();
});

/** Has access to all documents that are found from the query */
// tourSchema.post(/^find/, function(docs, next) {
//   console.log(`Query took ${Date.now() - this.start} milliseconds`);
//   next();
// });

/**
 * Aggregation middleware
 */
//remove secret tours from the aggregation pipeline
tourSchema.pre('aggregate', function(next) {
  //'this' points to the current aggregation pipeline
  // console.log(this.pipeline());
  // Hide secret tours if geoNear is NOT used
  if (!(this.pipeline().length > 0 && '$geoNear' in this.pipeline()[0])) {
    this.pipeline().unshift({
      //insert new match stage at the beginning of the stages array
      $match: { secretTour: { $ne: true } }
    });
  }
  next();
});

/** Create model Tour based on schema */
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
