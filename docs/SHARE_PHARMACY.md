# Share Pharmacy

## Existing route and scope

Pharmacy Details uses `/pharmacy/:id` under the existing customer ProtectedRoute. Share is added
beside its Call Pharmacy, Directions and Save Pharmacy actions. Existing routing/authentication,
recently viewed recording, medicine availability, opening timing, favorites and restock remain
unchanged. No backend files, APIs, storage schemas, packages or deployment configuration changed.

## URL and payload

The utility builds `window.location.origin + /pharmacy/<pharmacyId>` through URL parsing with a
valid MongoDB pharmacy ID. No current query string or hash is copied: latitude/longitude,
search/filter state and other incidental URL data are excluded. No domain, EC2 address or
localhost origin is hardcoded in the feature.

Native payload contains exactly:

- title: <Pharmacy Name> - MediNear
- text: View <Pharmacy Name> on MediNear.
- url: the clean existing pharmacy details URL

Customer data, tokens, inventory and histories are not included. This action does not persist
anything or send a new backend request.

## Native share and desktop fallback

When navigator.share is available, the button invokes the native share sheet from the user's
click. A resolved share shows Pharmacy shared. AbortError cancellation produces no error or
copy action. Other failures show Unable to share this pharmacy. Please try again.

Without native sharing, Clipboard API writeText copies the canonical link and shows Pharmacy
link copied. If clipboard is missing/denied, a temporary readonly textarea and the browser's
legacy copy command are attempted. The temporary element is removed and previous focus is
restored. If all copy methods fail, the requested failure message appears, along with an
accessible readonly field holding the clean canonical link for manual copying. This avoids
requiring the user to copy location parameters from the current address bar.

Share is a semantic button with a pharmacy-specific label, existing focus styling and inline
status/alert feedback. A ref guard and disabled/loading state prevent duplicate share actions.
The existing flex layout wraps on mobile. No custom social-network buttons or notification
architecture were introduced.

## Authentication limitation

The recipient may need to log in as a customer before viewing the shared pharmacy. The route
was not made public and the existing login redirect behavior was not changed. If login takes
the recipient to Home, reopening the shared link after login opens the pharmacy through the
existing details route. Owner access remains governed by existing role routing.

## Files created

- medinear/src/utils/sharePharmacy.js
- medinear/src/components/SharePharmacyButton.jsx
- medinear/tests/sharePharmacy.test.js
- docs/SHARE_PHARMACY.md

## Files modified

- medinear/src/pages/PharmacyDetails.jsx
- medinear/src/components/Icon.jsx (share icon in the existing icon system)
- medinear/src/styles/PharmacyDetails.css (scoped feedback/mobile styling)
- medinear/tests/integration/pharmacyFlow.integration.js

## Validation

- Frontend npm test: 54 passed.
- Frontend npm run test:integration: 1 passed.
- Frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

New tests cover clean route/origin generation, payload field isolation, native sharing,
AbortError cancellation, actual share errors, clipboard success/failure, legacy fallback cleanup,
manual-link feedback, semantic button rendering and preserved details actions. Existing favorite,
recently viewed, medicine history, location, status, profile-photo and restock tests pass. The
integration test shares a real pharmacy API response through a mocked native browser capability
and verifies its name and existing route. Frontend tests follow the existing utility and React
server-rendering approach; actual platform share-sheet checks remain manual. Backend tests were
not needed because backend files were unchanged.

## Exact manual browser testing steps (remain to be performed)

A. Desktop fallback

1. Run the existing backend/frontend development servers, log in as a customer and open a
   pharmacy's details. Use a browser without native Web Share (or simulate its absence using
   browser DevTools before clicking).
2. Click Share. Verify Pharmacy link copied. Paste into a text field and verify the URL is
   `<current origin>/pharmacy/<actual ID>`, without lat/lng, search parameters or a hash.
3. Paste the link into another tab where the customer is logged in. Verify the same pharmacy
   opens. Check Call Pharmacy, Directions and Save Pharmacy still work.

B. Mobile/native share

1. Open the app on a supported mobile browser in an environment permitted to use Web Share
   (typically HTTPS, or localhost for development) and log in as a customer.
2. Open pharmacy details and tap Share. Verify the device share sheet appears.
3. Choose an installed sharing app and inspect the pharmacy name, public text and clean link.
   Sending a message to another person is optional; no specific social app is hardcoded.

C. Cancel

1. Open Share again and dismiss the native share sheet.
2. Verify no error or copied-link message appears and the Share button becomes usable again.

D. Route/auth and copy failure

1. Open the clean shared URL directly in a logged-in browser: it should resolve through the
   existing Pharmacy Details route.
2. Open it in a logged-out/private browser. Verify existing authentication protection is retained.
   Log in, then reopen the link if the existing login flow returns you to Home.
3. Simulate Clipboard API failure/unavailability and legacy copy failure using DevTools. Click
   Share: verify a useful non-blocking error and a selectable clean link, without page failure.
4. Tab to Share and activate with Enter/Space. At mobile width verify the actions wrap and the
   fallback input does not cause horizontal overflow.

No push, deployment, dependencies or backend changes were performed.
