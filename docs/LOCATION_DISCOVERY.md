# Location-Based Pharmacy Discovery & Ranking

## Architecture and reuse

MediNear uses Express/Mongoose with embedded pharmacy inventory. Customer search uses
`GET /api/pharmacies/search`; filtering, opening-hours derivation, distance and ranking
run in the backend. Home uses Axios and URL search parameters; a secondary pharmacy-name
filter remains in the frontend. Existing owner profile/inventory/hours APIs retain their
ownership checks. Existing PharmacyCard, map, Directions, favorites, authentication,
alerts and routing are reused. No packages or external distance APIs were added.

## Ranking before and after

Before: matching medicine in stock first, then open / unknown hours / closed, then ascending
straight-line distance, pharmacy name, pharmacy ID. Out-of-stock matches were opt-in.

The default `sort=smart` preserves those priorities exactly. The new `sort=nearest` uses:

1. Requested medicine available first (when a medicine is requested).
2. Ascending distance; unknown distances follow known distances within availability groups.
3. Opening status: open, unknown, closed.
4. Pharmacy name, then pharmacy ID for deterministic ties.

These are ordered comparisons, with no numeric weights, AI or ML. Select **Nearest first**
after enabling browser location to prioritize nearby pharmacies. Smart Ranking remains the
default, including when location is enabled. Province/district, radius, open/emergency and
24-hour filters are applied before sorting. Disabling **Available Only** includes matching
out-of-stock inventory; it does not include pharmacies with no matching medicine.

## Schema and legacy compatibility

Added optional `Pharmacy.province`, restricted to the nine provinces, and a document
validation check for province/district consistency. Latitude and longitude retain their
existing fields and requirements and now have schema range constraints. The owner API
validates coordinate types/ranges and province/district combinations. Owners select both
area fields with dependent dropdowns and can still enter manual coordinates.

`shared/sriLankaLocations.json` is the single mapping used by both applications.
Recognized legacy district names are canonicalized in public responses and their province
is inferred on reads. Existing records need no migration or bulk rewrite. Unknown legacy
districts remain readable and are not invented; owners must choose a valid district when
editing area fields. The owner API infers province when older clients submit a recognized
district without province.

## API/query contract

`GET /api/pharmacies/search` accepts the existing `medicine`, `lat`, `lng`, `radius`,
`openNow`, `hour24`, `emergency`, `includeOutOfStock` and new `province`, `district`,
`sort=smart|nearest` parameters. Boolean values are `true` or `false`.

Example:

`/api/pharmacies/search?medicine=Panadol&province=Western&district=Colombo&lat=6.9&lng=79.8&radius=5&sort=smart`

Province and district may be independently filtered by the API; when both are supplied,
the district must belong to the province. The customer UI enables district selection after
province selection and clears incompatible districts on a province change.

Coordinates must be supplied together: latitude -90..90, longitude -180..180. Radius must
be finite, greater than zero and at most 500 km, and requires valid coordinates. Nearest
ordering also requires coordinates. Invalid queries return 400. Public pharmacy responses
include province where known and distance where calculable. Pharmacies without usable
coordinates remain in results unless a radius is selected, with **Distance unavailable**.

Existing owner POST `/api/pharmacies` and PUT `/api/pharmacies/:id` accept province and
district. Public detail/list APIs retain their established routes and response structure.

## Haversine and privacy

Reused `backend/services/distance.js`: radians conversion, Earth radius 6371 km,
`a = sin²(deltaLat/2) + cos(lat1) cos(lat2) sin²(deltaLng/2)`, and
`distance = 6371 * 2 * atan2(sqrt(a), sqrt(1-a))`, with numerical bounds protection.
Invalid or missing coordinates return null. Cards display one decimal place in km.
Distances are straight-line estimates; existing Google Maps Directions behavior is preserved.

