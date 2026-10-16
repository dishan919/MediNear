# Medicine Hold Requests

## Architecture discovered

Pharmacy.inventory is an embedded array of Mongoose subdocuments with ObjectId _id, name, quantity (nonnegative safe integer), optional price, updatedAt and related display fields. There is no separate Medicine collection. The existing Pharmacy schema uses optimisticConcurrency, and owner inventory mutations use document.save(). User authentication uses protect plus customer/pharmacy_owner role middleware. Pharmacy.owner references User, and owners can select among their pharmacies on the existing dashboard.

Low Stock is defined by the existing shared stockStatus utility, with threshold 5. Existing restock processing recognizes quantity <=0 to positive, using a transaction to update inventory and notifications. The existing databaseCapabilities helper checks actual MongoDB topology, not NODE_ENV. Frontend uses the existing Axios helper, ToastContext, controlled React components and Node/Vite SSR tests.

## Model and workflow

New HoldRequest collection: immutable required customer (User ObjectId), pharmacy (Pharmacy ObjectId), medicine (embedded inventory ObjectId), positive safe-integer quantity, enum status, createdAt and updatedAt. Status defaults to pending. No price, customer email/phone, address or medicine snapshots are stored. Display names are resolved from current records, with Pharmacy unavailable/Medicine unavailable/Customer fallbacks for deleted records.

Only these transitions are exposed:
- pending -> accepted by the pharmacy owner, with a successful stock transaction.
- pending -> rejected by the pharmacy owner, without changing stock.
- pending -> cancelled by the same customer, without changing stock.

Terminal states cannot be reverted, accepted again or cancelled. Clients cannot set arbitrary status values. Creating a request always sets pending regardless of supplied status/customer identity fields. Pending explicitly means Waiting for pharmacy confirmation., never a reservation. Accepted means Confirmed by pharmacy. No price lock, medical advice, dosage/prescription guidance, fulfilment tracking or automatic expiry is added. Expiry/release of accepted holds is a future product feature and would require its own safe stock workflow.

Duplicate rule: a partial unique index on customer/pharmacy/medicine where status=pending permits only one pending request for that combination. Rapid concurrent creates produce one success and one 409. After rejection, cancellation or acceptance a later request is allowed; historical requests are not blocked forever. Customer and pharmacy newest-first listing indexes support pagination.

## API and authorization

Routes follow existing pharmacy/user conventions and are mounted under /api using the existing style of feature routers:
- POST /api/pharmacies/:id/hold-requests (customer): body { medicineId, quantity }.
- GET /api/users/hold-requests?page=1 (customer): own requests only.
- PATCH /api/users/hold-requests/:requestId/cancel (customer): own pending request only.
- GET /api/pharmacies/:id/hold-requests?page=1 (owner): owned pharmacy only.
- PATCH /api/pharmacies/:id/hold-requests/:requestId/accept (owner).
- PATCH /api/pharmacies/:id/hold-requests/:requestId/reject (owner).

JWT identity is authoritative. Customer identity is derived from req.user; customerId in a body has no authority. Owner access first verifies Pharmacy._id plus Pharmacy.owner against req.user._id. A request must also belong to that verified pharmacy. Changing either URL ID does not grant cross-owner access. Guests and wrong roles are rejected by the existing middleware. There is no public request-by-ID endpoint. Customer lists filter by authenticated customer; owner lists filter by the verified pharmacy.

Creation validates IDs, pharmacy existence, inventory membership, positive safe-integer quantity and current stock >= requested quantity. Numeric strings, zero, negative, fractional, invalid and above-stock quantities are rejected. Creation reads stock but never updates it. A later stock change can make a pending request unfulfillable; acceptance always checks current stock again.

## Atomic stock accounting and transactions

Acceptance uses the existing topology helper. Standalone MongoDB returns 503 with: Accepting holds requires MongoDB Atlas or a replica set. The request and inventory were not changed. Create/list/reject/cancel remain usable there. There is deliberately no unsafe standalone fallback.

On a replica set/Atlas, mongoose.connection.transaction performs both writes in one transaction:
1. Conditionally change the request from pending to accepted, matching its ID and pharmacy.
2. Conditionally decrement that inventory item only when the pharmacy still belongs to the owner and the matching item has quantity >= requested quantity.

