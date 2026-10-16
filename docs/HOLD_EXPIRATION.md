# Hold Expiration & Pickup Deadline

## Architecture and changes

Existing HoldRequest references User, Pharmacy and an embedded inventory item with immutable quantity, four statuses and createdAt/updatedAt. Acceptance already atomically decrements inventory and changes status in a MongoDB transaction, including Pharmacy.__v increments to protect optimistic inventory saves. There were no acceptance/deadline timestamps, pickup state or scheduler. Existing customer/owner role and ownership checks are retained.

New fields: acceptedAt, expiresAt, completedAt, expiredAt (UTC-backed Date values). New statuses: completed and expired. A status/expiresAt index supports due processing; there is no TTL deletion index. No inventory schema change.

The single policy in backend/services/holdPolicy.js is HOLD_DURATION_MS = 24 hours. Successful acceptance stores server acceptedAt and expiresAt = acceptedAt + that duration inside the existing stock transaction. Client timestamp/status fields are ignored. Transaction retries use current server time.

Existing pending -> accepted/rejected/cancelled rules remain. New transitions:
- accepted -> completed, owner only, before the valid server deadline. Stock stays consumed. Display: Collected / Picked up successfully.
- accepted -> expired, server-determined and transactional. Exactly the held quantity returns to available stock. Display: Expired / Hold expired before pickup.

New endpoint: PATCH /api/pharmacies/:id/hold-requests/:requestId/complete. It reuses owner-role and pharmacy-ownership verification. A conditional update matches accepted, valid dates and expiresAt > server now. No arbitrary status update or manual expiry endpoint was added. Customers still cancel pending requests only.

## Expiration, transactions and concurrency

Lazy expiration runs before customer hold lists, owner hold lists and relevant owner actions. Customer reads process that customer's holds; owner reads process the verified pharmacy's holds. Acceptance first processes overdue holds in its pharmacy; other owner actions process their target. This needs no open browser or scheduler. Stock is released on the next relevant backend call; ordinary medicine search does not trigger processing.

A pass checks for invalid accepted dates, then fetches at most 50 due IDs. Each is expired transactionally. A larger remaining backlog returns an explicit refresh/retry response so successive calls continue processing without unbounded reads. Existing ten-item newest-first pagination remains, including the new terminal statuses. No existing status filters needed extension.

Expiration transaction:
1. Conditionally change accepted -> expired only if valid expiresAt <= server now, recording expiredAt.
2. Atomically increment the same inventory item's quantity by the held quantity, updating its timestamp and Pharmacy.__v.
3. Commit both or roll back both.

The accepted-state condition makes restoration idempotent. Concurrent duplicate processing cannot restore twice; different holds use atomic increments and transaction conflict/retry handling, so quantities are not lost. A failed stock write or missing pharmacy/medicine aborts the status change. Safe-integer bounds are checked. The version increment prevents stale owner inventory saves from overwriting restored stock.

Collection is a single-document accepted-state transition and does not touch stock. It races with expiration on that same state: if collection wins, no restoration; if expiration wins, collection is rejected. Completed/rejected/cancelled records never expire. Repeated collection is rejected.

Returning held stock deliberately does not call fulfillRestock, even for zero -> positive quantities. Ordinary owner restock notifications are unchanged. The shared Low Stock helper/threshold remains unchanged and naturally reflects restored quantity. Successful owner hold-list reads refresh the existing owner inventory snapshot as well as acceptance.

Acceptance and stock-restoring expiration require Atlas/replica-set transactions. Standalone MongoDB fails safely with 503 before writing either resource. Non-due reads and ordinary pending workflows remain usable. Collection itself changes only one document. No unsafe fallback was added.

## Legacy and damaged records

Missing dates, epoch/zero dates, wrong BSON types or expiresAt <= acceptedAt are not safe evidence for releasing stock. The relevant operation returns 409 with reconciliation guidance, leaving stock and status unchanged. Pre-feature accepted holds without dates require operator/pharmacy reconciliation; no deadline is silently inferred from updatedAt. Such a record can block its scoped list until repaired. Missing inventory likewise requires reconciliation rather than fabricating stock or falsely marking expired.

## UI, time and privacy

Safe responses include the new timestamps where present and top-level serverNow. Existing identity/privacy projections remain; no private customer data was added. Clients do not send deadlines or ownership in pickup requests.

Accepted customer/owner cards show Pickup by using the existing Intl en-GB formatter with Asia/Colombo and an explicit Sri Lanka time label. Remaining time uses serverNow plus elapsed monotonic performance.now(), avoiding browser wall-clock skew. It reuses the existing shared pharmacy minute clock and its unsubscribe cleanup; no per-second timer or new opening-hours behavior was introduced.

At zero the text asks users to refresh for confirmed status. No client status mutation or expiry toast occurs. The owner pickup button disappears when the presentation estimate reaches the deadline; the server still makes the authoritative decision. Refresh obtains committed expiry/collection state. Unavailable dates/time anchors display a safe unavailable message.

Mark as Collected appears only on accepted owner cards with valid dates and a future server-based estimate, and disables during conflicting actions. Success reuses ToastContext: Hold marked as collected. Expired/Collected show no Accept/Reject/pickup controls. Pending controls, loading, empty, errors, pagination and customer cancellation remain. Backend expiry failures appear as actionable errors, never successful expiry.

## Files

