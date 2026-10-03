# MediNear customer and owner UI report

1. **Files created**
   - `medinear/src/components/AssetImage.jsx`, `FavoriteButton.jsx`, `Icon.jsx`, `MedicineCard.jsx`, `MedicineEditor.jsx`, `InventoryTable.jsx`.
   - `medinear/src/utils/medicineDisplay.js`.
   - `medinear/src/styles/MedicineUI.css`, `PharmacyDetails.css`.
   - `medinear/public/medicine-placeholder.svg`, `pharmacy-placeholder.svg`.
   - `medinear/tests/integration/pharmacyFlow.integration.js`.
   - `backend/tests/medicinePresentation.test.js` and this report.

2. **Files modified for this redesign**
   - Frontend: `pages/Home.jsx`, `PharmacyDetails.jsx`, `PharmacyDashboard.jsx`; `components/PharmacyCard.jsx`; `styles/Home.css`, `PharmacyCard.css`, `PharmacyDashboard.css`; `tests/pharmacyUi.test.js`; `package.json`.
   - Backend: `models/Pharmacy.js`; `services/inventory.js`, `ranking.js`; `controllers/pharmacyController.js`; `scripts/seedPharmacies.js`; `tests/pharmacyApi.test.js`, `pharmacyServices.test.js`, `tests/integration/auth.integration.js`.
   - Documentation: `README.md`, `MEDICINE_FEATURES.md`.
   - Existing backend changes from the preceding inventory implementation were already present in the working tree and retained. No dependencies were added.

3. **Routes added**
   None. Reused customer `/`, `/pharmacy/:id` and owner `/pharmacy/dashboard`, retaining their existing role guards. The details page now exclusively uses API records rather than the old numeric-ID hardcoded demo. Existing cart/checkout/order demo pages are untouched; live browsing does not create orders or reserve stock.

4. **API changes**
   - Existing public pharmacy search results and `GET /api/pharmacies/:id` now return each medicine's `imageUrl`, `quantity`, `createdAt` when present, and the existing name/genericName/brand/price/updatedAt/derived availability.
   - Detail GET accepts optional validated `lat` and `lng` together and returns the distance using the existing Haversine service. Without coordinates, distance=null.
   - Existing owner inventory POST/PATCH accepts `imageUrl`, validating HTTPS, a 2048-character maximum and no embedded URL credentials. Blank clears the image. PATCH merges previous values so stock-only edits retain images.
   - No new API routes/models and no change to authentication, owner isolation, opening-hour rules, ranking order or emergency filtering. Customer stock visibility is an intentional update requested in this redesign; owner IDs and credentials remain private.

5. **MongoDB schema changes**
   Extended the existing embedded Pharmacy inventory with optional `imageUrl` (default empty, max 2048) and `createdAt` (Date default). No separate Medicine collection and no binary images. Existing records without image URLs continue to work; prices/quantities are retained. Existing `updatedAt` remains the last-change timestamp.

6. **Medicine images**
   Owners add/edit an HTTPS image URL in the accessible Add/Edit dialog, with a preview. This implements the requested simple imageUrl approach, not file uploads. No upload storage, filesystem paths or binary payloads are accepted. The server validates URLs and does not fetch remote files. Browser image components reject unsafe schemes and show the local SVG placeholder when a URL is missing, unsafe or fails to load, with alt text and no referrer sent. Pharmacy images use the existing Pharmacy.image field and their own placeholder. External URL file contents/size are controlled by the image host; there is no server-side uploaded file processing. The image field is optional for legacy records.

7. **Price**
   Dedicated Price/LKR cells and card fields use `LKR 120.00` formatting with two decimals. Zero is valid and rendered correctly. Add/Edit UI requires a non-negative price; backend preserves the existing optional-price API for legacy callers, rejects negative/non-finite prices, and uses “Price unavailable” for missing legacy values. Existing decimal values are not rewritten merely for display.

