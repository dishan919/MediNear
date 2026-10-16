import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { normalizePharmacyPhone, pharmacyWhatsAppUrl } from '../src/utils/whatsappPharmacy.js';

test('local, +94 and international Sri Lankan contacts normalize without changing stored input', () => {
  for (const phone of ['0771234567', '+94771234567', '94771234567', ' 0771234567 ', '077 123 4567', '077-123-4567', '+94 77 123 4567', '(077) 123-4567', '077.123.4567']) {
    assert.equal(normalizePharmacyPhone(phone), '94771234567', phone);
    assert.equal(pharmacyWhatsAppUrl(phone), 'https://wa.me/94771234567', phone);
  }
  // Keep landlines available too: number shape does not prove WhatsApp registration.
  assert.equal(pharmacyWhatsAppUrl('0112345678'), 'https://wa.me/94112345678');
  const pharmacy = Object.freeze({ phone: '077-123-4567' }); pharmacyWhatsAppUrl(pharmacy.phone);
  assert.equal(pharmacy.phone, '077-123-4567');
});

test('missing, malformed, ambiguous and hostile values never become destinations', () => {
  for (const phone of [undefined, null, 771234567, {}, [], '', ' ', 'undefined', 'null', '077 123 ABC', '077123456', '07712345678', '+940771234567', '940771234567', '771234567', '0094771234567', '+947712345678', '+9477123456', '0000000000', '94000000000', '0771234567 ext 1', '0771234567#1', '+94+771234567', '077\n1234567', '077\t1234567', '0771234567?text=hello', 'javascript:alert(1)', 'https://evil.test/0771234567', '+12025550123']) {
    assert.equal(normalizePharmacyPhone(phone), '', String(phone));
    assert.equal(pharmacyWhatsAppUrl(phone), '', String(phone));
  }
});

test('WhatsApp URL contains only normalized business phone and no message, query or private data', () => {
  const pharmacy = { phone: '+94 77 123 4567', customerPhone: '0779999999', token: 'private-token', email: 'private@example.test', userId: 'private-id', latitude: 6.9, longitude: 79.8, medicineHistory: 'private-history' };
  const url = new URL(pharmacyWhatsAppUrl(pharmacy.phone));
  assert.equal(url.origin, 'https://wa.me'); assert.equal(url.pathname, '/94771234567');
  assert.equal(url.search, ''); assert.equal(url.hash, '');
  assert.doesNotMatch(url.href, /private|0779999999|text=|6\.9|79\.8/);
});

test('Pharmacy Details renders named safe external WhatsApp action beside unchanged Call, Directions and Share', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { PharmacyDetailsView } = await vite.ssrLoadModule('/src/pages/PharmacyDetails.jsx');
    const pharmacy = { _id: '507f1f77bcf86cd799439011', name: 'Contact Test', address: 'Main Street', district: 'Colombo', phone: '077 123 4567', latitude: 6.9, longitude: 79.8, medicines: [], token: 'private-token' };
    const render = data => renderToString(createElement(MemoryRouter, {}, createElement(PharmacyDetailsView, { pharmacy: data })));
    const html = render(pharmacy);
    const link = html.match(/<a[^>]+href="https:\/\/wa\.me\/94771234567"[^>]*>WhatsApp Pharmacy<\/a>/)?.[0];
    assert.ok(link); assert.match(link, /aria-label="Contact pharmacy on WhatsApp"/);
    assert.match(link, /target="_blank"/); assert.match(link, /rel="noopener noreferrer"/);
    assert.match(link, /class="mn-button mn-secondary mn-whatsapp-contact"/);
    assert.ok(html.indexOf('Call Pharmacy') < html.indexOf('WhatsApp Pharmacy'));
    assert.ok(html.indexOf('WhatsApp Pharmacy') < html.indexOf('>Directions<'));
    assert.match(html, /href="tel:077 123 4567"/);
    assert.match(html, /google.com\/maps\/search/); assert.match(html, /Share Contact Test/); assert.match(html, /Copy Address/);
    assert.doesNotMatch(html, /private-token|message sent|text=/i);
    for (const phone of [undefined, null, '', 'invalid', '077123ABC']) {
      const invalid = render({ ...pharmacy, phone });
      assert.doesNotMatch(invalid, /wa\.me|WhatsApp Pharmacy/);
      assert.match(invalid, /Call Pharmacy/); assert.match(invalid, />Directions</); assert.match(invalid, /Share Contact Test/);
    }
  } finally { await vite.close(); }
});
