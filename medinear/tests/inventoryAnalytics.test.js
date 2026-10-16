import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { parseInventoryAnalytics, loadInventoryAnalytics } from '../src/utils/inventoryAnalytics.js';
const fixture = () => ({ success: true, summary: { totalMedicines: 5, totalStockUnits: 41, lowStock: 1, outOfStock: 1, expiringSoon: 1, expired: 1 }, needsAttention: [
  { _id: 'expired', name: 'Medicine Y', quantity: 8, expiryDate: '2026-10-10', issues: [{ code: 'expired', label: 'Expired' }] },
  { _id: 'zero', name: 'Medicine X', quantity: 0, expiryDate: '2027-12-15', issues: [{ code: 'out-of-stock', label: 'Out of Stock' }] },
  { _id: 'soon', name: 'Vitamin C', quantity: 3, expiryDate: '2026-10-25', issues: [{ code: 'expiring-soon', label: 'Expiring Soon' }, { code: 'low-stock', label: 'Low Stock' }] },
], attentionTotal: 3, attentionLimit: 10, hasMore: false });
const buttons = node => !node || typeof node !== 'object' ? [] : node.type === 'button' ? [node] : [node.props?.children].flat(Infinity).flatMap(buttons);
test('analytics service uses one authenticated GET and validates/project safe response without recalculating metrics', async () => {
  let calls = 0; const signal = new AbortController().signal;
  const api = { async get(path, config) { calls++; assert.equal(path, '/pharmacies/owned/inventory/analytics'); assert.equal(config.signal, signal); assert.equal(config.headers.Authorization, 'Bearer test-token'); const data = fixture(); data.needsAttention[0].email = 'private'; return { data }; } };
  const parsed = await loadInventoryAnalytics(api, 'owned', signal, 'test-token'); assert.equal(calls, 1); assert.equal(parsed.summary.totalStockUnits, 41); assert.doesNotMatch(JSON.stringify(parsed), /private|email/);
  for (const data of [null, {}, { ...fixture(), summary: { ...fixture().summary, totalStockUnits: NaN } }, { ...fixture(), summary: { ...fixture().summary, lowStock: 99 } }, { ...fixture(), needsAttention: [{}] }, { ...fixture(), hasMore: true }]) assert.throws(() => parseInventoryAnalytics(data));
  api.get = async () => { throw new Error('Network unavailable'); }; await assert.rejects(loadInventoryAnalytics(api, 'owned', null, 'token'), /Network/);
});
test('six labelled cards, overlapping badges and existing expiry-date formatting render read-only', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { InventoryAnalyticsView } = await vite.ssrLoadModule('/src/components/InventoryAnalytics.jsx');
    let navigations = 0, retries = 0; const view = InventoryAnalyticsView({ pharmacyId: 'owned', data: parseInventoryAnalytics(fixture()), onViewInventory() { navigations++; }, onRetry() { retries++; } });
    const html = renderToString(view); for (const label of ['Total Medicines', 'Total Stock Units', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Expired', 'Needs Attention']) assert.ok(html.includes(label), label);
    assert.equal((html.match(/<dt>/g) || []).length, 6); assert.match(html, /<dd>41<\/dd>/); assert.match(html, /<dd>5<\/dd>/); assert.equal((html.match(/<dd>1<\/dd>/g) || []).length, 4);
    assert.match(html, /25 Oct 2026/); assert.match(html, /10 Oct 2026/); assert.equal((html.match(/<h4>Vitamin C<\/h4>/g) || []).length, 1); assert.match(html, /Expiring Soon<\/span><span[^>]*>Low Stock/);
    assert.doesNotMatch(html, /Edit Medicine|Delete Medicine|Change Quantity|<form|<input/);
    buttons(view).find(button => button.props.children === 'View Inventory').props.onClick(); assert.equal(navigations, 1); buttons(view).find(button => button.props.children === 'Refresh analytics').props.onClick(); assert.equal(retries, 1);
    const limited = renderToString(createElement(InventoryAnalyticsView, { pharmacyId: 'owned', data: { ...parseInventoryAnalytics(fixture()), hasMore: true, attentionTotal: 20 } })); assert.match(limited, /items needing attention/);
  } finally { await vite.close(); }
});
test('loading/error/empty/healthy/no-pharmacy are distinct and never fake zero metrics during loading', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { InventoryAnalyticsView } = await vite.ssrLoadModule('/src/components/InventoryAnalytics.jsx');
    const render = props => renderToString(createElement(InventoryAnalyticsView, { pharmacyId: 'owned', ...props }));
    const loading = render({ loading: true }); assert.match(loading, /Loading inventory analytics/); assert.doesNotMatch(loading, /Total Medicines|<dd>/);
    assert.match(render({ error: 'Unavailable' }), /Retry analytics/); assert.doesNotMatch(render({ error: 'Unavailable' }), /<dd>/);
    const zero = Object.fromEntries(Object.keys(fixture().summary).map(key => [key, 0])); const empty = render({ data: { summary: zero, needsAttention: [], attentionTotal: 0, hasMore: false } }); assert.equal((empty.match(/<dd>0<\/dd>/g) || []).length, 6); assert.match(empty, /No inventory items need attention/);
    assert.match(render({ data: { summary: { ...zero, totalMedicines: 2, totalStockUnits: 40 }, needsAttention: [], attentionTotal: 0, hasMore: false } }), /Your inventory currently has no low-stock/);
    assert.match(render({ pharmacyId: null }), /Select or create your pharmacy/);
  } finally { await vite.close(); }
});
test('customer/guest cannot render analytics; owner dashboard keeps existing tabs and inventory navigation', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  try {
    const { default: Analytics } = await vite.ssrLoadModule('/src/components/InventoryAnalytics.jsx'); const { AuthContext } = await vite.ssrLoadModule('/src/auth/AuthContext.jsx');
    for (const user of [null, { role: 'customer' }]) assert.equal(renderToString(createElement(AuthContext.Provider, { value: { user } }, createElement(Analytics, { pharmacyId: 'owned' }))), '');
    assert.match(renderToString(createElement(AuthContext.Provider, { value: { user: { id: 'owner', role: 'pharmacy_owner' } } }, createElement(Analytics, { pharmacyId: 'owned' }))), /Loading inventory analytics/);
    const dashboard = readFileSync(new URL('../src/pages/PharmacyDashboard.jsx', import.meta.url), 'utf8'); for (const text of ['Inventory Analytics', 'Medicine Inventory', 'Customer Reviews', 'Hold Requests', 'Opening Hours']) assert.ok(dashboard.includes(text)); assert.match(dashboard, /onViewInventory=\{\(\) => \{ setQuery\(''\); setExpiryFilter\('all'\); setTab\('inventory'\)/);
    const component = readFileSync(new URL('../src/components/InventoryAnalytics.jsx', import.meta.url), 'utf8'); assert.match(component, /if \(!pharmacyId\) return/); assert.match(component, /controller.abort\(\)/);
    const css = readFileSync(new URL('../src/styles/InventoryAnalytics.css', import.meta.url), 'utf8'); assert.match(css, /minmax\(0, 1fr\)/); assert.match(css, /@media\(max-width: 600px\)/); assert.match(css, /overflow-wrap: anywhere/);
  } finally { await vite.close(); }
});
