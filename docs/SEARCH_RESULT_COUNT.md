# Search Result Count

## Existing architecture and source

Home already fetches pharmacy results with the existing 250 ms debounced search request.
Medicine availability, province/district, opening/24-hour/emergency and radius filtering and
Smart/Nearest ordering occur in that backend request. Home additionally filters pharmacy text
by name/address/district. Initial Home intentionally browses pharmacies without a medicine term.

The existing final frontend filter is now the small visiblePharmacyResults helper; its text
matching is unchanged and it keeps only the first occurrence of each pharmacy ID, preserving
order. Home uses this exact same final array for primary pharmacy cards, map and count. The
count is finalResults.length, not API count/raw result length. Recently viewed cards are a
separate section and are not counted as search results. No additional search/count API exists.

## Display, loading and accessibility

The small existing count badge beside the results heading now says:

- No pharmacies found
- 1 pharmacy found
- N pharmacies found

It updates after completed successful searches/filter changes, including recent-search chip
searches. Low-stock medicines still count as available because backend stock semantics are
unchanged. Sorting preserves count when the same result IDs remain.

A completed-request key tracks the query string and existing retry counter. A changed query
immediately counts as searching, before the existing effect sets its loading flag. Old count,
cards and map markers therefore do not briefly appear under the new query. Failed requests
retain the existing error UI and have no count. Successful zero results retain the existing
empty UI and show No pharmacies found, never 0 pharmacies found. Initial loading has no count;
a successfully completed initial browse can show its result count.

The count's lightweight live region stays mounted with role=status, aria-live=polite and
aria-atomic=true. Text is empty while loading/error, and completed visible results are announced.
The existing request debounce is retained; no new timers or typing announcements were added.
The heading/count can wrap to avoid horizontal overflow on narrow screens.

## Files created

- medinear/src/utils/searchResults.js
- medinear/src/components/SearchResultCount.jsx
- medinear/tests/searchResults.test.js
- docs/SEARCH_RESULT_COUNT.md

## Files modified

- medinear/src/pages/Home.jsx
- medinear/src/styles/Home.css
- medinear/tests/integration/pharmacyFlow.integration.js

## Validation

- Frontend npm test: 63 passed.
- Frontend npm run test:integration: 1 passed.
- Frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

Tests cover singular/plural/empty wording, final frontend filtering, duplicate removal, count
matching rendered cards, order invariance, initial/loading/error states, polite live-region
attributes and existing Home regressions. The real API integration checks province/district,
Open Now, 24-hour, availability, radius/location and both sort modes on current inventory,
including positive low stock. Backend production code, schemas, ranking/filter algorithms and
APIs were unchanged. Existing feature tests remain passing. Browser steps below remain manual.

## Exact manual browser steps

1. Start the existing backend/frontend development servers and log in as a customer. During
   initial loading, verify no count is shown. After initial browsing completes, the count should
   match the primary pharmacy cards (exclude Recently Viewed cards).
2. Search Panadol and count its displayed primary pharmacy cards. If there are five, verify
   5 pharmacies found. Select Western: count must match the remaining cards. Select Colombo:
   if one remains, verify 1 pharmacy found.
3. Enable Open Now, 24 Hour and Available Only as appropriate. Verify the count tracks the
   final visible list. Positive Low Stock items must still count as available.
4. Click Use My Location, allow permission, and choose Within 5 km. Verify the count matches
   the radius-filtered results. Switch Smart Ranking to Nearest First: if only order changes,
   the count must remain unchanged.
5. Use the existing pharmacy-text filter to hide some results. Verify count matches the visible
   cards rather than the larger API result set. Click a Recent Search chip and verify its normal
   completed search also produces the correct count with current filters.
6. Apply filters until nothing matches, or search a valid nonexistent medicine. Verify No
   pharmacies found and the existing empty state, rather than 0 pharmacies found.
7. Slow the network using browser DevTools and change the query/filters. Verify the previous
   count disappears immediately while the existing loading indicator is shown.
8. Temporarily disconnect the backend/network and search. Verify the existing error state and
   no misleading zero-result count. Restore the network and retry: count should reappear only
   after success.
9. At mobile width verify heading/count wrap without overflow. With a screen reader, verify
   completed result updates are announced politely and loading/error do not announce zero.

No backend/MongoDB/API/dependency/.env changes, push or deployment were performed.
