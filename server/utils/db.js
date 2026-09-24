const mongoose = require('mongoose');
const yapi = require('../yapi.js');
const autoIncrement = require('./mongoose-auto-increment');

function model(model, schema) {
  if (schema instanceof mongoose.Schema === false) {
    schema = new mongoose.Schema(schema);
  }

  schema.set('autoIndex', false);

  return mongoose.model(model, schema, model);
}

function connect(callback) {
  // Mongoose 5 left unknown fields in query filters alone; keep that behaviour.
  mongoose.set('strictQuery', false);

  let config = yapi.WEBCONFIG;
  let options = {};

  if (config.db.user) {
    options.user = config.db.user;
    options.pass = config.db.pass;
  }

  // reconnectTries and reconnectInterval belonged to the old driver; the current one retries on its own.
  options = Object.assign({}, options, config.db.options);
  delete options.useNewUrlParser;
  delete options.useCreateIndex;
  delete options.useUnifiedTopology;
  delete options.useFindAndModify;

  var connectString = '';

  if (config.db.connectString) {
    connectString = config.db.connectString;
  } else {
    connectString = `mongodb://${config.db.servername}:${config.db.port}/${config.db.DATABASE}`;
    if (config.db.authSource) {
      connectString = connectString + `?authSource=${config.db.authSource}`;
    }
  }

  let db = mongoose.connect(connectString, options);

  db.then(
    function() {
      yapi.commons.log('mongodb load success...');

      if (typeof callback === 'function') {
        callback.call(db);
      }
    },
    function(err) {
      yapi.commons.log(err + ' mongodb connect error', 'error');
    }
  );

  autoIncrement.initialize(db);
  return db;
}

yapi.db = model;

module.exports = {
  model: model,
  connect: connect
};
