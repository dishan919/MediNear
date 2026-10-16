# Owner Review Dashboard

## Architecture and implementation

Existing reviews use a separate Review collection referencing Pharmacy and User via pharmacy/customer ObjectIds, integer rating 1-5, optional trimmed comment (500-character limit) and timestamps. A unique pharmacy/customer index enforces one review per customer. Existing customer APIs support mutations, newest-first ten-item pagination, safe display-name projection and derived mean/count. Owner dashboard uses a selector populated by /pharmacies/mine and Pharmacy.owner references the authenticated User. An owner may have multiple pharmacies.

The existing dashboard now has a Customer Reviews tab for its selected pharmacy. Inventory, pharmacy profile and opening-hours panels retain their behavior. With no selected/created pharmacy, the existing creation form is accompanied by a small select/create message; review analytics are not requested.

New endpoint: GET /api/pharmacies/:id/reviews/owner-dashboard?page=1. Existing protect and requireRole('pharmacy_owner') run first. The controller queries Pharmacy with both requested _id and authenticated req.user._id as owner. Supplied request-body identities have no authority. Guests receive 401, customers 403, invalid IDs/pages 400, missing/deleted/non-owned pharmacies 404 and unexpected errors a safe generic 500. It exposes no new mutation route.

The existing aggregation moved into backend/services/reviewPage.js, used by both public/customer listing and owner analytics. Mean/count remain the same MongoDB $avg/$sum calculations, with no cache or schema change. Owner analytics adds one facet grouping by rating to return all five counts (missing groups default to zero). Mean, count, breakdown and recent page are returned in one aggregation after the ownership lookup, not separate requests per metric/review. Customer API response shape remains unchanged.

Pagination remains ten reviews per page, positive integer page numbers capped at 100000, page/hasMore metadata and Previous reviews/Next reviews controls. Both views share the same sorting: createdAt descending, _id descending as tie-breaker. Editing does not reorder by updatedAt. Mean/count/breakdown cover the entire pharmacy, not just the current page.

Owner UI formats the average to one decimal, matching Pharmacy Details. For each rating, bar percentage = count / reviewCount * 100; zero totals produce 0%. Visible counts and rounded percentages accompany accessible meter labels/value text. Zero reviews displays No ratings yet, Total Reviews 0 and No customer reviews yet. Initial loading hides analytics instead of showing placeholder zero counts. Errors, missing/deleted/non-owned pharmacies, network failures and malformed responses produce an inline retry state without replacing the rest of the dashboard.

The recent-review renderer is reused from PharmacyReviews. Public projection continues selecting only review resource ID, rating, comment, timestamps and User.name (Customer fallback). Customer IDs, email, phone, address, password/hash, JWT, location and account details are excluded. Frontend validation additionally checks finite/ranged statistics, integer/nonnegative counts, matching breakdown total, page metadata and safe review shapes, then explicitly retains only display fields. Text remains React-escaped.

Owner views contain no review form, edit, delete or hide controls. Existing backend customer-role guards still deny owner POST/PATCH/DELETE requests, including for negative reviews. Owner analytics is read-only. No owner moderation was added.

One analytics GET is issued for each selected pharmacy/page. Component keys reset page/state on pharmacy switches. AbortController cancels stale reads on changes/unmount, and response handlers check cancellation before setting state. No chart library or other dependency was added. Shared existing styles provide comment wrapping and pagination; new narrow styles add responsive metric cards and rating bars.

## Files

Created:
- backend/services/reviewPage.js
- backend/controllers/ownerReviewController.js
- backend/tests/ownerReviews.test.js
- backend/tests/integration/ownerReviews.integration.js
- medinear/src/components/OwnerReviews.jsx
- medinear/src/utils/ownerReviews.js
- medinear/src/styles/OwnerReviews.css
- medinear/tests/ownerReviews.test.js
- docs/OWNER_REVIEW_DASHBOARD.md

Modified:
- backend/controllers/reviewController.js: delegate existing listing aggregation to shared service.
- backend/routes/reviewRoutes.js: add protected owner analytics GET.
- medinear/src/components/PharmacyReviews.jsx: export existing ReviewContent for reuse; no customer UI behavior change.
- medinear/src/pages/PharmacyDashboard.jsx: add Reviews tab/panel and no-pharmacy message.
- medinear/tests/integration/reviews.integration.js: extend real review workflow to check owner rendering after customer create/edit/delete.

## Validation

- Backend npm test: 55 passed.
- Frontend npm test: 97 passed.
- Relevant backend integration tests: 2 passed (ownerReviews and existing customer reviews).
- Frontend npm run test:integration: 3 passed, including extended real HTTP/database review flow with owner view.
- Backend npm run lint (repository syntax check): passed.
- Frontend npm run lint: passed without warnings.
- Frontend npm run build: passed.
- git diff --check: passed.

