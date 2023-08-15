/** Wrap async functions into this function to handle errors through here. Use in other places to avoid having to write try/catch blocks everywhere */
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); //express will handle the error within the .catch. It'll refer to our errorhandling middleware
  };
};
