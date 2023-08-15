/* eslint-disable */
import '@babel/polyfill';
import displayMap from './leaflet.js';
import { login, logout } from './login.js';
import { updateSettings } from './updateSettings.js';
import { bookTour } from './stripe.js';

const map = document.getElementById('map');
const loginform = document.getElementById('loginform');
const logoutBtn = document.querySelector('.nav__el--logout');
const updateUserForm = document.querySelector('form[data-update-user]');
const updatePasswordForm = document.querySelector('form[data-update-password]');
const bookTourBtn = document.querySelector('[data-book-tour-button]');

// Display the map if it exists
if (map) {
  const locations = JSON.parse(map.dataset.locations);
  displayMap(locations);
}

if (loginform) {
  loginform.addEventListener('submit', e => {
    e.preventDefault();

    // Login form values
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    login(email, password);
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
}

if (updateUserForm) {
  updateUserForm.addEventListener('submit', e => {
    e.preventDefault();

    const form = new FormData();
    form.append('name', updateUserForm.querySelector('#name').value);
    form.append('email', updateUserForm.querySelector('#email').value);
    form.append('photo', updateUserForm.querySelector('#photo').files[0]);

    updateSettings(form, 'data');
  });
}

if (updatePasswordForm) {
  updatePasswordForm.addEventListener('submit', async e => {
    e.preventDefault();

    const passwordCurrent = updatePasswordForm.querySelector(
      '#password-current'
    );
    const passwordNew = updatePasswordForm.querySelector('#password');
    const passwordConfirm = updatePasswordForm.querySelector(
      '#password-confirm'
    );
    const updatePasswordBtn = updatePasswordForm.querySelector(
      '[data-update-password-button]'
    );

    updatePasswordBtn.innerText = 'Updating password...';
    await updateSettings(
      {
        currentPassword: passwordCurrent.value,
        newPassword: passwordNew.value,
        newPasswordConfirm: passwordConfirm.value
      },
      'password'
    );

    /** After updatesettings function is done. Empty the fields */
    passwordCurrent.value = '';
    passwordNew.value = '';
    passwordConfirm.value = '';
    updatePasswordBtn.innerText = 'Save password';
  });
}

if (bookTourBtn) {
  bookTourBtn.addEventListener('click', async e => {
    e.preventDefault();
    bookTourBtn.innerText = 'Processing...';
    const { tourId } = bookTourBtn.dataset;
    await bookTour(tourId);
    bookTourBtn.innerText = 'Book tour';
  });
}
