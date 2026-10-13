import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
test('restock controls, notification states and real unread bell render accessibly', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const render = element => renderToString(createElement(MemoryRouter, {}, element));
  try {
    const { RestockAlertView } = await server.ssrLoadModule('/src/components/RestockAlert.jsx');
    const view = props => render(createElement(RestockAlertView, props));
    assert.match(view({}), /Notify Me When Available/);
    assert.match(view({ subscription: {} }), /Restock alert active/);
    assert.match(view({ subscription: {} }), /Cancel Alert/);
    assert.match(view({ loading: true }), /disabled/);
    assert.match(view({ busy: true }), /Saving alert/);
    assert.match(view({ error: 'Network unavailable' }), /role="alert"/);
    const { AlertsContext } = await server.ssrLoadModule('/src/auth/AlertsContext.jsx');
    const { default: Card } = await server.ssrLoadModule('/src/components/MedicineCard.jsx');
    const alerts = { subscriptions: [], loading: false, unreadCount: 2 };
    const card = quantity => render(createElement(AlertsContext.Provider, { value: alerts }, createElement(Card, { pharmacyId: 'p', medicine: { _id: 'm', name: 'Vitamin C', quantity } })));
    assert.match(card(0), /Notify Me When Available/);
    assert.doesNotMatch(card(1), /Notify Me When Available/);
    const { default: Bell } = await server.ssrLoadModule('/src/components/NotificationBell.jsx');
    assert.match(render(createElement(AlertsContext.Provider, { value: alerts }, createElement(Bell))), /Notifications, 2 unread/);
    const { NotificationsView } = await server.ssrLoadModule('/src/pages/Notifications.jsx');
    assert.match(render(createElement(NotificationsView, { notifications: [] })), /No notifications yet/);
    const notification = { _id: 'n', pharmacy: 'p', title: 'Medicine Available', message: 'Vitamin C is now available at Test Pharmacy', createdAt: '2026-10-13', read: false };
    const unread = render(createElement(NotificationsView, { notifications: [notification] }));
    assert.match(unread, /Unread/); assert.match(unread, /Mark as read/); assert.match(unread, /Vitamin C is now available/);
    const read = render(createElement(NotificationsView, { notifications: [{ ...notification, read: true }] }));
    assert.match(read, /Read/); assert.doesNotMatch(read, /Mark as read/);
  } finally { await server.close(); }
});
