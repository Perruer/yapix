const yapi = require('../yapi');

const crypto = require('crypto');

// Project tokens are "uid|token" encrypted with aes-192-cbc. YApi used crypto.createCipher, which
// derives the key and IV from the password with OpenSSL's EVP_BytesToKey (MD5, one round, no salt).
// Node 22 removed createCipher, so derive the same key and IV here: tokens issued by YApi keep working.
function deriveKeyAndIv(password) {
  const pass = Buffer.from(password, 'utf8');
  const parts = [];
  let prev = Buffer.alloc(0);
  while (Buffer.concat(parts).length < 24 + 16) {
    prev = crypto.createHash('md5').update(Buffer.concat([prev, pass])).digest();
    parts.push(prev);
  }
  const bytes = Buffer.concat(parts);
  return { key: bytes.subarray(0, 24), iv: bytes.subarray(24, 40) };
}

function aesEncode(data, password) {
  const { key, iv } = deriveKeyAndIv(password);
  const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function aesDecode(data, password) {
  const { key, iv } = deriveKeyAndIv(password);
  const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);
  return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
}

// YApi encrypted tokens with config.passsalt and fell back to the public constant 'abcde'. With a public
// key anyone holding a token can decrypt it and build one for another user id, so Yapix keeps a random
// secret in the database when config.json sets no passsalt. Tokens made with 'abcde' are accepted only
// when config.json sets "legacyTokens": true (for a migration period), and then with a warning.
const LEGACY_SALT = 'abcde';
let secret = null;

exports.init = async function init() {
  if (yapi.WEBCONFIG.passsalt) {
    secret = yapi.WEBCONFIG.passsalt;
    return;
  }
  const mongoose = require('mongoose');
  const settings = mongoose.connection.db.collection('yapix_settings');
  await settings.updateOne(
    { _id: 'token_secret' },
    { $setOnInsert: { value: crypto.randomBytes(32).toString('hex') } },
    { upsert: true }
  );
  secret = (await settings.findOne({ _id: 'token_secret' })).value;
};

function currentSecret() {
  if (!secret) throw new Error('token secret is not loaded yet');
  return secret;
}

function decode(token, key) {
  let text;
  try {
    text = aesDecode(token, key);
  } catch (e) {
    return null;
  }
  if (typeof text !== 'string' || text.indexOf('|') <= 0) return null;
  const parts = text.split('|');
  return { uid: parts[0], projectToken: parts[1] };
}

exports.getToken = function getToken(token, uid) {
  if (!token) throw new Error('token 不能为空');
  return aesEncode(uid + '|' + token, currentSecret());
};

/**
 * @returns {{uid: string, projectToken: string, legacy?: boolean} | false | {legacyRejected: true}}
 */
exports.parseToken = function parseToken(token) {
  if (!token) throw new Error('token 不能为空');
  const parsed = decode(token, currentSecret());
  if (parsed) return parsed;
  if (!yapi.WEBCONFIG.passsalt && secret !== LEGACY_SALT) {
    const legacy = decode(token, LEGACY_SALT);
    if (legacy) {
      if (yapi.WEBCONFIG.legacyTokens === true) {
        yapi.commons.log('A token made by YApi with its public default key was used; get a new token in the project settings.', 'warn');
        return Object.assign(legacy, { legacy: true });
      }
      return { legacyRejected: true };
    }
  }
  return false;
};
