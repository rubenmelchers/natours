/* eslint-disable */

import axios from 'axios';
import { showAlert } from './alerts';

/** Type is either 'password' or 'data'. */
export const updateSettings = async (data, type) => {
  try {
    const endpoint = type === 'password' ? 'update-password' : 'update-me';
    const res = await axios({
      method: 'PATCH',
      url: `/api/v1/users/${endpoint}`,
      data
    });

    if (res.data.status === 'success') {
      showAlert('success', `${type.toUpperCase()} updated succesfully!`);
      window.setTimeout(() => {
        location.reload();
      }, 1000);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
