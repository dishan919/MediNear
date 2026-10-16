# Medicine Expiry Tracking

## Existing architecture and schema

Medicine inventory is embedded in Pharmacy.inventory, with subdocument ObjectId, name/genericName/brand, quantity, price, images and timestamps. Owner inventory create/edit routes use JWT owner-role and Pharmacy.owner ownership checks, validateMedicine and optimistic document saves. Search uses the inventory/publicMedicine helpers and rankPharmacies, with availability before the existing opening/distance ordering. Customer displays use MedicineCard/StockBadge; Low Stock remains quantity <=5. Holds reference embedded inventory IDs and acceptance uses a conditional stock update plus hold status in a transaction. Restock notifications represent genuine quantity zero-to-positive owner updates, not date edits.

Added optional Pharmacy.inventory.expiryDate: Date, default null. No separate medicines, duplicate inventory records or customer data were introduced. HoldRequest schema did not change. Legacy records without expiryDate retain their original quantity-based behavior.

Owner create/edit accepts a strict valid YYYY-MM-DD calendar key, its canonical midnight-UTC ISO serialization, or empty/null to clear. Internal Date values must also be canonical UTC midnight. Impossible dates, arbitrary timestamps, malformed strings, objects and numbers are rejected by backend validation. Removing a date saves null. Partial updates preserve existing dates through the existing merged validation path.

## Date-only policy and shared utility

shared/medicineExpiry.mjs is imported by both backend CommonJS and frontend ESM, matching the project's existing shared .mjs pattern. It centralizes parsing, display, expiry status, eligibility, owner filtering and summary counts. EXPIRING_SOON_DAYS = 30 is defined once.

Expiry is a calendar date encoded as midnight UTC for MongoDB storage, not a timed pickup deadline. Today is determined with Intl in Asia/Colombo. Expiry date TODAY remains eligible through that Sri Lankan calendar day, and becomes expired at the start of the next day. Calendar-day differences use UTC date keys, avoiding daylight/timezone offset arithmetic. Display uses UTC calendar-key formatting, so Oct 25 cannot turn into Oct 24 in a user's timezone. No manual +5:30 offsets are scattered through the app.

Statuses:
- Missing/null: unknown, label Expiry not set, legacy-compatible eligibility.
- More than 30 days ahead: Valid.
- Today through exactly 30 days ahead: Expiring Soon, still eligible.
- Yesterday or earlier: Expired, ineligible.
- Malformed stored values: Expiry unavailable, fail-closed eligibility.

Controlled tests cover yesterday/today/tomorrow/30/31 days and the Sri Lankan midnight boundary (18:30 UTC). Parsing round-trips the calendar key to reject rollover dates such as February 30 and invalid leap days.

## Owner UI

The existing medicine editor has an optional labelled date input and live text expiry status. Edit loads the saved calendar date; clearing removes it. Existing field layout, create/edit payloads, quantity/price validation and loading/error behavior remain.

The inventory table adds an Expiry cell with date and readable status, including Expiry not set. Physical StockBadge remains separate: low quantity and Expiring Soon can appear together. The inventory area has All/Expiring Soon/Expired filtering and full-inventory counts for Expiring Soon/Expired. Filtering composes with the existing name/brand query and uses the shared utility. Empty/loading/error states remain separate, with no fake zero summary before inventory loads. No new sorting system was added. The existing responsive table-to-cards layout is reused, with narrow wrapping styles for dates/filter controls. Owner Available counts now also respect expiry; physical out-of-stock counts still represent zero quantity.

## Customer availability and search

Expired inventory is hidden from normal customer medicine search and Pharmacy Details, including includeOutOfStock search. Search count is calculated after filtering, so an expired-only medicine produces no matching pharmacy/result count and existing No Results Suggestions remain applicable. Legacy and expiring-soon items retain normal availability.

The Smart Ranking comparator is unchanged. Only its availability input is corrected by excluding expired/ineligible entries before computing Available. Opening status, Smart/Nearest First distance order, tie-breakers and browsing without a medicine query retain their behavior. Expiry is not a new ranking preference.