Created: backend/services/holdPolicy.js; backend/tests/holdExpiration.test.js; backend/tests/integration/holdExpiration.integration.js; medinear/src/utils/holdDeadline.js; medinear/src/components/HoldDeadline.jsx; medinear/tests/holdExpiration.test.js; docs/HOLD_EXPIRATION.md.

Modified: backend/models/HoldRequest.js; backend/services/holds.js; backend/controllers/holdController.js; backend/routes/holdRoutes.js; medinear/src/utils/holds.js; medinear/src/components/HoldRequests.jsx; medinear/src/pages/PharmacyDashboard.jsx (stock-refresh failure wording); medinear/src/styles/Holds.css; medinear/tests/holds.test.js (extended status fixture, retaining assertions); medinear/tests/integration/holds.integration.js (extended through expiry/collection).

## Validation

- Backend npm test: 63 passed.
- Frontend npm test: 106 passed.
- Isolated replica-set backend integration: 4 passed, zero skipped (new expiration lifecycle/races, existing hold acceptance/race and restock transaction/rollback).
- Frontend npm run test:integration on regular local database: 4 passed.
- Extended frontend hold integration on the temporary replica set: 1 passed, including expiry restoration/idempotency, deadlines and Collected state.
- Regular standalone relevant backend integration: 1 passed, 3 transaction-specific tests skipped as designed; standalone refusal is also unit-tested.
- Backend lint (syntax checks), frontend lint (no warnings), production build and git diff --check: passed.

Real replica-set tests cover double expiration, expiry vs collection, concurrent multi-hold restoration, exact stock return, before-cutoff behavior, client timestamp rejection, missing inventory rollback, invalid/legacy dates, privacy/ownership and zero -> positive restoration without restock notifications. Frontend tests cover deadline/countdown formatting, sub-hour/cutoff text, shared timer cleanup, collection payload/toast and existing hold regressions. The installed mongod binary ran on an isolated temporary localhost replica set; its process/data were removed. Existing MongoDB config and .env files were unchanged. Browser/mobile checks below remain unexecuted; frontend tests follow the existing SSR/controlled-view approach.

Explicit scope: dependencies added: no. HoldRequest schema changed: yes. Inventory schema changed: no. Smart Ranking/Nearest First changed: no. Restock Alert semantics changed: no. Pushed: no. Deployed: no.

## Exact browser checks

Start backend/frontend normally on a development replica-set/Atlas database. Use disposable accounts/pharmacy/medicine with stock 5. Standalone MongoDB intentionally cannot accept/expire transactionally.

A. Customer requests quantity 2; owner opens Hold Requests and Accepts. Expect Accepted, Pickup by about 24 hours later, remaining time and stock 3. Inspect Network: server acceptedAt/expiresAt differ by exactly the configured duration; client bodies choose neither.

B. Customer opens Profile -> My Hold Requests and refreshes. Expect the same deadline in Sri Lanka time and readable remaining time. Changing the browser wall clock must not change backend state. Pending/rejected/cancelled cards have no pickup deadline/countdown; accepted customer cards have no Cancel Request.

C. Before cutoff owner clicks Mark as Collected. Expect Hold marked as collected., Collected and Picked up successfully.; stock remains 3. Refresh both pages to verify persistence. Repeated collection must receive 409; customer/other-owner attempts must be denied.

D. Create a separate disposable hold and accept it. Note its resource ID. Use the local-only script below to put this test hold's dates in the past while leaving its already-reduced stock untouched. Refresh its customer or owner hold list: expect Expired, Hold expired before pickup. and exact stock restoration. Repeated refreshes must not restore twice. No expiry toast or restock notification should appear, including when the hold consumed all stock.

E. Confirm collected holds stay Collected after their original deadline and do not restore stock. The automated replica-set test advances service time for this. For a manual disposable-data check, move a completed record's original dates into the past using a local DB tool, leaving its completed status intact, and refresh.

F. Verify create/cancel, Accept/Reject, duplicate protection, owner inventory, Low Stock and ordinary owner zero-to-positive restock notifications still work. Expiry restoration must not send those notifications. Offline/API errors must not show a successful Expired state. Legacy/damaged accepted dates should show reconciliation feedback rather than guessed release.

G. At 375 x 812 verify deadline/countdown/status/buttons wrap without horizontal scrolling. Tab through controls, check visible focus and inspect document.documentElement.scrollWidth <= window.innerWidth. Refresh/reopen after cutoff to verify backend state is independent of previous timer state.

For D, create a temporary expiry-test.cjs inside backend containing the following, replace the disposable request ID, run node expiry-test.cjs from backend, then delete that temporary script. It deliberately refuses remote/production databases using the existing development guard. For remote development Atlas, use the isolated replica-set automated tests instead of relaxing this guard.

```javascript
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Hold = require('./models/HoldRequest');
const { HOLD_DURATION_MS } = require('./services/holdPolicy');
require('./scripts/seed').assertDevelopmentDatabase(process.env.MONGO_URI, process.env.NODE_ENV);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const id = 'REPLACE_WITH_DISPOSABLE_ACCEPTED_HOLD_ID';
    if (!mongoose.isObjectIdOrHexString(id)) throw new Error('A valid test ID is required');
    const now = Date.now();
    const result = await Hold.updateOne({ _id: id, status: 'accepted' }, {
      $set: { acceptedAt: new Date(now - HOLD_DURATION_MS - 1000), expiresAt: new Date(now - 1000) }
    });
    if (result.modifiedCount !== 1) throw new Error('Accepted test hold not found');
    console.log('Disposable hold is due. Refresh its authenticated list to process expiry.');
  } finally { await mongoose.disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
```
