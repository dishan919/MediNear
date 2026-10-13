# Restock Alert debugging and fix report

## 1. Root cause: confirmed failure versus reported GET

The exact **reported GET `/api/restock-subscriptions` 500 could not be reproduced** against the currently running local server. Before changes, the authenticated GET returned 200 with an empty subscriptions array; querying the same model directly also succeeded. Notification GET and unread-count queries succeeded. After changes, GET returned 200 for all six existing local customer accounts.

A separate, reproducible defect was confirmed: **POST `/api/restock-subscriptions` returned 500** because subscription creation unconditionally entered a MongoDB transaction. A diagnostic read in the same kind of transaction threw `MongoServerError`, code **20**, with the exact message `Transaction numbers are only allowed on a replica set member or mongos`. This is the confirmed exception for POST; it is not evidence that GET used a transaction.

The original GET handler was already transaction-free. Its request has no route parameters or query parameters when called by the UI. It filters `{ customer: req.user._id, active: true }` and sorts by creation date. Existing JWT protection loads a Mongoose User document with `_id`; the public profile response separately uses `id`. The frontend API target was verified to be `localhost:5000/api`. Model references, stable inventory IDs, route ordering and imports matched the implementation. No defect in those relationships was observed.

The original error wrapper suppressed the exception entirely. In addition, AlertsProvider used one Promise.all and one error state for both subscriptions and notifications. Consequently, an inbox failure could display "Unable to process alerts" on an otherwise successful medicine status read. This coupling was confirmed in code; a real inbox failure was not observed locally.

No claim is made that the historical browser GET failure is conclusively diagnosed. If it recurs after restart, the new server diagnostic identifies the failing route, exception type, database error code and development call frames without printing request data or raw sensitive messages.

## 2. Why prior validation missed the confirmed defect

Previous subscription HTTP tests mocked transactions as successful. The real database integration test only exercised owner/auth flows. The transaction test skipped standalone MongoDB, so real subscription creation on standalone had not been tested.

## 3. Files changed in this debugging pass

Modified:

- backend/controllers/alertController.js
- backend/controllers/pharmacyController.js
- backend/services/restock.js
- backend/tests/restock.test.js
- backend/tests/pharmacyApi.test.js
- medinear/src/auth/AlertsProvider.jsx
- medinear/src/components/RestockAlert.jsx
- medinear/src/components/NotificationBell.jsx
- medinear/src/pages/Notifications.jsx
- RESTOCK_ALERT.md (follow-up notice)

Created:

- backend/services/databaseCapabilities.js
- backend/utils/logServerError.js
- backend/tests/databaseCapabilities.test.js
- backend/tests/integration/alerts.integration.js
- medinear/src/auth/loadAlerts.js
- medinear/tests/loadAlerts.test.js
- RESTOCK_ALERT_FIX.md

Existing authentication, models/indexes, API base URL, routing guards, theme, and dependencies were preserved.

## 4. Exact fix

Subscription POST validates IDs, pharmacy, embedded medicine and availability first. It then inspects the actual MongoDB topology using `hello`, rather than NODE_ENV or a transaction-error fallback.

- Replica set / mongos: keep the original transaction, pharmacy-version serialization and subscription insertion.
- Standalone: insert the subscription document directly; the existing partial unique index still prevents duplicate active subscriptions. Critical owner restocks are refused on standalone, so this does not introduce a nontransactional notification path.
- Topology inspection failure: return a genuine safe server error; never silently fall back.

GET, cancellation and notification endpoints do not perform topology inspection or start transactions. GET `/api/restock-subscriptions` still lists own active subscriptions. With paired `pharmacy` and `medicine` query parameters, it validates those IDs and resources and additionally returns `subscribed: false/true`. Missing alerts are normal successful responses. Missing/invalid paired IDs return 400; missing pharmacy/medicine returns 404.

Unexpected alert errors now log route/method, error type/code and development call frames safely. Responses retain useful generic messages and do not include stacks, connection strings, tokens, bodies or headers. Validation/Cast errors map to 400. Duplicate index errors map to 409. Notification updates use the current `returnDocument: 'after'` option.

Frontend loading tracks subscriptions separately from notifications. A notification failure no longer disables the alert control or masquerades as a status failure. Successful retry clears the relevant error using fresh backend data, preserves loading/retry states, and does not invent subscription state. The active-status checkmark is rendered correctly.

## 5. Local standalone support

Verified with real local MongoDB and HTTP requests:

