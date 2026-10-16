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
import { clearNoResultsFilters } from '../../src/utils/noResultsSuggestions.js';
import { visiblePharmacyResults, searchResultCountText } from '../../src/utils/searchResults.js';
import { copyPharmacyAddress, displayedPharmacyAddress } from '../../src/utils/copyPharmacyAddress.js';
import { sharePharmacy } from '../../src/utils/sharePharmacy.js';
import { recordPharmacyDetailsView, resolveRecentPharmacies, RECENT_PHARMACIES_KEY } from '../../src/utils/recentPharmacies.js';
import { createRecentSearchRecorder, RECENT_SEARCHES_KEY } from '../../src/utils/recentSearches.js';
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
    let copiedAddress;
    const copied = await copyPharmacyAddress(displayedPharmacyAddress(detail.data.pharmacy), { navigator: { clipboard: { writeText: async text => { copiedAddress = text; } } } });
    assert.equal(copied.status, 'copied');
    assert.equal(copiedAddress, `${detail.data.pharmacy.address}, ${detail.data.pharmacy.district}`);
    let sharePayload;
    const shared = await sharePharmacy(detail.data.pharmacy, { origin: 'https://medinear.test', navigator: { share: async payload => { sharePayload = payload; } } });
    assert.equal(shared.status, 'shared'); assert.equal(sharePayload.url, `https://medinear.test/pharmacy/${pharmacyId}`);
    assert.equal(sharePayload.title, `${detail.data.pharmacy.name} - MediNear`);
    assert.deepEqual(Object.keys(sharePayload).sort(), ['text', 'title', 'url']);
    assert.equal(detail.status, 200); assert.equal(detail.data.pharmacy.distance, 0);
    assert.equal(detail.data.pharmacy.medicines[0].quantity, 25);
    const viewed = new Map(), browserStorage = { getItem: key => viewed.get(key) ?? null, setItem: (key, value) => viewed.set(key, value) };
    assert.deepEqual(recordPharmacyDetailsView({ id: 'customer-test-session', role: 'customer' }, detail.data, pharmacyId, browserStorage), [pharmacyId]);
    assert.deepEqual(JSON.parse(viewed.get(RECENT_PHARMACIES_KEY)), [pharmacyId]);
    const recent = await resolveRecentPharmacies({ get: async url => { const result = await request(url); return { data: result.data }; } }, [pharmacyId]);
    assert.equal(recent.pharmacies[0].name, detail.data.pharmacy.name);
    assert.equal(recent.pharmacies[0].inventory, undefined);
    assert.equal((await Pharmacy.findById(pharmacyId)).inventory[0].price, 120);
    vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const { default: Card } = await vite.ssrLoadModule('/src/components/PharmacyCard.jsx');
    const { default: Table } = await vite.ssrLoadModule('/src/components/InventoryTable.jsx');
    const render = element => renderToString(createElement(MemoryRouter, {}, element));
    const markup = render(createElement(PharmacyDetailsView, { pharmacy: detail.data.pharmacy }));
    // The existing business contact travels through owner creation/API/detail rendering unchanged.
    assert.equal(detail.data.pharmacy.phone, '0111234567');
    assert.ok(markup.includes('href="https://wa.me/94111234567"'));
    assert.ok(markup.includes('aria-label="Contact pharmacy on WhatsApp"'));
    assert.ok(markup.includes('href="tel:0111234567"'));
    assert.ok(markup.includes('Share '));

    for (const text of ['Integration Panadol', 'Paracetamol', 'LKR 120.00', '25 units', 'Available', '/medicine-placeholder.svg']) assert.ok(markup.includes(text), text);
    const history = new Map();
    const recorder = createRecentSearchRecorder({ getItem: key => history.get(key) ?? null, setItem: (key, value) => history.set(key, value) });
    const intent = recorder.begin('INTEGRATION PANADOL');
    const searched = await request('/pharmacies/search?medicine=INTEGRATION%20PANADOL');
    assert.deepEqual(recorder.complete(intent, 'INTEGRATION PANADOL', searched.data.success), ['INTEGRATION PANADOL']);
    assert.deepEqual([...history.keys()], [RECENT_SEARCHES_KEY]);
    const result = searched.data.pharmacies.find(p => p._id === pharmacyId);
    assert.ok(result); assert.ok(render(createElement(Card, { pharmacy: result })).includes('25 units'));
    for (const quantity of [5, 1, 3]) {
      assert.equal((await request(`${base}/inventory/${medicineId}`, 'PATCH', { quantity }, token)).status, 200);
      const low = (await request(base)).data.pharmacy;
      assert.equal(low.medicines[0].availability, 'Available');
      assert.ok(render(createElement(PharmacyDetailsView, { pharmacy: low })).includes('Low Stock'));
      const lowSearch = (await request('/pharmacies/search?medicine=Integration%20Panadol')).data.pharmacies.find(p => p._id === pharmacyId);
      assert.ok(lowSearch); assert.ok(render(createElement(Card, { pharmacy: lowSearch })).includes('Low Stock'));
      assert.ok(render(createElement(Table, { medicines: (await Pharmacy.findById(pharmacyId)).inventory })).includes('Low Stock'));
    }
    const allDay = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, allDay: true }));
    assert.equal((await request(`${base}/hours`, 'PUT', { openingHours: allDay, timezone: 'Asia/Colombo' }, token)).status, 200);
    for (const query of ['province=Western', 'district=Colombo', 'openNow=true', 'hour24=true', 'includeOutOfStock=false', 'lat=6.9271&lng=79.8612&radius=5&sort=smart', 'lat=6.9271&lng=79.8612&radius=5&sort=nearest']) {
      const response = await request(`/pharmacies/search?medicine=Integration%20Panadol&${query}`);
      assert.equal(response.status, 200);
      const visible = visiblePharmacyResults(response.data.pharmacies);
      assert.equal(visible.length, 1, query); assert.equal(searchResultCountText(visible), '1 pharmacy found');
    }
    const none = await request('/pharmacies/search?medicine=Integration%20Panadol&province=Central');
    assert.equal(searchResultCountText(visiblePharmacyResults(none.data.pharmacies)), 'No pharmacies found');
    const emptyParams = new URLSearchParams('medicine=Integration Panadol&province=Central');
    const { default: Suggestions } = await vite.ssrLoadModule('/src/components/NoResultsSuggestions.jsx');
    const suggestions = render(createElement(Suggestions, { params: emptyParams, results: none.data.pharmacies }));
    assert.ok(suggestions.includes('Try another district')); assert.ok(suggestions.includes('Clear Filters'));
    const broadened = clearNoResultsFilters(emptyParams);
    assert.equal(broadened.get('medicine'), 'Integration Panadol');
    const recovered = await request(`/pharmacies/search?${broadened}`);
    assert.equal(recovered.status, 200); assert.ok(recovered.data.pharmacies.some(p => p._id === pharmacyId));

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
