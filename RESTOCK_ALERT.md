# Medicine Restock Alert implementation

**Follow-up:** [RESTOCK_ALERT_FIX.md](RESTOCK_ALERT_FIX.md) supersedes the standalone subscription limitation and validation counts in this original implementation report. Status, subscribe, cancel and notification APIs now work on standalone MongoDB. Owner restock writes still require a replica set or Atlas.

## Architecture

Backend: Express/CommonJS, Mongoose, JWT `protect` middleware and `requireRole`. Pharmacy ownership is checked in the inventory controller. Medicines are embedded Pharmacy inventory subdocuments with stable MongoDB `_id` values. Customers and pharmacy owners are the two supported roles.

Frontend: React/Vite, React Router customer/owner route guards, AuthProvider, the existing Axios API instance, shared MedicineCard and PharmacyCard components, and green MediNear styles. Existing tests use Node's test runner, mocked Express HTTP requests, Vite SSR rendering, and explicit local MongoDB integration tests.

## Created files

- backend/models/RestockSubscription.js
- backend/models/Notification.js
- backend/controllers/alertController.js
- backend/routes/alertRoutes.js
- backend/services/restock.js
- backend/tests/restock.test.js
- backend/tests/integration/restock.integration.js
- medinear/src/api/alerts.js
- medinear/src/auth/AlertsContext.jsx
- medinear/src/auth/AlertsProvider.jsx
- medinear/src/components/RestockAlert.jsx
- medinear/src/components/NotificationBell.jsx
- medinear/src/pages/Notifications.jsx
- medinear/tests/restockUi.test.js
- RESTOCK_ALERT.md

## Modified files

- backend/controllers/pharmacyController.js: transactional restock handling and optional search filter.
- backend/models/Pharmacy.js: optimistic concurrency for inventory/subscription serialization.
- backend/server.js: register alert API routes.
- backend/services/ranking.js: optionally include out-of-stock results, keep available results first, preserve opening/location/emergency filters.
- backend/package.json: integration script now discovers all integration tests.
- backend/tests/pharmacyApi.test.js: database mocks support the restock path.
- medinear/src/App.jsx: alerts provider and protected customer Notifications route.
- medinear/src/components/BottomNav.jsx: notification link in the existing customer navigation.
- medinear/src/components/Icon.jsx: bell icon.
- medinear/src/components/MedicineCard.jsx: out-of-stock alert control.
- medinear/src/components/PharmacyCard.jsx: pass actual pharmacy ID to medicine cards.
- medinear/src/pages/Home.jsx: notification bell and optional out-of-stock search checkbox.
- medinear/src/pages/PharmacyDetails.jsx: bell and pharmacy ID for medicine alerts.
- medinear/src/styles/MedicineUI.css: responsive alert and notification styles using existing colors.

## API

All new endpoints require the existing Bearer token and customer role; user IDs come exclusively from `req.user`.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/restock-subscriptions | Current customer's active subscriptions |
| POST | /api/restock-subscriptions | Subscribe with `{ pharmacy, medicine }` MongoDB IDs |
| DELETE | /api/restock-subscriptions/:id | Cancel own active subscription |
| GET | /api/notifications | Own latest 100 notifications and total unread count |
| PATCH | /api/notifications/:id/read | Mark own notification read |

Existing search accepts `includeOutOfStock=true`. Without this parameter, zero-stock medicines remain excluded exactly as before. Customer UI route: `/notifications`.

## Database and restock detection

RestockSubscription stores customer, pharmacy, embedded medicine ID, active state, fulfilledAt and timestamps. A partial unique compound index prevents duplicate active subscriptions for the same customer/pharmacy/medicine. Fulfilled or canceled subscriptions allow a new subscription during a later stock cycle.

Notification stores customer (`user`), unique subscription reference, type, title, message, pharmacy, medicine ID/name, read state and timestamps. Notification text uses the actual medicine and pharmacy names.

