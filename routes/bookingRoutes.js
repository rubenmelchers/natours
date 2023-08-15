const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

//mergeParams needs to be activated in order to get access to tourId (from the tour router)
const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router.get(
  '/checkout-session/:tourid',
  authController.protect,
  bookingController.getCheckoutSession
);

router.use(authController.restrictTo('admin', 'lead-guide'));

router
  .route('/')
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);

module.exports = router;
