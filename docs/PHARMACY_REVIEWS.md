# Pharmacy Reviews & Ratings

## Existing architecture and scope

MediNear uses Express routers/controllers, Mongoose User and Pharmacy models, bcrypt-backed login, stateless JWT protect middleware and requireRole customer/owner guards. User.name is the existing display-name field. Pharmacy Details uses an Axios API helper, controlled React components and shared MedicineUI styles. ToastContext already provides short-lived action feedback. Tests use Node test, Vite SSR/controlled views and explicit local MongoDB integration suites.

Reviews are isolated in a new collection and a new Pharmacy Details section. Authentication behavior, customer-only frontend Pharmacy Details routing, pharmacy models, ranking/search, inventory and existing actions are unchanged. The public review API is readable by guests and owners, consistent with existing public pharmacy APIs. Existing frontend routing sends owners to their dashboard; this feature does not introduce an owner review-viewing page or moderation controls. Owner write attempts are forbidden by the backend.

PharmacyCard was inspected and remains unchanged: the pharmacy/search API has no batch rating summaries. Adding per-card review requests would create N+1 calls. Rating display stays on Pharmacy Details; no ranking changes were made.

## Schema and endpoints

Review fields: required ObjectId pharmacy and customer references, required integer rating 1-5, optional trimmed comment defaulting to an empty string, createdAt and updatedAt timestamps. Comment input is limited to 500 characters, enforced on both client and backend. Non-string comments and non-number/fractional/out-of-range ratings are rejected. Database schema validation also enforces rating range/integer and comment length.

Indexes: unique { pharmacy: 1, customer: 1 } prevents concurrent duplicate reviews at database level; { pharmacy: 1, createdAt: -1, _id: -1 } supports listing order. Mongoose creates the declared indexes using the project's existing auto-index behavior; the integration tests await Review.init() and test concurrent creation. There is no cached rating field on Pharmacy.

Endpoints under the existing pharmacy router:
- GET /api/pharmacies/:id/reviews?page=1: public paginated list and summary.
- GET /api/pharmacies/:id/reviews/mine: authenticated customer's own review or null.
- POST /api/pharmacies/:id/reviews: authenticated customer creates { rating, comment }.
- PATCH /api/pharmacies/:id/reviews/:reviewId: authenticated customer updates their rating and/or comment.
- DELETE /api/pharmacies/:id/reviews/:reviewId: authenticated customer deletes their review.

All handlers validate pharmacy IDs/existence. Mutations validate review IDs and filter by review ID, pharmacy and authenticated customer. Neither the create author nor edit/delete ownership comes from request-body IDs. Only rating/comment can be updated; customer/pharmacy are immutable through these endpoints. Guests get 401, owners 403, duplicates 409, invalid input 400, missing pharmacy/review or another customer's target review 404. Unexpected errors return a generic safe message without database internals.

## Statistics, ordering and privacy

A MongoDB aggregation facets the matched reviews into full-pharmacy statistics and a bounded page. The average is the arithmetic mean of all ratings, with no stored cache. The UI consistently displays one decimal (4 becomes 4.0; 4.25 becomes 4.3). Decorative summary stars round to the nearest whole star; the numerical average and accessible text remain exact to one decimal. Zero reviews displays No reviews yet, with no invalid arithmetic.

Pages contain at most ten reviews; page numbers are positive safe integers capped at 100000. Sort is createdAt descending then _id descending as a deterministic tie-breaker. Editing changes updatedAt without moving the review to the top. The customer's own review is fetched separately so its controls remain available even if it is not on the current page. Summary/list reads use one aggregation; the separate own-review read may reflect another tab's concurrent mutation. Retry reloads both. Deleting recalculates the count/average on refresh.

The public projection includes only review ID, rating, comment, timestamps and authorName (User.name, or Customer if the account no longer exists). It does not return customer IDs, email, phone, address, password/hash, JWT or other account fields. The own-review response also excludes customer/pharmacy identity fields. Review IDs are resource identifiers, not user IDs. React renders text without raw HTML. A helper asks users to review service quality and avoid medical advice, prescriptions and private information; automated moderation is outside this feature.

## UI behavior

Customers select one of five native labelled radio inputs, enter an optional comment and submit. Validation errors remain inline; successful create/edit/delete uses the existing toast messages Review submitted., Review updated., Review deleted. A synchronous mutation lock and disabled controls prevent duplicate requests. Initial/API loading failures remain inside the reviews section with Retry reviews, leaving pharmacy contact actions usable.

An existing review replaces the create form with Edit Review/Delete Review. Edit prepopulates original values; Cancel discards the draft with no request. Delete requires an inline confirmation with Cancel initially focused. Other authors' list items have no editing controls. Guests/owners see a read-only list when the view is rendered for them. Be the first wording appears only for customers. Reads and mutations abort on unmount; aborted operations cannot update UI state or show toasts. As with other APIs, aborting a request cannot guarantee the server has not already completed a write.

## Files

