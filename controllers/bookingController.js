const stripe = require('stripe')(process.env.STRIPE_SECRET);

const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('../controllers/handlerFactory');
// const AppError = require('../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  /** 1. Get currently booked tour */
  const { tourid } = req.params;
  const tour = await Tour.findById(tourid);

  /** 2. Create checkout session */
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const session = await stripe.checkout.sessions.create({
    //information about the Strip session
    success_url: `${baseUrl}/?tour=${req.params.tourid}&user=${
      req.user.id
    }&price=${tour.price}`,
    cancel_url: `${baseUrl}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: tourid,
    //information about the product that's about to be purchased
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [`https://www.natours.dev/img/tours/${tour.imageCover}`]
          },
          unit_amount: tour.price * 100 // amount needs to be in cents instead of dollars. Therefore multiply by 100
        },
        quantity: 1
      }
    ],
    mode: 'payment'
  });

  /** Create session as resonse */
  res.status(200).json({
    status: 'success',
    session
  });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  /** TEMPORARY SOLUTION. unsecure due to open URL that injects booking without paying */
  /** SECURE solution is to use Stripe webhooks to invoke booking creation */
  const { tour, user, price } = req.query; //get properties from querystring

  if (!tour || !user || !price) return next();

  await Booking.create({ tour, user, price });

  res.redirect(req.originalUrl.split('?')[0]);

  // no next(), because we want to redirect back to the homepage. But first, split the URL so the queryString is removed
});

exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking, { path: 'reviews' });
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
