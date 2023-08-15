CHALLENGES API

- Implement restriction that users can only review a tour that they have actually booked;

- Implement nested booking routes: /tours/:id/bookings and /users/:id/bookings;

- Improve tour dates: add a participants and soldOut field to each date. A date then becomes an instance of the tour. Then, when a user boooks, they need to select one of the dates. A new booking will increase the number of participants in the date, until it is booked out(participants > maxGroupSize). So when a user wants to book, you need to check if tour on the selected date is still available;

- Implement advanced authentication features: confirm user email, keep users logged in with refresh tokens, two-factor authentication, etc.

CHALLENGES WEBSITE

- Implement a sign up form, similar to login form;

- On the tour detail page, if a user has taken a tour, allow them add a review directly on the website. Implement a form for this.

- Hide the entire booking section on the detail page if current user has already booked the tour(also prevent duplicate bookings on the model);

- Implement "like tour" functionality, with fav tour page;

- On the user account page, implement the "My Reviews" page, wehere all reviews are displayed, and a user can edit them. (If you know REACT, this would be an amazing way to use the Natours API and train your skills!);

- For administrators, implement all the "Manage" pages, where they can CRUD tours, users, reviews and bookings.
