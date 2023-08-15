const hpp = require('hpp');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const express = require('express');
// const { fileURLToPath } = require('url');
const compression = require('compression'); //compress output for the client
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const AppError = require('./utils/appError.js');
const globalErrorHandler = require('./controllers/errorController.js');
const viewRouter = require('./routes/viewRoutes.js');
const tourRouter = require('./routes/tourRoutes.js');
const userRouter = require('./routes/userRoutes.js');
const reviewRouter = require('./routes/reviewRoutes.js');
const bookingRouter = require('./routes/bookingRoutes.js');
const bookingController = require('./controllers/bookingController.js');

// ----------------------------------------------
// Start express app
// ----------------------------------------------

const app = express();

// ----------------------------------------------
// Trust proxy
// ----------------------------------------------

app.enable('trust proxy');

// ----------------------------------------------
// PUG engine setup
// ----------------------------------------------

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// ----------------------------------------------
// Global Middlewares
// ----------------------------------------------

// CORS policy
app.use(cors());
app.options('*', cors()); // set options request method. Plug in CORS so all HTTP requests are accepted
// app.options('/api/v1/tours/:id', cors());

// Further HELMET configuration for Content Security Policy (CSP)
// Source: https://github.com/helmetjs/helmet
const defaultSrcUrls = ['https://js.stripe.com/'];

const scriptSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://cdnjs.cloudflare.com/ajax/libs/axios/1.0.0-alpha.1/axios.min.js',
  'https://js.stripe.com/v3/'
];

const styleSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://fonts.googleapis.com/'
];

const connectSrcUrls = [
  'https://*.stripe.com',
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://*.cloudflare.com',
  'http://localhost:8000/api/v1/users/login',
  'http://localhost/api/v1/bookings/checkout-session/',
  'ws://localhost'
];

const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", ...defaultSrcUrls],
      scriptSrc: ["'self'", ...scriptSrcUrls],
      connectSrc: ["'self'", ...connectSrcUrls],
      fontSrc: ["'self'", ...fontSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
      workerSrc: ["'self'", 'blob:']
    }
  })
);

// Serving static files (works closely with PUG)
app.use(express.static(path.join(__dirname, 'public')));

// Http request logger for development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message:
    'Too many consecutive requests were attempted! Please try again in an hour!'
});
app.use('/api', limiter);

// Stripe webhook
/** Stripe webhook must be called before the body parser (line 120) */
app.post(
  '/webhook-checkout',
  express.raw({ type: 'application/json' }), //parse raw body request data from Strip
  bookingController.webhookCheckout
);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' })); //middleware for passing along form data upon form submit
app.use(cookieParser());

// Data sanitization against noSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS (using HTML injection)
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

// Compress text send to client
app.use(compression());

// TEST MIDDLEWARE ------------------------------
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    next();
  });
}
// END TEST -------------------------------------

// ----------------------------------------------
// Routes
// ----------------------------------------------

// Views routes
app.use('/', viewRouter);

// API routes
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// Dealing with unknown urls
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