Created:
- backend/models/Review.js
- backend/controllers/reviewController.js
- backend/routes/reviewRoutes.js
- backend/tests/reviews.test.js
- backend/tests/integration/reviews.integration.js
- medinear/src/components/PharmacyReviews.jsx
- medinear/src/utils/reviews.js
- medinear/src/styles/Reviews.css
- medinear/tests/reviews.test.js
- medinear/tests/integration/reviews.integration.js
- docs/PHARMACY_REVIEWS.md

Modified:
- backend/routes/pharmacyRoutes.js (mount nested review router)
- medinear/src/pages/PharmacyDetails.jsx (mount isolated reviews section)

No dependencies or environment settings changed. Nothing was pushed or deployed.

## Validation

- Backend npm test: 52 passed.
- Frontend npm test: 93 passed.
- Relevant backend integration tests (reviews, auth, favorites): 3 passed.
- Frontend npm run test:integration: 3 passed, including the new real HTTP/database -> service -> React summary/list create/edit/delete flow.
- Backend npm run lint (repository syntax check): passed.
- Frontend npm run lint: passed without warnings.
- Frontend npm run build: passed.
- git diff --check: passed.

The real database tests cover ratings 1/5, invalid ratings/comments/IDs, missing pharmacy, authentication/roles, concurrent duplicate writes, own edit/delete, forbidden cross-customer mutations, immutable identity, safe public projection, mean/count recalculation, ordering, pagination and empty state. Frontend tests cover validation, controlled radios/comment changes, request payloads, locking, lifecycle cleanup, toasts, edit/cancel/delete controls, owner/other-author restrictions, loading/errors, HTML escaping and existing pharmacy actions. Tests follow the existing SSR/controlled-component approach and are not a mounted-browser automation suite. Manual browser/device checks below remain unexecuted.

## Exact manual browser steps

Start the backend and frontend with their usual local configuration: backend npm run dev and medinear npm run dev in separate terminals. Use disposable customer accounts A and B and a test pharmacy. Keep its details URL for repeat checks.

A. Sign in as customer A, open the pharmacy details URL and scroll below pharmacy information to Customer Reviews. Select 5 stars and enter Good service. Submit. Expect Review submitted. in a toast, the review in the list/Your Review, the count increased by one, and the recalculated one-decimal average. With no other reviews, expect 5.0 and 1 review. Refresh and verify persistence.

B. Verify the create form has become Edit Review/Delete Review. Open the same details page in a second tab before submitting if testing concurrency: submit both forms together. Expect one review only; the losing tab shows duplicate feedback and Retry reviews loads its existing review. Inspect Network to confirm customer ownership is never sent as an authoritative field.

C. Click Edit Review. Expect 5 and Good service. prepopulated. Change them, then click Cancel. Expect the original review unchanged and no PATCH request. Edit again, select 4, enter Friendly staff., and Save Changes. Expect Review updated., changed content and recalculated average/count. Refresh to verify it persisted.

D. Click Delete Review, then Cancel. Expect no DELETE request and the review remains. Click Delete Review again and confirm Delete. Expect Review deleted., removal from the list, count decreased and average recalculated. With no remaining reviews, expect No reviews yet and a fresh create form.

E. Recreate a review as A. Sign out, then sign in as B and open the same pharmacy. Verify A's review has no Edit/Delete controls and B has their own create form. For a backend ownership check in local development, use DevTools to replay a PATCH/DELETE request with B's token targeting A's review ID; expect 404 and no change. Do not share captured tokens or requests.

F. Sign in as an owner. Existing customer-page routing still sends owners to their dashboard. To check read access, open /api/pharmacies/<test-id>/reviews at the backend origin: the public list is readable. Using an owner's authenticated request in DevTools, attempt POST/PATCH/DELETE: expect 403. No owner moderation/editing feature was added. Read-only owner presentation is covered by the controlled-view frontend tests.

G. As a customer inspect Network review responses and rendered list. Verify only display names, ratings, comments, dates and review resource IDs are exposed; no customer ID, email, phone, address, password/hash or JWT is present in review response bodies. Authentication tokens remain only in the existing request headers, as required by auth.

H. Leave rating unselected and submit: expect inline validation with no write request. Try a comment above 500 characters: the textarea caps input; replay an oversized body locally to verify backend 400. Use DevTools offline mode and Retry reviews: expect a contained error/retry state while Pharmacy Details remains usable. Restore network and retry. Throttle the network and double-click Submit/Save/Delete: expect one mutation request and disabled controls until completion.

I. Verify Call Pharmacy, WhatsApp Pharmacy, Directions, Save Pharmacy, Share and Copy Address still operate as before. Review operations should not change ranking, search state, recent items or restock alerts.

J. Set DevTools responsive viewport to 375 x 812. Check star labels, textarea, long comments/names, controls and pagination fit without horizontal overflow. Tab to the star group and use arrow keys to choose a rating, then submit from the keyboard; verify visible focus and readable validation. With a screen reader verify the rating legend, 1 star through 5 stars labels and comment help. Check document.documentElement.scrollWidth <= window.innerWidth.

K. If the test pharmacy has more than ten reviews, use Next reviews and Previous reviews. Expect ten items per page, newest first, no duplicated/missing page boundary items in a stable dataset, unchanged full-pharmacy summary and access to your own review on every page.
