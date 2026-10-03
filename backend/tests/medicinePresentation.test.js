const test = require('node:test');
const assert = require('node:assert/strict');
const Pharmacy = require('../models/Pharmacy');
const { validateMedicine, publicMedicine } = require('../services/inventory');
test('medicine image URLs allow HTTPS and blank legacy values and reject unsafe schemes and credentials', () => {
  const base = { name: 'Panadol', quantity: 25, price: 120 };
  for (const imageUrl of [undefined, null, '', 'https://images.example.test/panadol.png']) {
    const medicine = validateMedicine({ ...base, imageUrl });
    assert.equal(medicine.imageUrl, imageUrl || '');
  }
  for (const imageUrl of ['javascript:alert(1)', 'data:image/png;base64,huge', 'http://example.test/a.png', 'file:///a.png', '//example.test/a.png', 'https://user:password@example.test/a.png', 123, 'a'.repeat(2049)]) assert.throws(() => validateMedicine({ ...base, imageUrl }));
});
test('legacy inventory has a placeholder-compatible image and public price, stock and derived status', async () => {
  const p = new Pharmacy({ name: 'Legacy', address: 'Colombo', district: 'Colombo', phone: '0111234567', latitude: 6.9, longitude: 79.8, inventory: [{ name: 'Panadol', quantity: 25, price: 120 }, { name: 'Vitamin C', quantity: 0, price: 750 }] });
  await p.validate();
  const available = publicMedicine(p.inventory[0]);
  assert.equal(available.imageUrl, ''); assert.equal(available.quantity, 25); assert.equal(available.price, 120); assert.equal(available.availability, 'Available');
  assert.equal(publicMedicine(p.inventory[1]).availability, 'Out of Stock');
  assert.equal(publicMedicine(p.inventory[1]).quantity, 0);
  assert.ok(p.inventory[0].createdAt instanceof Date);
});
