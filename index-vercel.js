const mongoose = require('mongoose');
const dotenv = require('dotenv');

/** Any uncaught exception that occur somewhere in our app will be caught here */
process.on('uncaughtException', err => {
  console.log('ERROR:', err.name, err.message);
  console.log('UNCAUGHT EXCEPTION. SHUTTING DOWN...');
  process.exit(1);
});

dotenv.config({ path: './config.env' }); //bind .env config to dotenv package
const app = require('./app');

const DB = process.env.DB.replace('<PASSWORD>', process.env.DB_PASS);
/**
 * For local DB usage:
 * prerequisite: local DB set up
 */
// const DB = process.env.DATABASE_LOCAL;

/** Connect app to DB using mongoose */
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => console.log('DB connection succesful'));

/** Start server */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is running on port ${port}...`);
});

/** Any unhandled rejection that occur somewhere in our app will be caught here */
process.on('unhandledRejection', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION. SHUTTING DOWN...');
  app.close(() => {
    process.exit(1);
  });
});

module.exports = app;
