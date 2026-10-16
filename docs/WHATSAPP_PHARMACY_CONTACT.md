# WhatsApp Pharmacy Contact

Existing phone architecture: Pharmacy.phone is a required, trimmed string. Owner create/edit uses the existing required Phone number text input. The backend accepts a nonempty string up to 500 characters and trims it; it has no pharmacy-specific numeric-format rule. The customer pharmacy API already exposes this business phone, used by Call Pharmacy as tel:<stored phone>. Development fixtures use local numbers such as 0111234567. There is no separate WhatsApp field or existing generated contact-message pattern.

No backend, schema, owner form, dependency or environment changes were needed. This feature reads the existing business contact without changing its stored value.

Normalization is centralized in medinear/src/utils/whatsappPharmacy.js:
- Local 0 plus nine digits, with a nonzero first national digit: replace only the trunk 0 with 94. Example: 0771234567 becomes 94771234567.
- +94 or already-normalized 94 plus nine national digits: remove the optional leading plus. Example: +94771234567 becomes 94771234567.
- Trim outer whitespace; allow ASCII spaces, hyphens, parentheses and periods as formatting separators, which the existing owner text input/backend permit. Check the allowed character set before stripping these separators.
- Reject missing/non-string values, letters, extensions, embedded control characters, extra plus signs, URL/query characters, incorrect lengths and a national number starting with zero. Ambiguous bare national numbers, 0094 prefixes and non-Sri-Lankan country codes are deliberately unsupported; no country code is guessed.
- Recognizable landlines are also supported. A valid number shape does not establish that the business has a WhatsApp account.

The link is exactly https://wa.me/<normalized-number>, with no query, fragment or prefilled message. Only pharmacy.phone is passed to the utility; no customer identity, phone, location, coordinates, token, search or medicine history is included. The customer decides whether to write or send a message. No toast or message-sent claim is made.

Pharmacy Details places WhatsApp Pharmacy between Call Pharmacy and Directions. It uses the existing secondary button styling, keyboard-native link behavior, 44px minimum button height and visible focus outline. Its accessible name is Contact pharmacy on WhatsApp. target=_blank and rel=noopener noreferrer preserve the SPA and avoid passing a referrer. Existing action-row wrapping is retained; a narrowly scoped style lets the longer label shrink/wrap within its container. Missing or invalid phone data hides the WhatsApp link only; Call Pharmacy and other existing actions keep their prior behavior.

Created:
- medinear/src/utils/whatsappPharmacy.js
- medinear/tests/whatsappPharmacy.test.js
- docs/WHATSAPP_PHARMACY_CONTACT.md

Modified:
- medinear/src/pages/PharmacyDetails.jsx
- medinear/src/styles/PharmacyDetails.css
- medinear/tests/integration/pharmacyFlow.integration.js

Validation:
- Frontend npm test: 86 passed, including normalization, unsafe input rejection, privacy, accessible link markup, unchanged Call/Directions/Share and existing Pharmacy Details tests.
- Frontend npm run test:integration: 2 passed. The existing database/API/React integration flow now asserts that owner-created business phone data produces the expected WhatsApp link and unchanged tel link.
- Frontend npm run lint: passed without warnings.
- Frontend npm run build: passed.
- git diff --check: passed.
- Backend files were unchanged, so no separate backend tests or backend lint were required.
- Tests use the existing Node/Vite SSR approach. Manual browser/device checks below have not been executed; actual WhatsApp account availability and app handoff require a browser/device.

Exact manual browser steps:

1. Start the backend and frontend using their existing development configuration (`cd backend`, `npm run dev`; separately `cd medinear`, `npm run dev`). As an owner, use a disposable pharmacy whose business contact you are authorized to test. In Pharmacy Profile enter its real Sri Lankan contact in local format, save, then sign out. Sign in as a customer, find that pharmacy and open View Details.
2. Verify Call Pharmacy, WhatsApp Pharmacy and Directions appear in that order. Inspect the WhatsApp link: a local 0771234567 would produce https://wa.me/94771234567. Use your actual test business number for the external handoff. Tab to the WhatsApp action: verify a visible focus outline; press Enter. Expect a separate tab opening WhatsApp/WhatsApp Web for the correct business contact, while MediNear stays open. No message-sent toast should appear.
3. Verify the destination URL contains only the business number, with no text query or customer data. Verify no message is prefilled or automatically sent. Close the WhatsApp tab without sending a message if you only intend to test navigation.
4. In the owner pharmacy form, change the same disposable contact to its +94 equivalent and then its digits-only 94 equivalent, saving each time. Reopen customer Pharmacy Details after each save; verify both links target the same number. Repeat with spaces/dashes to verify formatting support. Restore the intended business contact afterwards.
5. For invalid data, use the disposable owner's Phone number field to save invalid-contact (the existing backend allows nonempty text), then reload customer details. Verify there is no WhatsApp link and the page, Directions, Share and Copy Address still work. Existing Call behavior is preserved. Restore the valid number. For missing data, use Chrome DevTools Network local response override on the pharmacy detail GET: edit the response pharmacy.phone to null, save the override and reload. Verify the WhatsApp link is absent and details still render; disable the override when done. Do not modify a production record.
6. With a valid contact restored, click Call Pharmacy and confirm its tel destination matches the original stored phone. Click Directions and verify the existing map destination opens. Verify Share still opens native sharing or its clipboard fallback and Copy Address still works.
7. Open DevTools responsive mode at 375 x 812. Reload Pharmacy Details. Verify Call, WhatsApp and Directions wrap cleanly, all labels and focus outlines are readable, and the WhatsApp touch target is usable. Check document.documentElement.scrollWidth <= window.innerWidth in the console to confirm no horizontal overflow. Repeat external handoff on a mobile device with WhatsApp installed where available.

Nothing was pushed or deployed.