Any missing/nonpending request, insufficient stock, missing medicine/pharmacy or write failure aborts the transaction and rolls back both changes. Concurrent transactions use MongoDB conflict handling/retries. Two requests for two units against stock three cannot both commit: exactly one can consume two, leaving stock one and the losing request pending. Retrying an accepted request cannot decrement stock again. Reject/cancel use atomic pending-state predicates; their races with acceptance cannot reopen terminal states.

The stock update also increments Pharmacy.__v and updates the item's updatedAt. This is essential because existing owner inventory saves use optimistic concurrency: a stale pre-acceptance inventory document cannot overwrite the accepted reduction. Integration tests verify such a stale save raises VersionError. The existing Pharmacy/inventory schema and owner inventory logic are unchanged.

Accepting only decreases quantity and intentionally does not call restock fulfilment. It cannot generate a false restocked notification. Existing zero-to-positive restock behavior is unchanged and was regression-tested on a temporary replica set. Existing Low Stock logic is reused without changes; after acceptance a normal reload shows the new quantity and badge. Owner acceptance refreshes the dashboard's inventory snapshot as well.

## UI and privacy

Available medicine cards expose Request Hold to authenticated customers only. The quantity input is visibly labelled and bounded by current displayed stock; backend validation remains authoritative. An inline form sends only medicineId/quantity to the pharmacy-scoped endpoint. It disables conflicting controls with Sending... and a synchronous mutation lock. Success shows Hold request sent., followed by Pending: Waiting for pharmacy confirmation. and a link to /profile#my-hold-requests.

My Hold Requests is a section within the existing customer Profile page, avoiding new top-level navigation. It lists readable Pending/Accepted/Rejected/Cancelled statuses and their explanations, with Cancel Request only for pending items. Existing Change Password and Profile Photo sections remain unchanged.

Owners get a Hold Requests tab for the selected owned pharmacy. Pending cards show customer display name, medicine, quantity, request date and Accept/Reject. Terminal cards have no actions. Accepting.../Rejecting.../Cancelling... labels and disabled controls protect in-flight operations. Existing toast messages are reused: Hold request accepted., Hold request rejected., Hold request cancelled. No new toast architecture was introduced.

Both lists use ten-item pages, createdAt descending then _id descending, positive page numbers capped at 100000, Previous/Next controls and explicit Refresh hold requests. Lists distinguish loading, empty, API error and action-error states. Responses are validated before rendering. Reads/mutations are aborted on unmount and callbacks check abort state. Aborting a submitted mutation does not guarantee the server has not already completed it; refresh to reconcile.

List queries project only the hold resource ID, quantity/status/timestamps, medicine name, pharmacy name and, for the owner, User.name. They exclude customer IDs, contact information, password/hash, JWT, location/history and other account fields. Frontend projection also discards extra fields. No customer medical information is collected. Price is not copied or guaranteed. Request forms/list controls reuse existing buttons/badges/focus styling, wrap on mobile and use labelled inputs, associated errors and readable status text.

## Files

Created:
- backend/models/HoldRequest.js
- backend/services/holds.js
- backend/controllers/holdController.js
- backend/routes/holdRoutes.js
- backend/tests/holds.test.js
- backend/tests/integration/holds.integration.js
- medinear/src/utils/holds.js
- medinear/src/components/RequestHold.jsx
- medinear/src/components/HoldRequests.jsx
- medinear/src/styles/Holds.css
- medinear/tests/holds.test.js
- medinear/tests/integration/holds.integration.js
- docs/MEDICINE_HOLD_REQUESTS.md

Modified:
- backend/server.js: mount feature router.
- medinear/src/components/MedicineCard.jsx: mount customer hold action.
- medinear/src/pages/Profile.jsx: customer My Hold Requests section.
- medinear/src/pages/PharmacyDashboard.jsx: owner Hold Requests tab and post-acceptance inventory refresh.

## Validation results

- Backend npm test: 59 passed.
- Frontend npm test: 102 passed.
- Backend relevant integration on existing standalone development MongoDB: 2 passed, 2 transaction-specific tests skipped (hold acceptance subtest and existing restock transaction test). These tests explicitly checked that standalone acceptance fails safely.
- Isolated temporary replica-set backend integration: 3 passed, zero skipped (hold workflow, real acceptance/concurrency subtest, existing restock transaction/rollback test).
- Frontend npm run test:integration on the regular development database: 4 passed.
- New frontend hold integration repeated on the temporary replica set: 1 passed, including real accept -> stock 3 -> Accepted/Confirmed by pharmacy -> existing Low Stock rendering.
- Backend npm run lint (repository syntax checks): passed.
- Frontend npm run lint: passed without warnings.
- Frontend npm run build: passed.
- git diff --check: passed.

