// Explicit local MongoDB -> real Express APIs -> React rendering verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose'), express = requireBackend('express'), dotenv = requireBackend('dotenv');
const Pharmacy = requireBackend('./models/Pharmacy');
const pharmacyRoutes = requireBackend('./routes/pharmacyRoutes'), authRoutes = requireBackend('./routes/authRoutes');
const { assertDevelopmentDatabase } = requireBackend('./scripts/seed');
test('MongoDB medicine add/edit -> customer API -> React detail/card/table rendering', async () => {
  dotenv.config({ path: fileURLToPath(new URL('../../../backend/.env', import.meta.url)), quiet: true });
  assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
  let listener, vite, pharmacyId;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes); app.use('/pharmacies', pharmacyRoutes);
    listener = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(path, method = 'GET', body, token) {
      const response = await fetch(`http://127.0.0.1:${listener.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    }
    const login = await request('/auth/login', 'POST', { email: 'owner@medinear.test', password: 'DevOwner123!' });
    assert.equal(login.status, 200, 'Run backend npm run seed first to create development accounts.');
    const token = login.data.token;
    const created = await request('/pharmacies', 'POST', { name: `UI integration ${randomUUID()}`, address: 'Development test address', district: 'Colombo', phone: '0111234567', latitude: 6.9271, longitude: 79.8612 }, token);
    assert.equal(created.status, 201); pharmacyId = created.data.pharmacy._id;
    const base = `/pharmacies/${pharmacyId}`;
    const added = await request(`${base}/inventory`, 'POST', { name: 'Integration Panadol', genericName: 'Paracetamol', quantity: 25, price: 120 }, token);
    assert.equal(added.status, 201); const medicineId = added.data.inventory[0]._id;
    const detail = await request(`${base}?lat=6.9271&lng=79.8612`);
    assert.equal(detail.status, 200); assert.equal(detail.data.pharmacy.distance, 0);
    assert.equal(detail.data.pharmacy.medicines[0].quantity, 25);
    assert.equal((await Pharmacy.findById(pharmacyId)).inventory[0].price, 120);
    vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const { default: Table } = await vite.ssrLoadModule('/src/components/InventoryTable.jsx');
    const render = element => renderToString(createElement(MemoryRouter, {}, element));
    const markup = render(createElement(PharmacyDetailsView, { pharmacy: detail.data.pharmacy }));
    for (const text of ['Integration Panadol', 'Paracetamol', 'LKR 120.00', '25 units', 'Available', '/medicine-placeholder.svg']) assert.ok(markup.includes(text), text);
    const searched = await request('/pharmacies/search?medicine=INTEGRATION%20PANADOL');
    const result = searched.data.pharmacies.find(p => p._id === pharmacyId);
    assert.ok(result); assert.ok(render(createElement(Card, { pharmacy: result })).includes('25 units'));
    assert.equal((await request(`${base}/inventory/${medicineId}`, 'PATCH', { quantity: 0, price: 130, imageUrl: 'https://images.example.test/panadol.png' }, token)).status, 200);
    const updated = (await request(base)).data.pharmacy;
    assert.equal(updated.medicines[0].quantity, 0); assert.equal(updated.medicines[0].availability, 'Out of Stock');
    const updatedMarkup = render(createElement(PharmacyDetailsView, { pharmacy: updated }));
    for (const text of ['Out of Stock', '0 units', 'LKR 130.00', 'https://images.example.test/panadol.png']) assert.ok(updatedMarkup.includes(text), text);
    const owned = await Pharmacy.findById(pharmacyId);
    assert.ok(render(createElement(Table, { medicines: owned.inventory, timezone: owned.timezone })).includes('Out of Stock'));
    assert.ok(!(await request('/pharmacies/search?medicine=Integration%20Panadol')).data.pharmacies.some(p => p._id === pharmacyId));
    assert.equal((await request(`${base}/inventory/${medicineId}`, 'DELETE', undefined, token)).status, 200);
    assert.equal((await request(base)).data.pharmacy.medicines.length, 0);
  } finally {
    if (vite) await vite.close();
    if (listener) await new Promise(resolve => listener.close(resolve));
    if (pharmacyId && mongoose.connection.readyState === 1) await Pharmacy.deleteOne({ _id: pharmacyId });
    await mongoose.disconnect();
  }
});
