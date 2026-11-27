const assert = require('assert');
const { normalizeWhatsappNumber } = require('../src/controllers/settingsController');

assert.deepStrictEqual(normalizeWhatsappNumber('+91 98765 43210'), { valid: true, number: '919876543210' });
assert.deepStrictEqual(normalizeWhatsappNumber('  '), { valid: true, number: '' });
assert.deepStrictEqual(normalizeWhatsappNumber(undefined), { valid: true, number: '' });
assert.strictEqual(normalizeWhatsappNumber('12345').valid, false);
assert.strictEqual(normalizeWhatsappNumber('1234567890123456').valid, false);
assert.strictEqual(normalizeWhatsappNumber('abc123456789').valid, false);
assert.strictEqual(normalizeWhatsappNumber('https://evil.example').valid, false);
assert.strictEqual(normalizeWhatsappNumber(919876543210).valid, false);
console.log('whatsappSetting tests passed');