As a defensive stale-display guard, MedicineCard reevaluates eligibility with the existing shared minute clock. An expired entry retained in client memory shows Expired/Unavailable rather than Available or remaining stock, offers neither Hold Request nor a restock-alert action, and displays its expiry information. Fresh API results omit it entirely. Search/result counts reflect the latest backend response; cached results still require normal refresh to obtain a new result set. No new low-stock threshold was introduced.

## Hold Requests

Creation rejects expired/ineligible medicines even with positive quantity, using the shared rule. Frontend Request Hold is guarded by the same quantity/expiry eligibility.

Acceptance rechecks expiry in its atomic inventory update, using the current server acceptance timestamp and Sri Lankan date cutoff inside the transaction. The matching embedded item must have enough stock AND either no expiry or an expiry date on/after today. If expiry changes before acceptance or concurrently with the transaction, the stock predicate/transaction conflict protection prevents a partial acceptance. Failure rolls back the accepted status and leaves stock unchanged.

Already accepted holds are not cancelled, reclassified or otherwise changed when an owner later edits medicine expiry. Their existing pickup/collection/hold-expiration lifecycle remains authoritative. Hold expiration can still restore physical quantity even if that item is now expired; customer eligibility continues excluding the expired item. This feature adds no new medical, price, pickup or stock-release claims for those records.

## Restock and privacy

Date-only edits never call restock fulfillment. Quantity zero-to-positive updates of expired/ineligible items do not send an availability notification. The existing subscription remains active; later date-only repair does not itself generate a restock alert. A subsequent genuine eligible zero-to-positive owner update retains the existing transaction/notification behavior. fulfillRestock also guards expiry defensively. Direct attempts to subscribe to an expired item are rejected with an expiry-specific message rather than falsely saying the medicine is available. Restock event semantics remain quantity-driven; no new date-driven notification was added.

Existing Low Stock thresholds and stock formatting are unchanged for eligible customer items and all physical owner stock displays. There are no new customer fields or hold-customer data exposed through inventory/expiry responses. Text uses neutral inventory labels without medical/dosage/consumption recommendations.

## Files

Created:
- shared/medicineExpiry.mjs
- medinear/src/components/MedicineExpiry.jsx
- medinear/src/styles/MedicineExpiry.css
- backend/tests/medicineExpiry.test.js
- backend/tests/integration/medicineExpiry.integration.js
- medinear/tests/medicineExpiry.test.js
- medinear/tests/integration/medicineExpiry.integration.js
- docs/MEDICINE_EXPIRY_TRACKING.md

Modified:
- backend/models/Pharmacy.js
- backend/services/inventory.js
- backend/services/ranking.js
- backend/services/holds.js
- backend/services/restock.js
- backend/controllers/pharmacyController.js
- backend/controllers/holdController.js
- backend/controllers/alertController.js
- medinear/src/components/MedicineEditor.jsx
- medinear/src/components/InventoryTable.jsx
- medinear/src/components/MedicineCard.jsx
- medinear/src/components/RequestHold.jsx
- medinear/src/pages/PharmacyDashboard.jsx

## Validation

- Backend npm test: 68 passed.
- Frontend npm test: 110 passed.
- Frontend npm run test:integration: 5 passed on the regular local database.
- Isolated replica-set backend medicine-expiry, hold, hold-expiration and restock integration: 6 passed, zero skipped (including nested transaction scenarios).
- New frontend medicine-expiry and existing hold/expiration integration on that replica set: 2 passed.
- Standalone medicine-expiry API integration: 1 passed, transaction-only acceptance subtest skipped as designed.
- Backend lint (repository syntax checks), frontend lint (no warnings), production build and git diff --check: passed.