Browser geolocation is requested only on the explicit **Use My Location** click. It uses
one getCurrentPosition call, a 10-second timeout and a 60-second cache allowance, with no
continuous tracking. Browser coordinates remain in frontend URL/request parameters, as in
the existing architecture. They are not written to MongoDB or localStorage. The code does
not log customer coordinates. Denial, unavailable position, timeout and unsupported-browser
messages keep province/district search usable. No .env changes, paid APIs, push or deployment.

## Files created

- shared/sriLankaLocations.json
- backend/services/locations.js
- backend/tests/locationDiscovery.test.js
- backend/tests/integration/locationDiscovery.integration.js
- medinear/src/utils/locationDiscovery.js
- medinear/src/components/AreaSelects.jsx
- medinear/tests/locationDiscovery.test.js
- docs/LOCATION_DISCOVERY.md

## Files modified

- backend/models/Pharmacy.js
- backend/controllers/pharmacyController.js
- backend/services/ranking.js
- medinear/src/pages/Home.jsx
- medinear/src/pages/PharmacyDashboard.jsx
- medinear/src/components/PharmacyCard.jsx
- medinear/src/styles/MedicineUI.css
- medinear/tests/pharmacyUi.test.js (requested location button label)

## Automated validation results

- Backend `npm test`: 32 passed.
- Frontend `npm test`: 24 passed.
- Backend `npm run test:integration`: 4 passed, 1 skipped.
- Frontend `npm run test:integration`: 1 passed.
- Backend and frontend `npm run lint`: passed.
- Frontend `npm run build`: passed.

The existing real restock commit/rollback test skips on standalone MongoDB because it
requires replica-set transactions. The real standalone alert subscription/read/cancel test
passed, as did unit tests for inventory restocking and notification behavior. New tests
cover mapping, area filters, invalid combinations, dependent selection reset, Haversine,
nearest/smart priorities, radius, missing coordinates, geolocation error handling,
coordinate validation, owner persistence and combined MongoDB discovery. Existing favorites,
auth, medicine search, inventory and Restock Alert tests also passed. Temporary integration
records are cleaned up by the tests. Frontend tests follow the current utility and React
server-rendering approach; these are not automated browser permission-dialog tests.

## Exact manual testing instructions

Run `npm run dev` in backend and medinear, then open the URL shown by Vite.
The following browser checks remain for manual verification:

1. Log in as a customer. Select Western, then Colombo, and click Search. Verify all result
   cards show Colombo, Western. Switch to Central: district clears, and only Central districts
   appear. Select All Provinces: district clears and becomes disabled.
2. Click Use My Location and allow permission. Verify km distances appear. Select Nearest first
   and verify distances ascend among pharmacies in the same medicine availability group.
   Choose Within 2 km, then 5 km: known distances must respect the radius. Any distance restores
   eligible pharmacies with unknown distance. Reset Filters restores default filters and Smart
   Ranking while preserving the current location.
3. Search Panadol, keep Available Only checked, and use location. Under Smart Ranking, verify
   in-stock pharmacies are shown, open pharmacies outrank unknown/closed pharmacies, and
   distance breaks ties within opening status. Uncheck Available Only: matching out-of-stock
   pharmacies may appear, but remain below available pharmacies in both orders.
4. Enable Open Now or Emergency Mode: only pharmacies with confirmed open hours remain.
   Enable 24 Hour: only pharmacies with all seven days configured as all-day remain.
5. Reset this site's browser location permission to Ask, reload, and click Use My Location.
   Deny permission. Verify the denial message is visible and province/district searching still
   works; radius and nearest ordering cannot be selected without a valid location. No browser
   permission request should appear before clicking the button.
6. Log in as an owner. Select a pharmacy, open Pharmacy Profile, select Western then Colombo,
   preserve its address/phone/manual coordinates, and save. Reload the owner page: both area
   selections persist. Log in as a customer and filter Western/Colombo: the pharmacy appears.
7. On mobile, verify filters wrap, cards stack, controls remain tappable and the page has no
   horizontal overflow. Use Tab/Enter/Space to operate selects and buttons. Open pharmacy details
   and Directions; check favorites and an out-of-stock Restock Alert still work.
