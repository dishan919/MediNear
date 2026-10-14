# No Results Suggestions

## Architecture and gating

Home already distinguishes current loading, errors and successful empty final results. Its
request-key guard hides stale results/counts while queries change. This feature replaces only
the successful-empty branch. SearchResultCount remains unchanged and continues to announce
No pharmacies found. The new compact section has no duplicate No pharmacies found heading or
extra live region. It uses a small Try these suggestions heading and, when meaningful, safely
renders No matches for "<medicine>" as React text. Long display text is capped at 120 characters.

The component also explicitly suppresses itself for loading, errors or non-empty results.
Failed requests and invalid/unauthorized sessions keep their existing UI. A location denial does
not fabricate an empty search; suggestions can appear only after the normal valid search finishes.

## Contextual suggestions

The list contains at most four suggestions, prioritizing medicine, valid radius/location,
province/district, open/emergency, 24-hour, availability and pharmacy-text filtering:

- Medicine entered: check spelling or try a different medicine.
- Valid browser location and selected radius: increase the search radius.
- Province/district active: try another district or remove the area filter.
- Open Now active: try including currently closed pharmacies.
- Emergency active: remove Emergency Mode to include currently closed pharmacies.
- 24 Hour active: remove that filter.
- Medicine with Available Only active: include currently out-of-stock matches.
- Pharmacy-text filter active: remove its name/address filter.

Inactive filters produce no removal suggestion. When nothing relevant is active, generic
medicine/pharmacy-name guidance is shown. Changing sort is never suggested; ordering is not a
zero-results solution. Low-stock availability, ranking and all API search logic remain unchanged.

## Clear Filters

Clear Filters is shown only when a restrictive optional filter is active. It updates existing
URLSearchParams using the normal search effect, with no second search implementation.
It preserves medicine exactly, keeps current latitude/longitude and selected ordering, and
removes province, district, radius, Open Now, 24 Hour, Emergency and pharmacy-text restrictions.
For a meaningful medicine term it sets the existing includeOutOfStock=true flag, removing the
Available Only restriction. This is a user-initiated broadening action, not a changed stock rule.
No radius or location permission is changed automatically. Recent medicine storage is untouched.
The separate existing toolbar Reset Filters retains its previous behavior.

## Accessibility and design

Semantic section/heading/paragraph/list markup and a real Clear Filters button reuse MediNear
colors, borders, spacing and visible keyboard focus. The section is compact and wraps long terms
on mobile. SearchResultCount alone retains the existing polite result announcement; suggestion
content adds no repetitive aria-live announcement. Medicine text is escaped by React, never HTML.

## Files created

- medinear/src/utils/noResultsSuggestions.js
- medinear/src/components/NoResultsSuggestions.jsx
- medinear/tests/noResultsSuggestions.test.js
- docs/NO_RESULTS_SUGGESTIONS.md

## Files modified

- medinear/src/pages/Home.jsx
- medinear/src/styles/Home.css
- medinear/tests/integration/pharmacyFlow.integration.js

## Validation

- Frontend npm test: 66 passed.
- Frontend npm run test:integration: 1 passed.
- Frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

An initial integration runner invocation exited with no diagnostics; its isolated rerun passed,
and the enhanced configured integration suite subsequently passed. New tests cover active/inactive
filters, four-item cap, empty/special-character terms, loading/error/result suppression, semantic
markup, clear-button callback, query/location/sort preservation, recent-chip empty flow and the
unchanged count announcement. Real API integration verifies an empty area-filtered result renders
suggestions and Clear Filters returns pharmacies while preserving the medicine query. Existing
frontend feature regressions passed. No backend files or behavior changed.

## Exact manual browser steps (remain to be performed)

1. Start the existing backend/frontend development servers and log in as a customer.
2. Search MedicineThatDoesNotExist. After success, verify No pharmacies found in the existing
   result count, safe medicine text and relevant spelling/availability suggestions below it.
3. Search Panadol and choose restrictive province/district/Open Now filters until zero results.
   Verify area/open-filter suggestions, at most four items, and Clear Filters.
4. Click Clear Filters. Verify Panadol remains, area/open/24-hour/radius/emergency/pharmacy-text
   restrictions clear, and Available Only becomes unchecked through the existing flag. Current
   location and ordering remain. Results update through the usual search flow.
5. Use My Location and select a restrictive radius that yields zero. Verify Increase the search
   radius appears. No permission request or radius change should happen automatically.
6. Test 24 Hour and Available Only individually. Their suggestions appear only when active;
   positive Low Stock still counts as available. Sort changes alone should never be suggested.
7. Click a recent-search chip that returns zero results. Verify the same suggestions appear and
   history ordering/persistence remains unchanged. Try a whitespace-only term: no empty quoted
   medicine heading. Test special characters: they must be text, not executable markup.
8. Throttle the network and change the query: loading should have no suggestions. Disconnect
   the backend/network: preserve the existing error UI with no suggestion section. Reconnect
   and retry; show suggestions only if the completed valid result set is empty.
9. At mobile width verify readable wrapping and no overflow. Tab to Clear Filters and use Enter
   or Space; verify visible focus and unchanged SearchResultCount screen-reader behavior.

No dependencies, backend/MongoDB/API/.env changes, push or deployment were performed.
