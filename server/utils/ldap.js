const { Client } = require('ldapts');
const yapi = require('../yapi.js');

// RFC 4515: escape a value before putting it into a search filter.
function escapeFilterValue(value) {
  return String(value).replace(/[\\*()\0]/g, ch => '\\' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
}

function fail(message) {
  return { type: false, message };
}

// ldapts returns attribute values as strings or arrays; ldapjs returned the same shape in entry.object.
function entryToObject(entry) {
  const obj = {};
  for (const [key, value] of Object.entries(entry)) {
    obj[key] = Buffer.isBuffer(value) ? value.toString() : value;
  }
  return obj;
}

exports.ldapQuery = async (username, password) => {
  const { ldapLogin } = yapi.WEBCONFIG;

  // Many LDAP servers accept a bind with an empty password as an anonymous bind; never treat that as a login.
  if (!username || !password) {
    throw fail('用户名或密码不能为空');
  }

  const client = new Client({ url: ldapLogin.server });
  try {
    if (ldapLogin.bindPassword) {
      try {
        await client.bind(ldapLogin.baseDn, ldapLogin.bindPassword);
      } catch (err) {
        throw fail(`LDAP server绑定失败: ${err}`);
      }
    }

    const searchStandard = ldapLogin.searchStandard;
    const value = escapeFilterValue(username);
    // searchStandard is either an attribute name ("uid") or a filter with %s placeholders ("&(uid=%s)(objectClass=person)")
    const filter = /^(&|\|)/i.test(searchStandard)
      ? `(${searchStandard.replace(/%s/g, value)})`
      : `(${searchStandard}=${value})`;

    let searchEntries;
    try {
      ({ searchEntries } = await client.search(ldapLogin.searchDn, { filter, scope: 'sub' }));
    } catch (err) {
      throw fail(`ldapSearch: ${err}`);
    }
    if (!searchEntries.length) {
      throw fail('用户名不存在');
    }

    const user = entryToObject(searchEntries[0]);
    try {
      await client.bind(user.dn, password);
    } catch (err) {
      throw fail(`用户名或密码不正确: ${err}`);
    }
    return { type: true, message: '验证成功', info: user };
  } finally {
    await client.unbind().catch(() => {});
  }
};

exports.escapeFilterValue = escapeFilterValue;