The real transaction tests verify a pending hold becomes unacceptably expired without status/stock changes, and changing expiry after acceptance does not alter the accepted hold. Real API checks cover owner creation/edit/removal, invalid dates, cross-owner/customer denial, search counts, detail filtering, legacy items, expired hold rejection, active restock subscription suppression and normal subsequent eligible restocking. Existing Low Stock, ranking, holds, expiration and other tests remain passing. The installed mongod binary ran an isolated temporary localhost replica set; it was stopped and removed without changing existing MongoDB config or .env files.

Frontend tests use the existing Node/Vite SSR and controlled-view architecture. They verify date field change/clear, editor values, status/date rendering, filters/counts, Low Stock coexistence, expired Hold Request suppression and customer result counts from real API data. Manual browser/mobile checks below remain unexecuted.

Explicit scope: dependencies added: no. Inventory schema changed: yes, optional expiryDate. HoldRequest schema changed: no. Smart Ranking algorithm changed: no, only expiry eligibility input corrected. Restock Alert semantics changed: no, expired items are excluded from availability notifications and date edits are not restocks. Pushed: no. Deployed: no.

## Exact manual browser steps

Start backend npm run dev and medinear npm run dev in separate terminals using the normal development configuration. Use a disposable owned pharmacy and medicine names unique enough to identify in search. Transactional acceptance/restock checks require a development replica set/Atlas; standalone must continue refusing transaction-required actions safely.

A. Sign in as owner, choose the test pharmacy, open Medicine Inventory and Add Medicine. Enter a name, price, quantity 20 and an expiry more than 30 days ahead. Save. Expect the saved calendar date and Valid. Edit, verify the date is prepopulated, change it and save. Clear the date and save again; expect Expiry not set. Reload to verify persistence.

B. Set expiry to seven days ahead with quantity 3. Expect Expiring Soon and the independent Low Stock badge. Verify Expiring Soon summary count and filter. Set another item to yesterday with positive stock. Expect Expired and an incremented Expired count; select the Expired filter and confirm it shows only expired items. All restores the full table; name/brand query should still combine with the filter.

C. Sign in as customer and search the expired-only unique medicine name. Expect no matching pharmacy, correct zero-result count and existing suggestions. Open that pharmacy's details: its expired medicine is omitted. Search the seven-day item: it remains available and Request Hold is offered. Legacy/no-date medicines retain prior behavior. If an old open card becomes expired, refresh for updated search results; its defensive card display should show unavailable without a hold action.

D. Using local DevTools and the customer's own token, attempt POST /api/pharmacies/<pharmacy-id>/hold-requests with { medicineId: '<expired-item-id>', quantity: 1 }. Expect 409 and no hold/stock change. No customerId is authoritative. Do not share captured tokens. The normal frontend must not offer this action for expired inventory.

E. Set a disposable medicine to tomorrow, create a pending hold as customer, then as owner change that medicine to yesterday. Attempt Accept in Hold Requests. On a transaction-capable database expect a safe expiry conflict, stock unchanged and request still Pending after refresh. Restore a future expiry and accept once; then edit its expiry to yesterday again. Verify that already accepted hold is not automatically cancelled or otherwise reclassified. Its existing pickup/collection/hold-expiration workflow is unchanged.

F. Verify date-only edits do not produce Restock Alert notifications. With a disposable active subscription, a zero-to-positive quantity update on expired inventory must not notify availability. Clearing/fixing the date alone must not notify either. On a replica set, a later genuine zero-to-positive update of eligible inventory should retain the existing notification behavior. Confirm hold expiration, customer hold cancellation, owner inventory editing, Smart Ranking and Nearest First remain working.

G. Boundary checks use controlled automated tests rather than changing production/browser clocks: expiry yesterday is expired; today remains eligible through the Sri Lankan day; tomorrow and exactly 30 days ahead are Expiring Soon; 31 days ahead is Valid. Verify a date remains the same calendar day when viewed from another browser timezone.

H. At 375 x 812, check the date input, expiry date/status cells, filters, counts and medicine cards wrap without horizontal scrolling. Use keyboard navigation through the date field/filter/actions and check visible focus. Check document.documentElement.scrollWidth <= window.innerWidth. Existing loading, empty-filter and API-error feedback must remain readable.
