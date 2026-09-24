// Numeric auto-increment ids, compatible with the counters that mongoose-auto-increment 5 kept in the
// "identitycounters" collection. Rewritten for promise-only Mongoose.
const mongoose = require('mongoose');

let IdentityCounter;

exports.initialize = function () {
  if (IdentityCounter) return;
  const counterSchema = new mongoose.Schema({
    model: { type: String, required: true },
    field: { type: String, required: true },
    count: { type: Number, default: 0 }
  });
  counterSchema.index({ field: 1, model: 1 }, { unique: true });
  IdentityCounter = mongoose.models.IdentityCounter || mongoose.model('IdentityCounter', counterSchema);
};

exports.plugin = function (schema, options) {
  if (!IdentityCounter) throw new Error('mongoose-auto-increment has not been initialized');

  const settings = Object.assign(
    { model: null, field: '_id', startAt: 0, incrementBy: 1, unique: true },
    typeof options === 'string' ? { model: options } : options
  );
  if (settings.model == null) throw new Error('model must be set');

  const fields = { [settings.field]: { type: Number } };
  if (settings.field !== '_id') fields[settings.field].unique = settings.unique;
  schema.add(fields);

  const key = { model: settings.model, field: settings.field };

  // Create the counter once, starting so that the first id is startAt.
  let ready;
  function ensureCounter() {
    if (!ready) {
      ready = IdentityCounter.updateOne(
        key,
        { $setOnInsert: { count: settings.startAt - settings.incrementBy } },
        { upsert: true }
      )
        .exec()
        .catch(err => {
          ready = null;
          // Two processes may create the counter at once; the loser sees a duplicate key.
          if (err && err.code !== 11000) throw err;
        });
    }
    return ready;
  }

  async function nextCount() {
    const counter = await IdentityCounter.findOne(key).lean();
    return counter === null ? settings.startAt : counter.count + settings.incrementBy;
  }
  schema.method('nextCount', nextCount);
  schema.static('nextCount', nextCount);

  async function resetCount() {
    await IdentityCounter.updateOne(key, { count: settings.startAt - settings.incrementBy }, { upsert: true });
    return settings.startAt;
  }
  schema.method('resetCount', resetCount);
  schema.static('resetCount', resetCount);

  schema.pre('validate', async function () {
    if (!this.isNew) return;
    await ensureCounter();
    if (typeof this[settings.field] === 'number') {
      // An explicit id moves the counter forward so later ids do not collide with it.
      await IdentityCounter.updateOne(
        Object.assign({ count: { $lt: this[settings.field] } }, key),
        { count: this[settings.field] }
      );
    } else {
      const counter = await IdentityCounter.findOneAndUpdate(
        key,
        { $inc: { count: settings.incrementBy } },
        { returnDocument: 'after' }
      );
      this[settings.field] = counter.count;
    }
  });
};
