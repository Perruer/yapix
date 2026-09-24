const test = require('../ava-compat');
const {
  ltrim,
  rtrim,
  trim,
  handleParams,
  verifyPath, 
  sandbox,
  handleVarPath,
  generatePassword,
  verifyPassword,
  isLegacyPassword,
  findQueryOperator
} = require('../../server/utils/commons.js');
const sha1 = require('sha1');

test('trim', t => {
    t.is(trim(" a   b  ksjdfk    "), 'a   b  ksjdfk');
    t.is(trim(1), '1')
});

test('ltrim', t => {
  t.is(ltrim(" a   b  ksjdfk    "), 'a   b  ksjdfk    ');
  t.is(ltrim(1), '1')
});

test('rtrim', t => {
  t.is(rtrim(" a   b  ksjdfk    "), ' a   b  ksjdfk');
  t.is(rtrim(1), '1')
});

test('handleParams', t=>{
    t.deepEqual(handleParams({
        a: '  s k ',
        b: " a123456 "
    }, {
        a: 'string',
        b: 'number'
    }), {
        a: 's k',
        b: 0
    })
})

test('verifyPath', t=>{
    t.false(verifyPath('a/b'));
    t.true(verifyPath('/a:b/t/.api/k_-/tt'))
    t.true(verifyPath('/a:b/t/.api/k_-/tt/'))
})

test('sandbox', async t=>{
    t.deepEqual(await sandbox({
        a: 1
    }, 'a=2'), {a : 2});
})

test('handleVarPath', t=>{
    let result = [];
    let pathname = '/a/:id'
    handleVarPath(pathname, result);

    t.deepEqual(result, [{
        name: 'id',
        desc: ''
    }])
})

test('handleVarPath2', t=>{
    let result = [];
    let pathname = '/a/{id}'
    handleVarPath(pathname, result);

    t.deepEqual(result, [{
        name: 'id',
        desc: ''
    }])
})

test('handleVarPath4', t=>{
    let result = [];
    let pathname = '/a/id={id}/tt/:sub/kk'
    handleVarPath(pathname, result);

    t.deepEqual(result, [{
        name: 'sub',
        desc: ''
    }, {
        name: 'id',
        desc: ''
    }])
})
test('passwords: scrypt hashes, and YApi sha1 hashes still verify', t => {
    const hash = generatePassword('secret-1', 'salt');
    t.true(hash.startsWith('scrypt$'));
    t.true(verifyPassword('secret-1', 'salt', hash));
    t.false(verifyPassword('secret-2', 'salt', hash));
    const old = sha1('secret-1' + sha1('salt'));
    t.true(isLegacyPassword(old));
    t.true(verifyPassword('secret-1', 'salt', old));
    t.false(verifyPassword('secret-2', 'salt', old));
    t.false(verifyPassword({ $ne: null }, 'salt', old));
});

test('query operators in request values are found', t => {
    t.is(findQueryOperator({ email: { $ne: null } }), '$ne');
    t.is(findQueryOperator({ list: [{ a: { $gt: 1 } }] }), '$gt');
    t.is(findQueryOperator({ schema: { $schema: 'x', $ref: '#/a' } }), null);
    t.is(findQueryOperator({ name: '$ne' }), null);
});
