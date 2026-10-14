# Recently Viewed Pharmacies

## Existing architecture

Customer Home and PharmacyDetails already sit under the customer ProtectedRoute. AuthContext
contains the verified account. PharmacyDetails fetches GET /pharmacies/:id through Axios and
has abort handling for navigation/refetch. PharmacyCard links to /pharmacy/:id, preserving
return navigation and optional current search coordinates. Favorites use MongoDB-backed APIs;
Recent Medicine Search History is browser-local and clears via clearSession.

## Storage and recording

Key: medinear_recent_pharmacies. Value: a JSON array containing at most five pharmacy ID strings.
Only valid 24-character hexadecimal MongoDB IDs are accepted; case is canonicalized lowercase.
Newest is first. Reopening an existing ID moves it first without duplication. Adding a sixth
unique pharmacy evicts the oldest. No names, customer coordinates, tokens, user fields, inventory,
medicine-history data, calculated status or distance are persisted in this history.

Recording occurs inside the successful, non-aborted PharmacyDetails load callback, gated by
verified customer account identity/role, success=true and a response pharmacy ID matching the
route. Search-result card renders, loading placeholders, errors/404s and owners do not record.

The Home section resolves those IDs using up to five existing GET /pharmacies/:id calls in
parallel. It preserves ID-list order regardless of request completion order. Current name,
district/province and schedule/timezone are retained only in component memory. Status uses the
existing shared PharmacyStatus component and minute clock. Inventory, result ranking and distance
are excluded from recent cards. HTTP 404/410 IDs are removed locally; transient failures leave
history intact with Try again feedback. A cleared/removed section aborts pending reads.

## UI and isolation

Recently Viewed Pharmacies appears below the Home map and above the FAQ, using a compact variant
of the existing PharmacyCard. Cards display current name, district/province, opening status and
View Pharmacy. They use the existing details route and return-navigation behavior. A named Remove
button removes only that ID; Clear Recently Viewed removes only its key. Empty history produces
no large empty state. Desktop uses a small grid; mobile stacks cards with wrapping text.

Recent cards do not offer favorite mutation controls. Removing from history never deletes a
pharmacy or calls favorite APIs. Existing primary pharmacy cards retain their behavior. Search,
filters, ranking, restock, profile photos and opening-hours calculations are unchanged.

clearSession now clears this key alongside existing authentication and recent-medicine-history
keys. Logout and expired/missing sessions therefore remove both histories; unrelated storage
is preserved. Corrupt JSON/non-array values and invalid IDs are safely discarded; browser storage
errors do not crash Home or PharmacyDetails. This is browser-local history, not device sync.

## Files created

- medinear/src/utils/recentPharmacies.js
- medinear/src/components/RecentlyViewedPharmacies.jsx
- medinear/src/styles/RecentlyViewed.css
- medinear/tests/recentPharmacies.test.js
- docs/RECENTLY_VIEWED_PHARMACIES.md

## Files modified

- medinear/src/pages/PharmacyDetails.jsx
- medinear/src/pages/Home.jsx
- medinear/src/components/PharmacyCard.jsx
- medinear/src/auth/session.js
- medinear/tests/integration/pharmacyFlow.integration.js

## Validation results

- Frontend npm test: 47 passed.
- Frontend npm run test:integration: 1 passed.
- Frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

Tests cover customer/success/route-ID recording gates, recency/reordering/max-five eviction,
ID-only persistence, invalid/unavailable storage, individual removal, clear/logout key isolation,
current detail resolution, 404 versus temporary failure handling, compact section rendering,
existing details links, hidden empty section, button callbacks and existing feature regressions.
The integration test resolves real pharmacy API data and verifies the local history stores only
its ID. Frontend tests use the project's utility/React server-rendering approach, not a browser
file/session automation harness. Backend tests were not run because no backend code changed.

## Exact manual browser checks (remain to be performed)

1. Run the existing backend/frontend development servers. Log in as a customer and open Home.
   Merely viewing search results must not populate Recently Viewed Pharmacies.
2. Open Pharmacy A details, return Home, then open Pharmacy B details and return Home. Verify
   B appears first, followed by A, using current names/location and opening status.
3. Open A again using View Pharmacy in the recent section. Return Home: A is first, B second,
   with no duplicate A. Refresh: both IDs remain and the displayed data is fetched again.
4. Open six distinct valid pharmacies. Verify only the latest five remain, newest first.
5. Visit /pharmacy/not-a-valid-id or a nonexistent valid ID. Return Home: no failed entry is added.
6. Click Remove on a recent card. Verify only that recent entry disappears. If it is a saved
   pharmacy, open Saved Pharmacies and verify it remains saved and the pharmacy still exists.
7. Click Clear Recently Viewed. Verify the section disappears while recent medicine searches,
   search filters, location, login and other stored app data remain unchanged.
8. View another pharmacy and perform a medicine search. Use the existing logout/session-clear
   flow, then log in again. Verify both recently viewed and recent medicine histories are empty.
9. Set medinear_recent_pharmacies to invalid JSON or an array with invalid IDs in browser
   DevTools Application -> Local Storage. Refresh: Home must remain usable and clean bad entries.
10. For stale-data handling, remove a temporary development pharmacy via the existing authorized
    owner flow after it was viewed. Return/refresh Home: its 404 should remove only that history
    entry. Temporary backend/network failure should instead preserve IDs and offer Try again.
11. At mobile width verify compact cards stack without overflow. Tab/Enter must operate View
    Pharmacy, Remove and Clear Recently Viewed with visible focus. Confirm existing medicine
    search, filters, favorites, restock and live opening-status displays still work normally.

No dependencies, MongoDB/history API changes, push or deployment were added.
