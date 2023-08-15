const multer = require('multer');
const sharp = require('sharp');
const factory = require('./handlerFactory');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const multerStorage = multer.memoryStorage(); //store image in memory temporarily instead of storage, so we can process it (resizing). We'll save it afterwards

/**
 *
 * Could have: upload to AWS S3 bucket instead of local file storage
 * https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/learn/lecture/15087360#questions/8512756
 *
 *
 */

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

/** We tell multer it should expect 2 properties. ImageCover and images */
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 }
]);

/** Middleware for resizing user avatar. Middleware runs on every user update request */
/* Example for uploading to S3 bucket: https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/learn/lecture/15087354#questions/8735090 */
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  // if no photo is uploaded, stop the function
  if (!req.files || !req.files.imageCover || !req.files.images) return next();

  /** 1. Process the cover image */
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333) //Resize it to 3:2 ratio
    .toFormat('jpeg') //transform extension to a jpeg
    .jpeg({ quality: 90 }) //reduce quality to lower filesize
    .toFile(`public/img/tours/${req.body.imageCover}`);

  /** 2. Process the other images in a loop */
  req.body.images = []; // init the images array or empty it

  //can't use foreach instead of map, because async doesn't work then. We need to return the promises and then execute the promises instead
  await Promise.all(
    req.files.images.map(async (file, index) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${index + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333) //Resize it to 3:2 ratio
        .toFormat('jpeg') //transform extension to a jpeg
        .jpeg({ quality: 90 }) //reduce quality to lower filesize
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

exports.aliasTopTours = (req, res, next) => {
  /** Set the query properties to only get the top 5 tours */
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price,-name';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

/**
 * Generate tour statistics
 * Use Mongo's aggregation feature through mongoose */
exports.getTourStats = catchAsync(async (req, res, next) => {
  //pass documents through stages (first param from aggregate func)
  // https://www.mongodb.com/docs/manual/meta/aggregation-quick-reference/#stages
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } }
    },
    {
      //$avg, $sum $min and $max are calculation operators provided by the framework
      $group: {
        // _id: '$difficulty', //group results by difficulty
        _id: { $toUpper: '$difficulty' }, //group results by difficulty. Transform the name to be uppercased
        numTours: { $sum: 1 }, // for every document that passes through the pipeline, add 1 to the numTours property. -1 is for descending
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    {
      $sort: {
        avgPrice: 1 //sort the results based on the avgPrice property. 1 = ascending
      }
    }
    // {
    //   $match: { // stages can be implemented multiple times
    //     _id: { $ne: 'EASY' } //just for show. Exclude all tours that are EASY
    //   }
    // }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

/** Function case: natours company wants to know which month is the busiest of a given year.
 * todo: Calculate how many tours start at the month of a given year
 * Can be done through aggregation pipelines
 *
 * route is added in tourRoutes.js. /api/v1/tours/monthly-plan/{year}
 */
exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // cast string to int by doing * 1
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates' //unwind tour documents based on dates to provide a new array for each date
    },
    {
      $match: {
        //get only tours based on the provided year (`year` variable)
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$startDates' }, //$month is a mongo operator. Extract the month from a given date string
        numTourStarts: { $sum: 1 }, //for each found tour on the date, add 1
        tours: { $push: '$name' } // create an array with every tour name
      }
    },
    {
      $addFields: { month: '$_id' } //add a new field to the results. Map the _id value to it, which is a month number
    },
    {
      $project: {
        _id: 0 //hide the _id
      }
    },
    {
      $sort: { numTourStarts: 1 } //sort the results based on the amount of tours per month
    },
    {
      $limit: 12 //not really doing anything, but limit the results to 12 (amount of months)
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan
    }
  });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  /** Calculate radiance of distance. 3963.2 = radius of the earth in miles. 6378.1 is in KM */
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!latlng || !lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng',
        400
      )
    );
  }

  //docs.mongodb.com/manual/reference/operator/query //check Geospatial docs for different types of operators
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });

  res.status(200).json({
    status: 'success',
    data: {
      data: tours
    }
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371192 : 0.001;

  if (!latlng || !lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng',
        400
      )
    );
  }

  /** Geospatial data must use the geoNear first */
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1] //multiply to convert to numbers
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $project: {
        distance: 1,
        name: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances
    }
  });
});

/** Older code. Moved to factory */
// exports.getAllTours = catchAsync(async (req, res, next) => {
//   /** Execute query */
//   const features = new APIFeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;

//   /** Send response */
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       tours: tours
//     }
//   });
// });

// exports.getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate({
//     path: 'reviews'
//     // select: ''
//   });

//   /** The populate function checks the property for the guides, which is an array with IDs (objectIDs) and populates it with the corresponding users
//    * The returned results will seem like the guides are embedded.
//    * In the DB, only the ID's are still seen.
//    *
//    * The populate functionality is added in the model middleware so it's executed on all finds
//    */
//   // const tour = await Tour.findById(req.params.id).populate({
//   //   path: 'guides',
//   //   select: '-__v -passwordChangedAt' //omit __v and passwordChangedAt fields from the results
//   // });

//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour
//     }
//   });
// });

// exports.createTour = catchAsync(async (req, res, next) => {
//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newTour
//     }
//   });
// });

// exports.updateTour = catchAsync(async (req, res, next) => {
//   // first param is the UID to query by. Second param are the properties to update
//   const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true, // returns the modified document rather than the original
//     runValidators: true // runs update validators on this command. Validate the update operation against the model schema
//   });

//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour
//     }
//   });
// });

/** Below commented out delete function has been moved to a factory. See below it */
// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);

//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }

//   res.status(204).json({
//     status: 'success',
//     data: null
//   });
// });
