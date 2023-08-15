class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  /** build query: filtering */
  filter() {
    const queryObj = { ...this.queryString }; //create a copy instead of reference of the query
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(field => delete queryObj[field]); //remove properties that should not be used for querying

    /** build query: advanced filtering */
    let queryStr = JSON.stringify(queryObj); // stringify the query so we can run a replace on it
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`); // add mongodb operators where needed (GTE: Greather Than or Equal)

    this.query = this.query.find(JSON.parse(queryStr));
    // let query = Tour.find(JSON.parse(queryString));

    return this; // return this to add support for chaining
  }

  /** build query: sorting */
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this; // return this to add support for chaining
  }

  /** build query: field limiting */
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this; // return this to add support for chaining
  }

  /** build query: pagination */
  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const offset = (page - 1) * limit;

    this.query = this.query.skip(offset).limit(limit);

    /** If a page is requested that's higher than possible */
    // if (this.queryString.page) {
    //   const numTours = await Tour.countDocuments();
    //   if (offset >= numTours) {
    //     throw new Error('This page does not exist');
    //   }
    // }
    return this; // return this to add support for chaining
  }
}

module.exports = APIFeatures;
