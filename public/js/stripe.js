/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts.js';

export const bookTour = async tourId => {
  const stripe = Stripe(
    'pk_test_51Nf1Y1F7kn4pqkodITi4sm4CM9aJ2npKky0Ol2qnWeMRsNNlqBwhh8vIy8cZ73CpzS7YPTnHq1sJ3Nb2ZMSgvLmR00uWKFcrff'
  );

  try {
    /** 1. Get the checkout session from the API */
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
    // console.log('SESSION', session, session.data.session.url);

    /** 2. Create checkout form + execute payment */
    // await stripe.redirectToCheckout({
    //   sessionId: session.data.session.id
    // });
    //redirectToCheckout is deprecated. Using window.replace instead for now
    window.location.replace(session.data.session.url);
  } catch (err) {
    console.error('ERROR', err);
    showAlert('error', err.response.data.message);
  }
};
