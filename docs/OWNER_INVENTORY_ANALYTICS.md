# Owner Inventory Analytics

## Implementation and architecture

Inventory remains embedded in `Pharmacy.inventory`; each medicine has an `_id`, name, quantity and optional expiryDate. `Pharmacy.owner` references the authenticated owner. There is no second inventory source or stored analytics snapshot.

The existing owner dashboard now includes Inventory Analytics alongside Inventory, Profile, Hours, Customer Reviews and Hold Requests. It uses the selected pharmacy and existing owner panel styles. View Inventory clears inventory search/expiry filters and opens the existing inventory tab. Existing tabs and workflows are preserved.

`GET /api/pharmacies/:id/inventory/analytics` uses the existing authentication and pharmacy_owner role middleware, validates the ID, and executes one `findOne` constrained by both pharmacy ID and authenticated user ID. Its projection includes only inventory ID, name, quantity and expiry date. Missing or unowned pharmacies return the same 404; invalid IDs return 400, unauthenticated requests 401 and customers 403. Owner identity never comes from request input.

No MongoDB aggregation was added. One projected query followed by shared calculations suits embedded inventory and avoids reimplementing the centralized Sri Lankan date rules in an aggregation pipeline. There are no per-medicine queries or reads of customers, holds or reviews. Attention sorting is performed in memory and the response is bounded to ten attention items.

The response contains `success`, `summary`, `needsAttention`, `attentionTotal`, `attentionLimit`, `hasMore` and `generatedAt`. Attention rows expose medicine ID/name/quantity/expiry and derived statuses/issues only. The frontend validates the response and projects the fields used by its view. Errors show a safe message and Retry, rather than fabricated zero metrics.

## Metrics and shared rules

| Metric | Definition |
| --- | --- |
| Total Medicines | Number of existing medicine records, independently of quantity. Non-object malformed array entries are ignored. |
| Total Stock Units | Sum of nonnegative safe integer quantities, including physical units of expired medicines. Missing, fractional, negative, string and otherwise malformed values are excluded. An unrepresentable aggregate fails safely rather than returning an inaccurate number. |
| Low Stock | Records classified low-stock by the existing helper: positive quantity up to the existing threshold of 5. |
| Out of Stock | Records classified out-of-stock by the same helper: safe integer quantity <= 0. Legacy negative quantities count here, but do not contribute units and display Stock unavailable. |
| Expiring Soon | Records classified expiring-soon by the existing date-only expiry helper. |
| Expired | Records classified expired by that same helper. |

The existing stock helper moved unchanged to `shared/stockStatus.mjs`. The original frontend module remains a compatibility re-export, so existing stock UI and analytics use identical policy. No threshold or quantity validation behavior changed.

Expiry uses `shared/medicineExpiry.mjs` directly. Expiry today remains valid through the Sri Lankan calendar day and is expiring soon. The existing inclusive 30-day boundary applies. Missing/invalid expiry does not independently create an issue. All records in a response use one captured time; dates use the existing frontend date formatter.

Stock and expiry categories overlap independently. A low-stock medicine expiring soon contributes to both counts and appears once with both badges. Out-of-stock and low-stock remain mutually exclusive under the existing stock helper.

Needs Attention priority is expired, out-of-stock, expiring-soon, low-stock. The highest-priority issue determines row order; ties sort by medicine name, then ID. All relevant badges remain visible. Only the first ten rows are returned; the UI states the total when truncated and provides View Inventory. Healthy medicines and missing-expiry-only medicines do not appear.

## Read-only behavior and states

The endpoint only reads inventory. It never modifies quantities, processes expired holds, creates notifications or triggers restock events. Pending holds leave metrics unchanged. After acceptance, cancellation/expiration restoration or other normal inventory mutations, reopening the tab or selecting Refresh analytics derives a new snapshot from committed stock. Analytics GET deliberately does not run lazy hold expiration; normal hold processing must restore stock first. Collection retains the normal stock behavior. Hold implementation was not changed.

The component renders only for pharmacy owners; backend enforcement remains authoritative. An owner without a pharmacy sees setup guidance without an analytics request. Switching pharmacy/account remounts the session and aborts pending requests. Loading and refresh show a loading status; errors show an alert and Retry. Empty inventory shows six zeros and an empty message; healthy inventory shows a distinct healthy message. Native buttons, semantic definition lists and status/alert roles support accessibility. Metric cards use three, two and one columns across desktop/tablet/mobile, with wrapping names, values and badges.

## Files

Created:

- `shared/stockStatus.mjs`
- `backend/services/inventoryAnalytics.js`
- `backend/controllers/inventoryAnalyticsController.js`
- `backend/tests/inventoryAnalytics.test.js`
- `backend/tests/integration/inventoryAnalytics.integration.js`
- `medinear/src/utils/inventoryAnalytics.js`
- `medinear/src/components/InventoryAnalytics.jsx`
- `medinear/src/styles/InventoryAnalytics.css`
- `medinear/tests/inventoryAnalytics.test.js`
- `medinear/tests/integration/inventoryAnalytics.integration.js`
- `docs/OWNER_INVENTORY_ANALYTICS.md`