New database integration coverage creates separate customer A/B and owner/other-owner accounts. Customers submit ratings 5 and 3; owner receives average 4.0, total 2 and counts 5=1/3=1. It verifies own-pharmacy access, guest/customer/other-owner denial, private-field exclusion, zero/missing/deleted pharmacy handling, newest-first ordering, all five rating counts, pagination and forbidden owner mutations. Existing customer create/edit/delete/uniqueness/summary tests remain passing. Frontend tests cover response validation, safe projection, one authenticated paginated request, metrics, bar percentages/semantics, read-only controls, loading/empty/error states, no-pharmacy handling and dashboard integration. The real frontend integration renders owner analytics before/after customer edits/deletion.

Tests follow the existing Node/Vite SSR/controlled-view architecture; they are not mounted-browser automation. Manual browser/mobile checks below remain unexecuted.

Explicit scope: dependencies added: no. Database schema changed: no. Customer review behavior changed: no. Smart Ranking/Nearest First/cards/search changed: no. Pushed: no. Deployed: no.

## Exact manual browser steps

Start backend npm run dev and medinear npm run dev with the usual development configuration. Use disposable customers A/B, owner O who owns pharmacy P, and another owner X. Record P's details URL privately for repeat checks.

A. As customer A, open P's Pharmacy Details and submit 5 stars with Friendly and quick service. As customer B submit 3 stars with Good service. Use an otherwise empty test pharmacy for exact arithmetic. Sign in as O, open Owner Dashboard, select P in Your pharmacy and click Customer Reviews. Expect average 4.0, Total Reviews 2, 5-star count 1 (50%), 3-star count 1 (50%) and other counts zero. Compare mean/count with customer Pharmacy Details.

B. Verify all five rating rows are present and their counts sum to Total Reviews. On a pharmacy with at least one review of each rating, compare counts with known customer submissions. Bars show count/total percentages, with exact numeric counts still visible. Tab through the panel and check meter labels with a screen reader.

C. Under Recent Reviews verify B's later review appears before A's, each with display name, rating, comment and date. Inspect the owner-dashboard Network response: it must not contain customer IDs, email, phone, address, password/hash, JWT or customer location. Authentication still uses the normal Bearer request header; do not share captured credentials.

D. Verify there is no Submit Review form or Edit Review/Delete Review/Hide control anywhere in the owner review panel, including for a 1-star review. Using local DevTools with O's token, attempt PATCH/DELETE against an existing customer review endpoint: expect 403 and unchanged review. Attempt POST as O: expect 403 too.

E. Copy the analytics request path, sign in as X and request /api/pharmacies/<P-id>/reviews/owner-dashboard with X's token: expect 404 Owned pharmacy not found. A customer token must receive 403; no token receives 401. An invalid pharmacy ID receives 400; a missing/deleted pharmacy receives 404. Do not treat the frontend selector as the authorization boundary.

F. Sign back in as a customer. Edit your own review, cancel a draft without saving, save a change and delete your review with confirmation. Expect existing inline validation and Review updated./Review deleted. toasts. Return to owner O's Customer Reviews tab (or reload) and verify average/count/breakdown reflect changes. Existing customer creation, one-review enforcement and pagination must still work.

G. Select an owned pharmacy with zero reviews. Expect No ratings yet, Total Reviews 0, five zero bars and No customer reviews yet; no NaN/Infinity. Sign in as an owner who has no pharmacy, or select Create a pharmacy: expect the existing create flow plus the select/create message, no fake review summary and no owner-dashboard analytics request in Network.

H. Throttle the network and open the Customer Reviews tab. Expect Loading reviews... with no temporary zero summary. Switch between two owned pharmacies while a request is pending: only the selected pharmacy should appear. In offline mode, retry/open the panel: expect inline error and Retry reviews. Restore network and retry. To test malformed data locally, override the analytics Network response with an empty JSON object: expect the same safe error rather than a crash; disable the override afterwards.

I. For an owned pharmacy with more than ten reviews, use Next reviews and Previous reviews. Expect at most ten reviews per page, newest-first ordering and unchanged full-pharmacy metrics across pages. Verify inventory editing, pharmacy profile saving and opening-hours panels still work as before.

J. At 375 x 812 responsive size, verify the metric cards stack, rating bars/counts fit, long names/comments wrap and pagination is usable without horizontal scrolling. Check document.documentElement.scrollWidth <= window.innerWidth. Compare normal and empty states and keyboard focus visibility.