The temporary replica set used the already installed mongod executable, an ephemeral localhost port and a temporary data directory. It was stopped and removed; existing MongoDB configuration and .env files were not changed. Test accounts, pharmacies and hold requests were cleaned up. Concurrency was checked with real transactions, not only mocks. A transactional unit harness also covers rollback on an injected stock-write failure. Frontend tests follow the existing SSR/controlled-view approach and are not mounted-browser automation. Manual browser/mobile checks below remain unexecuted.

Explicit scope: no dependencies added. A new HoldRequest model/collection/indexes were added. Existing inventory schema unchanged. Smart Ranking and Nearest First unchanged. Restock Alert behavior and Low Stock threshold unchanged. Nothing pushed or deployed.

## Exact manual browser checks

Start backend npm run dev and medinear npm run dev with the usual development configuration. For successful acceptance, use an already configured replica-set/Atlas development database. Do not expect acceptance to succeed on standalone MongoDB: it should show the explicit 503 message without changing request/stock. Use disposable customers A/B, owner O, another owner X, and a test pharmacy P owned by O. Set an embedded medicine's stock to 5 through existing owner inventory controls.

A. Sign in as A. Find P and open Pharmacy Details, or an available medicine card in search results. Click Request Hold for the test medicine, enter 2 and Send Hold Request. Expect Hold request sent., Pending and Waiting for pharmacy confirmation. Verify stock remains 5. Use the My Hold Requests link to open the section in Profile; verify the pending card and Cancel Request. Empty/zero/fractional/above-stock values should show validation without sending a write request. A double-click while throttled should produce one request.

B. Sign in as O, select P in Owner Dashboard and open Hold Requests. Find A's pending request and click Accept. On a transaction-capable database expect Hold request accepted., status Accepted, no Accept/Reject controls for that item and inventory quantity 3. On standalone expect the clear transaction requirement, status still Pending and stock still 5. No success toast should appear for a failed acceptance.

C. Sign back in as A. Open My Profile, scroll to My Hold Requests and click Refresh hold requests (or reload). Following successful acceptance expect Accepted and Confirmed by pharmacy., with no Cancel Request. Reload medicine details/search and verify quantity 3 and the existing Low Stock indicator. There is no price guarantee.

D. Create a new pending request and have O reject it. Expect Hold request rejected., then Rejected/Request declined by pharmacy. in the customer's refreshed list. Stock must not change. Try rejecting the same resource again via a local authenticated request: expect 409.

E. Create another pending request and cancel it as its customer. Expect Hold request cancelled., Cancelled/Request cancelled. and unchanged stock. Create a later request for the same medicine to verify terminal history does not block future requests. A concurrent second pending request from the same customer must receive 409; it must not create a duplicate.

F. With stock sufficient, create a pending request for 2. In owner inventory reduce stock to 1 before acceptance. Attempt Accept: expect a conflict, unchanged stock 1 and request still Pending. For the race case set stock to 3, have A and B each request 2, then accept both quickly from two owner tabs. Exactly one may succeed; final stock must be 1, with the other pending. Repeating acceptance of the winner must not reduce stock again.

G. As X, try GET/PATCH requests against P's Hold Requests URLs using X's own token. Expect 404/denial. Using A's token, attempt cancellation of B's pending request: expect denial and no change. Owners must receive 403 when attempting customer creation/cancellation endpoints; customers must receive 403 on owner list/accept/reject endpoints. Never share captured tokens. Inspect list responses to confirm no customer email/phone/address/password/hash/JWT/location/customer ID is exposed.

H. Verify Medicine Search, Low Stock, Restock Alerts, owner inventory editing, Owner Reviews, Smart Ranking and Nearest First behave normally. On a replica-set database verify an ordinary zero-to-positive inventory restock still creates its normal notification, while accepted holds create no restock notification. Verify Profile Photo and Change Password still work.

I. At 375 x 812 responsive size, check quantity forms, status cards and Accept/Reject/Cancel controls wrap without horizontal scrolling. Tab through the labelled input/actions and verify visible focus and readable errors. Check document.documentElement.scrollWidth <= window.innerWidth. Throttle/offline the API to verify loading/error states and retry/refresh without crashing the rest of the page. Owners with no pharmacy should not issue hold-list requests; customer empty state should read No hold requests yet.