8. **Stock quantity**
   Search cards and detail medicine cards display stock as “25 units” or “0 units.” Owner tables display stock separately from status. Quantity is a required non-negative whole number, validated by the backend; negative/fractional values fail. Saving calls the existing owner inventory API, refreshes the table from MongoDB and makes the current value available to customer API requests. UI search states have explicit loading, empty and error/retry handling.

9. **Availability**
   Derived from quantity: positive → Available (green), zero → Out of Stock (red). Owners never maintain a separate conflicting status. Detail pages include zero-stock items. Medicine availability searches continue to exclude zero-stock matches. Open/Closed badges use existing computed hours; unknown hours are neutral, and true 24/7 schedules use a blue 24 Hours badge.

10. **Navigation and UI**
    - Home: MediNear header, Find Medicines Near You heading, medicine search with Search button, Open Now/24 Hour/Emergency Mode chips, distance-radius selector, current-location action, optional pharmacy/location text filter, ranked pharmacy cards and the existing map.
    - View Details navigates with React Router to `/pharmacy/:id`; it does not expand Home. The search/filter/location state lives in the Home query string. Detail links carry current coordinates for a backend distance calculation and a safe internal Back to Search destination.
    - Details: pharmacy photo/placeholder, open/hours/distance/address, Call/Directions/Save actions, functioning Medicines/About/Opening Hours/Location panels. Medicine search matches names, generic names or brands within that pharmacy. Hours and location panels display actual stored schedule/location data, with appropriate unknown-data handling. Location reuses the existing Google map component and directions URLs.
    - Owner: auto-selects the first owned pharmacy, real inventory summary counts, management sections, desktop inventory table, mobile inventory cards, inventory search and Add/Edit native dialog. Profile creation/editing and weekly opening-hour management remain available.
    - Accessibility: semantic tables/forms, associated labels, accessible button names, image alt text, focus outlines, keyboard-operable detail tabs, native modal focus behavior/Escape handling, disabled save controls while requests run and live error/status messages. Availability remains text-visible as well as color-coded. Mobile cards/search stack into one column, with 44px action targets.

11. **Tests and data flow**
    - Backend `npm test`: 20/20 passed. Includes add/edit/delete, negative inputs, image URL security, customer read access, public stock fields, owner/customer/other-owner authorization, legacy images, existing opening hours/distance/ranking/emergency/authentication tests.
    - Frontend `npm test`: 16/16 passed. Includes protected details route rendering, details/card/table/form output, price/quantity/status rendering, placeholders, medicine filtering, coordinates and existing auth/session guards.
    - Backend `npm run test:integration`: passed on local MongoDB, including existing login/session behavior and inventory/image persistence.
    - Frontend `npm run test:integration`: passed. Creates a temporary real MongoDB pharmacy through Express, adds medicine, reads customer API results, renders the returned data through React details/cards/table, edits image/price/quantity to zero, verifies Out of Stock and search exclusion, deletes test medicine and cleans up its temporary pharmacy. This is MongoDB → API → React SSR verification; it does not emulate browser events.
    - Updated `backend npm run seed:pharmacies` was run twice. Missing Amoxicillin/Cetirizine seed records are added without duplicate names or overwriting existing stock/price edits. Placeholder images are used; no unreliable external seed images. Seeder remains local-development-only and rejects production/remote databases.

12. **Build/lint**
    Frontend `npm run build` and `npm run lint` (oxlint): passed. Backend `npm run lint`: passed (Node syntax checks). Source encoding and `git diff --check` were also checked. No package installation required.

13. **Manual browser verification**
    Browser tools reported no available browsers; an in-app browser open attempt returned “Browser is not available: iab.” Therefore live visual layout, phone-width rendering, keyboard tab/focus/Escape interaction, dialog submits, image-network failures and click-through navigation remain manual checks. SSR and database/API tests passed, but are not claimed as browser interaction tests.

    Verify the owner Add/Edit form and customer stock refresh in a browser, image URL preview/failure behavior, search-return filters, distance permission allowed/denied paths, favorite actions and all details panels. The existing embedded Google Map still requires the configured `VITE_GOOGLE_MAPS_API_KEY`; missing key does not prevent external Google Maps directions. No map loader or actual environment keys were changed in this redesign.
