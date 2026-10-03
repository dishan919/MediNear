# MediNear implementation report

See [the UI redesign report](MEDICINE_UI_REPORT.md) for the subsequent customer/owner redesign and image/stock API changes.

1. **Existing functionality found.** React/Vite/Router, Express/Mongoose pharmacy CRUD, customer/owner authentication, bcrypt/JWT sessions, role guards, favorites and profiles. The owner dashboard was a placeholder. PharmacyDetails had numeric-ID demo pharmacies/medicines; cart, checkout and orders use localStorage. Order.js/orderRoutes.js are empty. No inventory model/API existed. This checkout contained Google Maps directions/search links, but no embedded map, SDK loader, geolocation or distance service. Existing writes checked owner role but not pharmacy ownership.

2. **Created files.** backend/services/{inventory,openingHours,distance,ranking}.js; backend/scripts/{seedPharmacies,checkSyntax}.js; backend/tests/{pharmacyApi,pharmacyServices}.test.js; medinear/src/maps/googleMaps.js; medinear/src/components/PharmacyMap.jsx; medinear/tests/pharmacyUi.test.js; medinear/.env.example; this report.

3. **Modified files.** backend/models/Pharmacy.js, controllers/pharmacyController.js, controllers/userController.js, routes/pharmacyRoutes.js, package.json, tests/integration/auth.integration.js; frontend pages/Home.jsx, PharmacyDashboard.jsx, PharmacyDetails.jsx, Favorites.jsx, components/PharmacyCard.jsx, styles/Home.css, styles/PharmacyDashboard.css; root README.md. Authentication code and dependencies are preserved.

4. **MongoDB schema changes.** Pharmacy now has indexed owner (User ObjectId), timezone (default Asia/Colombo), optional seven-day openingHours and embedded inventory. Medicine fields: ObjectId, name, optional genericName/brand/price, non-negative integer quantity, updatedAt. Availability derives from quantity. Days use Sunday=0 to Saturday=6, closed/allDay booleans, or HH:mm open/close. No separate duplicate medicine model. Legacy isOpen/open24Hours fields remain, but public API values are computed from hours.

   Existing pharmacies without owners remain readable but cannot be edited by an arbitrary owner. A trusted database maintainer must assign each record to its verified owner's User ObjectId. There is no public claim endpoint. Owners then save weekly hours; missing/invalid hours show Hours unavailable.

5. **APIs.** Paths below are relative to /api/pharmacies:

   | Method | Path | Access/function |
   | --- | --- | --- |
   | GET | /search | Public ranked results |
   | GET | /mine | Owner's pharmacies and inventory |
   | PUT | /:id/hours | Owner's schedule/timezone |
   | GET, POST | /:id/inventory | Owner inventory list/add |
   | PATCH, DELETE | /:id/inventory/:medicineId | Owner inventory update/delete |
   | GET | /, /:id | Existing public pharmacy endpoints; computed hours and safe fields; detail includes medicines |
   | POST, PUT, DELETE | /, /:id | Existing pharmacy CRUD, now assigns/checks owner and allowlists profile fields |

   Search params: medicine, openNow, hour24, emergency, lat, lng, optional radius in km. Booleans use true/false. Coordinates must be supplied together; radius requires location and must be >0 and <=500 km. Example: /api/pharmacies/search?medicine=panadol&lat=6.9271&lng=79.8612&emergency=true.

   Medicine body: { "name": "Panadol", "genericName": "Paracetamol", "quantity": 25, "price": 120 }. PATCH supports partial changes; quantity=0 marks out of stock, positive quantity marks available; price=null clears price. Hours body: { "timezone": "Asia/Colombo", "openingHours": [seven day records] }.

6. **Medicine Availability Search.** Backend literal, case-insensitive partial matching on name, genericName or brand. Only positive-stock matches qualify. Results expose pharmacy information and matching medicine name/availability/optional price/update time, rank/reason and distance. Owner IDs remain private. Customer-visible medicine quantities and image URLs are now returned by search and detail APIs; favorites still return safe pharmacy summaries. Search is debounced and stale requests cancelled. No location still permits search. Without radius all stored pharmacies are considered and sorted by suitability/distance. Inventory filtering currently reads pharmacies into the service; larger datasets would benefit from database search/pagination.

7. **Open/Closed calculation.** Intl.DateTimeFormat evaluates the current time in each stored IANA timezone. Opening inclusive, closing exclusive. A closing time earlier than opening represents an overnight shift; previous-day tails and week boundaries are checked. A closed day can still have an active previous-night shift. Equal open/close is rejected; use allDay for 24 hours. Missing/invalid data returns Hours unavailable. Status refreshes on API requests; reload/change search or filters to refresh. Holidays and split shifts are not modeled.