- Login and authenticated profile: success.
- GET subscription list / unsubscribed status: 200.
- POST subscription: 201.
- Independent status request after subscribing: 200, subscribed=true.
- Duplicate subscription: 409.
- Cancel own subscription: 200.
- Independent status request after canceling: 200, subscribed=false.
- Another customer: cannot cancel or see the subscription.
- Notifications: read and mark-read work with ownership checks.

These operations no longer require a replica set. Test records were temporary and removed after validation.

## 6. Atlas transaction guarantees

Owner restock detection now uses finite old quantity <= 0 and new quantity > 0. Replica-set/Atlas inventory save, notification creation and fulfillment remain in the same transaction. Subscription creation on those topologies retains its transaction and pharmacy version increment to serialize against restocks.

On standalone, owner restock returns **503** with `Restocking requires MongoDB Atlas or a replica set. Inventory was not changed.` Database integration verified quantity stays zero, the subscription stays active and no additional notification is created. Positive-to-positive, positive-to-zero and ordinary inventory operations preserve their prior behavior.

No development fallback for critical restock writes was added. No NODE_ENV safety bypass or silent production downgrade was introduced. Atlas transaction commit/rollback still needs testing on a replica set; the existing dedicated test remains skipped on this standalone server.

## 7. Regression tests

- New real MongoDB integration test: actual login, GET empty/nonempty status, subscribe, independent reload requests, cancel/reload, unique-index duplicates, invalid and nonexistent resources, wrong role, guest and user isolation, notifications/read access, search/details, and standalone restock refusal with unchanged database state.
- Extended HTTP tests: optional per-medicine GET status, invalid IDs, fresh status after subscribe/cancel, safe diagnostics for an injected genuine GET query exception, successful read after failure, standalone subscribe without calling transactions, and retained replica-set transaction behavior.
- Database capability tests: standalone/replica-set/mongos selection and fail-closed topology errors.
- Frontend load tests: notification failure does not turn successful subscription reads into errors; successful retry clears a previous backend error and uses new server data.

The injected GET exception tests error handling, not a claimed reproduction of the unidentified historical GET exception.

## 8. Final validation

| Check | Result |
|---|---|
| Backend npm test | 26 passed |
| Frontend npm test | 19 passed |
| Backend syntax lint | Passed |
| Frontend Oxlint | Passed, no warnings |
| Frontend production build | Passed |
| Backend database integration | 2 passed, 1 skipped (replica-set transaction test) |
| Frontend database/API/render integration | 1 passed |
| git diff --check | Passed |

The current backend was started with `npm run dev` on port 5000 after the previous local listener was no longer available. Live endpoint verification also passed against port 5000 for all six existing customers and the complete subscribe/status/cancel/status cycle.

Browser-level manual verification could not be performed: no enabled browser surface was connected and the in-app browser was unavailable. API/database flow and React SSR rendering were tested, but browser clicks and reloads must still be checked manually.

## 9. Exact manual steps

1. Ensure the backend process uses this updated workspace. Restart it if necessary: `cd backend`, then `npm run dev`. A backend was started on port 5000 during this task; stop that listener before starting a second one on the same port.
2. Restart the frontend if needed: `cd medinear`, then `npm run dev`. Open the URL printed by Vite.
3. Log in with your existing customer account. Open a pharmacy with a quantity-0 medicine. No replica-set configuration is needed for this customer flow.
4. The card should show **Notify Me When Available**. If it retains an old error, click **Retry alert status**. Network GET `/api/restock-subscriptions` should return 200; an empty list is normal.
5. Click **Notify Me When Available**. POST should return 201 and the UI should show **Restock alert active ?** and **Cancel Alert**.
6. Refresh the browser. The real GET response should contain that active subscription and the active UI should persist.
7. Click **Cancel Alert**. DELETE should return 200. Refresh and verify the button returns to **Notify Me When Available**.
8. Open Notifications. GET `/api/notifications` should return 200. Existing notifications can be marked read; an empty inbox should show **No notifications yet.**
9. To locate the medicine through search, enable **Include out-of-stock medicines**. Default available-only search is unchanged.
10. Do not expect owner 0-to-positive restock to succeed on standalone. It intentionally returns 503 without inventory changes. Test the notification-producing restock later against an authorized development Atlas/replica-set database.
11. If **GET** still returns 500, check the updated backend terminal for `Server operation failed` and operation `GET /restock-subscriptions`. Share only that safe diagnostic and the request method/URL, without JWTs, headers, passwords or environment contents. This is the remaining evidence needed to identify the originally reported GET exception.

No credentials or environment files were changed. No GitHub push or deployment was performed.
