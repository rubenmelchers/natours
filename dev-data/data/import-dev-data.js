const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tour = require('../../models/tourModel');
const User = require('../../models/userModel');
const Review = require('../../models/reviewModel');

dotenv.config({ path: './config.env' }); //bind .env config to dotenv package

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

const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'utf-8'));
const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8')
);

const importData = async () => {
  try {
    await Tour.create(tours);
    // await User.create(users, { validateBeforeSave: false });
    // await Review.create(reviews);
    console.log('Data successfully loaded');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

const deleteData = async () => {
  try {
    await Tour.deleteMany();
    // await User.deleteMany();
    // await Review.deleteMany();
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// run in terminal: node [path-to-this-file] --import
if (process.argv[2] === '--import') {
  importData();
}

// run in terminal: node [path-to-this-file] --delete
if (process.argv[2] === '--delete') {
  deleteData();
}