8. **24-hour identification.** Requires all seven days explicitly allDay=true and closed=false in a valid weekly schedule. A single all-day day is displayed as 24 hours today, not a 24/7 label. Legacy flags alone never establish 24-hour status.

9. **Exact Smart Ranking.** Transparent lexicographic rules, no AI/opaque score: medicine query excludes pharmacies lacking a positive-stock match; Open Now/Emergency require isOpen=true; 24 Hour requires verified 24/7 schedule; optional radius excludes unknown/excess distance. Sort remaining results by Open, Hours unavailable, Closed; then full-precision ascending distance (unknown last); then pharmacy name; then ID. Return one-based rank and rankingReason. Emergency includes ordinary pharmacies confirmed open and genuine 24-hour pharmacies, with no extra preference for 24-hour over other open pharmacies. Select 24 Hour to restrict to 24/7 records.

10. **Distance.** Haversine great-circle distance, Earth radius 6371 km; validated coordinates; unrounded value for ranking, one decimal km in UI. Straight-line estimates, not driving distance/time. Explicit location button uses browser geolocation with 10-second timeout; denied/unavailable location leaves searches usable without distance. Location is not persisted.

11. **Google Map reuse/setup.** Existing Google Maps coordinate/address links remain. No embedded map existed to reuse in this checkout, so added one optional Google map component, without Leaflet replacement or removing existing code. Loader reuses an existing Google SDK and shares its loading promise; one map per mounted component updates matching pharmacy/current-location markers, bounds and selected pharmacy focus. Useful selected pharmacy info appears below the map. Missing configuration/load failures display a message while Directions remain usable. No actual key was hardcoded or environment configuration changed.

   Set your existing restricted Maps JavaScript browser key in medinear/.env as VITE_GOOGLE_MAPS_API_KEY; optionally set VITE_GOOGLE_MAPS_MAP_ID; restart Vite. Advanced markers use Google's DEMO_MAP_ID when no map ID is supplied. Browser keys are visible to browser clients by design: restrict the browser key by referrer/API and never use a server secret. References: [Google SDK loading](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/basic-customization), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

12. **Owner authorization/security.** Existing JWT protection reloads the user's role from MongoDB; owner middleware rejects guests/customers. Inventory/hours/profile writes load the pharmacy and compare owner to authenticated user ID. Medicine lookup is inside that owned pharmacy. Bodies cannot reassign owner or replace inventory through the profile API. Backend validates text, finite coordinates, integer stock, finite non-negative price, timezone and complete hours. Unknown ownership fails closed; public output is allowlisted. New APIs never expose passwords or credentials.

13. **Development seed.** In backend run npm run seed:pharmacies. Local MongoDB only, disabled in production. Reuses existing dev accounts and adds three insert-only Colombo examples: daytime, genuine 24/7, overnight; different coordinates, Panadol/Paracetamol/Vitamin C, positive/zero quantities and prices. Existing medicine values are preserved on repeat runs; missing seed medicines are added once. Successfully ran twice. No production startup seeding. Existing dev logins: owner@medinear.test / DevOwner123! and customer@medinear.test / DevCustomer123!.

14. **Tests/build/lint.** After the UI redesign: backend npm test: 20/20 pass. Frontend npm test: 16/16 pass. Frontend npm run build and npm run lint (oxlint): pass. Backend npm run lint: pass (Node syntax checks, not semantic lint). npm run test:integration: pass with real local MongoDB, registration/login/session authorization and real pharmacy creation, inventory CRUD persistence, schedule updates, case-insensitive search and zero-stock exclusion. Temporary integration pharmacies/users removed. HTTP route tests cover guest/customer/other-owner denial, missing ownership and public output. Service tests cover overnight/timezone boundaries, 24-hour detection, distance, ranking/emergency, literal matching and seeds. Frontend tests render actual components through Vite/React SSR, not full browser interaction.

15. **Manual verification remaining.** Actual frontend environment only has VITE_API_URL, no Google Maps browser key. Configure it to verify live map rendering/authentication, marker selection/focus and geolocation allowed/denied paths. Check responsive layouts and complete browser owner-edit/customer-search flow. The redesigned pharmacy detail page now exclusively loads API data for pharmacy IDs. Cart/checkout/order demo pages remain unchanged, and live inventory browsing does not submit orders or reserve stock. Legacy pharmacy records require verified owner assignments and schedules before management/open filtering.
