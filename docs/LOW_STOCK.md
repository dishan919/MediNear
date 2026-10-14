# Low Stock Indicator

## Existing architecture

Pharmacy inventory is embedded in Pharmacy documents. Its field is quantity, required and
validated as a non-negative safe integer by schema and validateMedicine. Owners still use the
existing inventory API/editor. Customer MedicineCard already shows exact counts in both search
result cards and Pharmacy Details. Backend publicMedicine reports binary Available/Out of Stock.
Search and both ranking modes use quantity > 0 for availability. Restock alerts detect finite
old quantity <= 0 becoming positive, independently of any presentation threshold.

## Shared presentation rule

LOW_STOCK_THRESHOLD = 5 is defined once in medinear/src/utils/stockStatus.js.
getStockStatus and StockBadge reuse it across customer cards, owner inventory table and editor.

- Safe integer quantity <= 0: Out of Stock.
- Quantity 1 through 5 inclusive: Low Stock.
- Quantity greater than 5: Available.
- Missing, null, non-number, non-integer or unsafe/infinite quantity: Stock unavailable.

Customers already see exact inventory counts, so low stock displays Only 3 remaining. Normal
stock retains its existing N units display and zero retains 0 units. Missing/invalid/negative
customer quantities display Stock unavailable instead of NaN/undefined/negative counts. No new
quantity exposure was added. Low Stock uses a readable amber warning badge with explicit text,
so its meaning does not depend on color. Cards remain compact and use existing responsive styles.

The owner table and editor receive only the same badge enhancement. No owner input validation,
workflow, quantity constraints, stock persistence or API responses changed.

## Compatibility

Low stock is still available for backend search and Smart/Nearest ranking because its quantity
is positive. Backend publicMedicine availability remains Available, preserving the existing API
contract. Ranking code, thresholds and search behavior were not changed.

Restock production code is unchanged: 0 -> 3 triggers existing restock behavior; 3 -> 10 does
not trigger another restock. The actual HTTP inventory/notification test now exercises those
transitions and asserts no second notification. The Restock Alert button remains shown only for
exact zero quantity, as before, not for positive low stock.

## Files created

- medinear/src/utils/stockStatus.js
- medinear/src/components/StockBadge.jsx
- medinear/tests/lowStock.test.js
- backend/tests/lowStock.test.js
- docs/LOW_STOCK.md

## Files modified

- medinear/src/components/MedicineCard.jsx
- medinear/src/components/InventoryTable.jsx
- medinear/src/components/MedicineEditor.jsx
- medinear/src/styles/MedicineUI.css
- medinear/tests/integration/pharmacyFlow.integration.js
- backend/tests/restock.test.js (notification regression scenarios only)

No backend production files, schemas, APIs, dependencies or .env files changed.

## Validation

- Backend npm test: 42 passed.
- Frontend npm test: 61 passed.
- Backend npm run test:integration: 5 passed, 1 skipped.
- Frontend npm run test:integration: 1 passed.
- Both configured lint checks: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

New tests cover zero/one/exact threshold/threshold+1 and invalid data, customer search/detail
rendering, owner badge rendering, zero-only subscription controls, low-stock search availability,
both ranking priorities and owner validation. Real MongoDB integration verifies owner updates
to quantities 5, 1 and 3 and corresponding search/detail/table display. Existing suites passed.
The existing real restock transaction rollback test is skipped on standalone MongoDB because it
requires a replica set. Real standalone subscription tests and mocked transactional HTTP restock
notification tests passed. Browser steps below remain for manual verification.

## Exact manual browser steps

1. Run the existing backend/frontend development servers. Use a development pharmacy with
   Panadol in its inventory and preserve its original quantity for restoration after testing.
2. As owner, set Panadol quantity to 10. As customer, search Panadol and open that pharmacy:
   both search and details should show Available and 10 units.
3. As owner, set quantity to 3. Refresh/re-run the customer search: it remains included with
   Available Only enabled, displays Low Stock / Only 3 remaining, and keeps normal Smart/Nearest
   ordering. Pharmacy Details and the owner inventory badge should also show Low Stock.
4. Check quantity 5: Low Stock. Check quantity 6: Available. These are presentation changes only.
5. Set quantity to 0. Available Only search excludes it; uncheck Available Only or open its
   existing details route to see Out of Stock / 0 units and the existing Restock Alert control.
6. Subscribe to its Restock Alert as customer. On a transaction-capable MongoDB deployment
   (Atlas/replica set), update quantity from 0 to 3 as owner. Verify Low Stock and the normal
   in-app restock notification. On standalone MongoDB, the existing restock write restriction
   still applies; this feature does not bypass it.
7. Update 3 to 10. Verify Available and no extra restock notification for that positive-to-positive
   change. Verify owner editing still accepts the existing 20 -> 5 -> 1 -> 0 transitions.
8. At mobile width verify badge text/remaining count stays readable without overflow. Check
   favorites, restock, location filters and the existing details actions remain intact.
9. Restore the original development inventory quantity after testing.

No push or deployment was performed.
