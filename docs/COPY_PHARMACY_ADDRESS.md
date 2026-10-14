# Copy Pharmacy Address

## Existing clipboard implementation and reuse

Share Pharmacy already exported copyPharmacyLink in src/utils/sharePharmacy.js, using Clipboard
API writeText followed by a temporary readonly textarea/legacy browser copy fallback. That same
function is now exported as copyText, with copyPharmacyLink retained as an alias. Share behavior
and callers remain unchanged; there is no second clipboard implementation.

The existing details address displays the address field followed by the district suffix when
present. Copy Address copies exactly that same text, without adding pharmacy ID, URL, coordinates
or any customer data. Only an actual non-empty address field enables copying; missing values or
known placeholders do not expose an active copy action. Existing address display is preserved.

## UI and feedback

The secondary text button sits alongside the existing address and stacks on mobile. It is a
semantic button with an accessible label and existing visible focus styles. Success shows
Address copied. in an inline status. Clipboard/fallback failure shows a non-blocking alert asking
the customer to select and copy the displayed address. It does not use browser alert().

A ref guard and disabled Copying... state prevent overlapping clicks. Feedback remains visible,
matching Share Pharmacy's existing pattern. No expiration timers are created. A mounted guard
prevents async state updates after navigation/unmount. The shared fallback still removes its
temporary textarea and restores focus.

## Files created

- medinear/src/utils/copyPharmacyAddress.js
- medinear/src/components/CopyAddressButton.jsx
- medinear/tests/copyPharmacyAddress.test.js
- docs/COPY_PHARMACY_ADDRESS.md

## Files modified

- medinear/src/utils/sharePharmacy.js (generic export plus existing alias)
- medinear/src/pages/PharmacyDetails.jsx
- medinear/src/styles/PharmacyDetails.css
- medinear/tests/integration/pharmacyFlow.integration.js

## Validation

- Frontend npm test: 59 passed.
- Frontend npm run test:integration: 1 passed.
- Frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

Tests cover exact displayed address, excluded unrelated pharmacy fields, missing/placeholders,
shared fallback reuse, clipboard failure, semantic keyboard controls, busy/success feedback,
and preserved Share/Call/Directions/Favorites details actions. Existing feature tests remain
passing. The integration test copies the displayed address from a real pharmacy API response
using a mocked clipboard interface. Actual browser interaction checks remain manual.

## Exact manual browser steps (remain to be performed)

1. Start the existing backend/frontend development servers, log in as a customer and open
   pharmacy details. Verify Copy Address appears beside the displayed address.
2. Click Copy Address. Verify Address copied. Paste into a plain text field: it must match the
   displayed address including its district suffix, without URL, pharmacy ID or extra coordinates.
3. Repeat copying. Verify the button stays usable after completion. Tab to the button and
   activate with Enter/Space; verify visible focus and the same copied text.
4. Use a test pharmacy response with missing/empty/placeholder address. Verify no active Copy
   Address button appears and the existing address display remains unchanged.
5. Deny/disable Clipboard API access in browser DevTools. If legacy copy is permitted, verify
   the fallback still copies and shows success. Simulate both methods failing: verify useful
   inline feedback and an otherwise usable details page.
6. Start a copy and navigate away while it is pending. Verify no unmounted-state/timer warning.
7. At mobile width verify the action wraps below the address without overflow. Verify Share,
   Directions, Call Pharmacy, Save Pharmacy and medicine/restock/status behavior still work.

No backend, MongoDB, schema, dependency, .env, push or deployment changes were made.