Only an existing medicine PATCH with old quantity exactly 0 and new quantity greater than 0 triggers notifications. Inventory save, notifications and subscription fulfillment share one MongoDB transaction. Positive-to-positive, positive-to-zero, unchanged zero, and adding new inventory do not trigger restock notifications.

Subscription creation also uses a transaction and increments the pharmacy version to serialize with inventory saves. Pharmacy optimistic concurrency rejects stale saves with a useful 409 response. Ownership and role checks remain in place. Notifications and cancellation queries always include the authenticated customer ID, returning 404 for another customer's records.

No additional packages, production environment edits, notification services, push, email or SMS were added. Standard Mongoose index creation builds the new indexes; deployments that disable autoIndex must provision the declared indexes separately.

## Validation results

- Backend `npm test`: 24 passed.
- Frontend `npm test`: 17 passed.
- Backend syntax lint: passed.
- Frontend Oxlint: passed without warnings.
- Frontend production build: passed.
- Existing backend MongoDB integration test: passed.
- Existing frontend MongoDB/API/render integration test: passed.
- New transaction database integration test: skipped because the configured local MongoDB is standalone. It runs against an explicitly permitted local development replica set. The integration guard deliberately refuses remote/production databases.
- `git diff --check`: passed.

New tests cover subscribe, duplicates, cancel, user isolation, authentication and roles, malformed/missing IDs, already-available medicine, all stock transitions, correct notification recipient, read ownership, later stock cycles, optional search and emergency filtering, and SSR UI states including active/cancel/loading/error, available medicine omission, unread bell and empty/read/unread notifications. HTTP feature tests follow the project's mocked-database approach. The new replica-set integration test additionally checks unique-index enforcement and transaction commit/rollback when a suitable database is available.

## Exact manual local flow

1. Run the backend against a development MongoDB replica set (or an authorized development Atlas database). **Standalone MongoDB cannot execute the transactions required for subscribing and restocking.** Use an existing development replica set connection; do not point development seeding/integration scripts at production. No environment files were changed by this implementation.
2. In one terminal: `cd backend`, then `npm run dev` (default API port 5000).
3. In another terminal: `cd medinear`, then `npm run dev`. Open the local URL Vite prints.
4. Log in as the owner of your test pharmacy. Open the dashboard inventory. Add Vitamin C with quantity 0, or change that existing medicine to 0 and save. Use real accounts and your own test pharmacy.
5. Log out, then log in as a customer. Search `Vitamin C` and check **Include out-of-stock medicines**. Find the test pharmacy. Click **Notify Me When Available** on its zero-stock Vitamin C card. The pharmacy details Medicines tab supports the same control.
6. Confirm **Restock alert active ?** and **Cancel Alert** appear. Reload and confirm the active state persists. Optionally cancel and subscribe again to verify cancellation.
7. Log out. Log in as the pharmacy owner. Open that pharmacy's inventory, change Vitamin C from 0 to 20 and save.
8. Log out. Log back in as the customer. The bell shows the real unread count. Open Notifications and confirm `Vitamin C is now available at [your pharmacy name]`.
9. Click **Mark as read**. Confirm the card says Read, the mark-read button disappears and the unread count decreases. Reload to verify persistence.
10. For a subsequent cycle, change stock to 0, create a fresh alert, then restock. Changing 20 to 30 or 20 to 0 alone must not create a notification.

Alerts refresh on login/mount, every 30 seconds, when the window regains focus, and after alert/read actions. This version uses in-app notifications only.

To rerun validation, run `npm test`, `npm run lint`, `npm run test:integration` in backend; and `npm test`, `npm run lint`, `npm run build`, `npm run test:integration` in medinear. The existing frontend integration test requires existing local development accounts. The new restock transaction integration test reports a skip on standalone MongoDB.

Nothing was pushed to GitHub or deployed to AWS.