Modified:

- `backend/routes/pharmacyRoutes.js`: protected analytics route.
- `medinear/src/pages/PharmacyDashboard.jsx`: tab, selected pharmacy, setup state and View Inventory navigation.
- `medinear/src/utils/stockStatus.js`: compatibility re-export.

## Validation results

- Backend `npm test`: 75 passed, no failures.
- Frontend `npm test`: 114 passed, no failures.
- Frontend `npm run test:integration`: 6 passed, no failures or skips, including real API/database -> analytics loader -> rendered view.
- Isolated temporary replica-set backend integration: analytics, holds, hold expiration and restock: 6 passed, no failures or skips, including nested transaction checks.
- Isolated replica-set frontend analytics and holds integration: 2 passed, no failures or skips.
- Backend and frontend lint passed; frontend production build passed; `git diff --check` passed.

Tests cover the exact five-record fixture (5 medicines, 41 units and one of each issue), overlapping issues, deterministic bounded attention, malformed legacy quantities, empty/healthy inventory, expiry boundaries including Sri Lankan midnight, private-field exclusion, ownership and roles, no inventory/notification writes, pending holds, accepted stock and expired-hold restoration. UI tests cover all six cards, loading/error/retry/empty/healthy/setup states, owner-only rendering, existing dashboard wiring, View Inventory, shared dates and responsive CSS. Rendered/component tests are not a substitute for viewport and keyboard checks in a browser.

The temporary replica set was isolated from the development database and removed after testing. No database configuration or environment files were changed.

## Manual browser checks (not executed)

Use the existing local frontend/backend startup instructions and test accounts. Use test pharmacy inventory only. Record the starting values before changing test data.

1. **A — Owner dashboard:** Sign in as a pharmacy owner, select a pharmacy and open Inventory Analytics. Verify all six named cards, Refresh analytics and View Inventory. Visit Inventory, Profile, Hours, Customer Reviews and Hold Requests and confirm their normal behavior. Test an owner with no pharmacy for setup guidance.
2. **B — Inventory totals:** In Inventory, create Panadol quantity 3 with far-future expiry, Vitamin C quantity 10 with expiry seven days ahead, Medicine X quantity 0 with far-future expiry, Medicine Y quantity 8 with yesterday's expiry and Medicine Z quantity 20 without expiry. Reopen analytics. For this fixture alone expect 5 medicines, 41 units, Low Stock 1, Out of Stock 1, Expiring Soon 1 and Expired 1. Other existing records must be included when comparing totals.
3. **C — Attention:** Expect Y, X, Vitamin C and Panadol in that priority order; Z absent. Change Panadol expiry to seven days ahead. Reopen analytics: it appears once with Low Stock and Expiring Soon; both counts include it. With more than ten issue records verify the limit message and View Inventory. Verify healthy-only inventory and empty inventory show their distinct states.
4. **D — Quantity change:** Open Inventory via View Inventory, change Panadol from 3 to 9 and save. Return to analytics or Refresh analytics. Verify units rise by 6 and Low Stock falls by 1. Confirm no edit controls exist inside analytics.
5. **E — Expiry change:** Change a healthy medicine's expiry into the existing soon window, then refresh analytics. Verify the matching count and badge. Check yesterday, today, tomorrow, exactly 30 days ahead and 31 days ahead using the current Sri Lankan date; compare with Inventory's badges. Today must not be expired.
6. **F — Hold interaction:** Set a test medicine to quantity 6. As a customer create a pending hold for 2; refresh owner analytics and verify stock remains 6. Accept from Hold Requests on a transaction-capable database; refresh analytics and verify quantity 4 and Low Stock. After the normal deadline processing expires the hold, refresh and verify quantity 6 and no Low Stock. Do not expect analytics itself to expire holds. Verify collection continues to retain the accepted stock deduction.
7. **G — Owner security:** Sign in as owner B. In browser developer tools request owner A's pharmacy analytics URL using B's authenticated API session; expect 404 and no inventory data. B's own pharmacy should work. Test an invalid ID (400) and a missing pharmacy (404).
8. **H — Customer and request states:** Sign in as a customer: owner dashboard/analytics must be inaccessible; direct authenticated analytics GET returns 403, unauthenticated GET returns 401. As owner use network throttling to observe loading; temporarily block the analytics request to observe the safe error and Retry. Unblock and retry; verify current values. Switch pharmacies during a delayed request and ensure old results do not appear.
9. **I — Mobile/accessibility:** At approximately 375 × 812, verify cards stack, long names and badges wrap, controls are readable, and no horizontal overflow occurs. Use keyboard Tab/Enter/Space for the tab, Refresh, Retry and View Inventory; verify focus and readable status messages. Restore test inventory afterward.

## Scope confirmation

No dependencies were added. Inventory, HoldRequest and Review schemas were not changed. Smart Ranking and Restock Alert semantics were not changed. No hold workflow was changed. No code was pushed to GitHub and nothing was deployed to AWS.
