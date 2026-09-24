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

const defaultSalt = 'abcde';

exports.getToken = function getToken(token, uid) {
  if (!token) throw new Error('token 不能为空');
  yapi.WEBCONFIG.passsalt = yapi.WEBCONFIG.passsalt || defaultSalt;
  return aesEncode(uid + '|' + token, yapi.WEBCONFIG.passsalt);
};

exports.parseToken = function parseToken(token) {
  if (!token) throw new Error('token 不能为空');
  yapi.WEBCONFIG.passsalt = yapi.WEBCONFIG.passsalt || defaultSalt;
  let tokens;
  try {
    tokens = aesDecode(token, yapi.WEBCONFIG.passsalt);
  } catch (e) {} // eslint-disable-line no-empty
  if (tokens && typeof tokens === 'string' && tokens.indexOf('|') > 0) {
    tokens = tokens.split('|');
    return {
      uid: tokens[0],
      projectToken: tokens[1]
    };
  }
  return false;
};
