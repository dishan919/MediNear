# Pharmacy closing/opening timing

## Existing architecture

Pharmacy stores timezone (default Asia/Colombo) and seven weekly openingHours entries with
day (Sunday=0), closed, allDay, open and close in HH:mm. Backend openingStatus was already
shared by pharmacy responses and ranking. Its rule is inclusive opening/exclusive closing,
including carry-over from the previous day's overnight shift. A 24-hour badge requires all
seven days configured allDay and not closed. Missing/invalid schedules are Hours unavailable,
with isOpen=null, rather than a fabricated Open/Closed claim.

The original validation and status calculation were moved to shared/pharmacyHours.mjs and
extended with timingText. The backend service keeps the same exports through a small adapter.
Frontend PharmacyStatus uses this exact same utility. No schema, route, owner form, ranking
comparator, availability filter or search changes were made. Existing public pharmacy responses
now include the additive timingText field. Node's synchronous ESM loading is supported by the
modern runtime already used by Vite 8 (validation environment: Node 24).

## Display rules

- Currently open, less than 120 schedule minutes remaining: Closes in N min, H hr, or H hr N min.
- Exactly 120 minutes or longer: Closes at h:mm AM/PM. Closings more than one calendar day
  ahead include the weekday. Overnight closings next morning use Closes at, as requested.
- Closed and next opening today: Opens at h:mm AM/PM.
- Next opening tomorrow: Opens tomorrow at h:mm AM/PM.
- Later opening: Opens Monday (or the correct weekday) at h:mm AM/PM.
- Weekly 24-hour pharmacy: Open 24 Hours, with no closing countdown.
- Valid all-closed week: Closed with no invented opening time.
- Missing, incomplete/malformed schedule or invalid timezone: preserve Hours unavailable,
  with no timing text. Missing timezone uses the existing Asia/Colombo default.

Timing uses the pharmacy's IANA timezone through Intl.DateTimeFormat, never the customer's
device timezone. Remaining minutes follow the same pharmacy-local minute precision as the
existing opening-status calculation; seconds are omitted. The weekly forward search is bounded
at seven days and includes the previous day for overnight periods. Overlapping or adjacent
periods are merged so a continuous opening does not incorrectly show a midnight closing.

## Customer UI and live updates

PharmacyCard and PharmacyDetails use one shared PharmacyStatus component. The 24-hour display
is one Open 24 Hours badge instead of redundant badges. Secondary timing text is small and
wraps on mobile. Saved pharmacy cards inherit the same component without changes to favorites.

A shared external clock store maintains one 60-second interval for all mounted status displays.
Subscribers update the badge and timing locally without API polling or per-card timers. The
interval is cleared after the last subscriber unmounts. This refreshes timing using the schedule
already loaded by the page; it does not fetch owner schedule changes or re-sort/refilter the
current search results. A newly fetched search still follows the original backend ranking rules.

## Files created

- shared/pharmacyHours.mjs
- medinear/src/components/PharmacyStatus.jsx
- medinear/src/utils/pharmacyClock.js
- medinear/src/styles/PharmacyStatus.css
- backend/tests/openingTiming.test.js
- medinear/tests/openingTiming.test.js
- docs/PHARMACY_STATUS_TIMING.md

## Files modified

- backend/services/openingHours.js (adapter to the shared implementation)
- medinear/src/components/PharmacyCard.jsx
- medinear/src/pages/PharmacyDetails.jsx
- medinear/tests/favorites.test.js (complete schedule added to the 24-hour fixture)

## Validation

- Backend npm test: 40 passed.
- Frontend npm test: 34 passed.
- Backend npm run test:integration: 5 passed, 1 skipped.
- Frontend npm run test:integration: 1 passed.
- Backend/frontend npm run lint: passed.
- Frontend npm run build: passed.
- Shared module node --check and git diff --check: passed.

The existing real restock transaction test is skipped on standalone MongoDB because it needs
a replica set. Standalone alert integration and existing feature regressions passed. New tests
cover display thresholds, same-day/tomorrow/weekday/week-wrap openings, overnight carry,
contiguous periods, exact boundaries, all-day/all-closed schedules, missing/invalid data,
explicit timezone, both ranking priorities, card/detail rendering and shared timer cleanup.
Frontend rendering tests freeze the clock to verify countdowns consistently.

## Exact manual browser test steps (remain to be performed)

1. Run npm run dev in backend and medinear. Log in as an owner and use an existing development
   pharmacy's Opening Hours form with timezone Asia/Colombo. Retain its original schedule so
   you can restore it after testing.
2. Set today's period to include the current pharmacy-local time, with closing about 45 minutes
   ahead (not allDay). Log in as a customer, find the pharmacy and open its details. Both the
   card and details should show Open and Closes in approximately 45 min. Wait a minute without
   refreshing: the countdown should decrease.
3. Set closing at least two hours ahead, refresh the customer data and verify Closes at with the
   correct 12-hour pharmacy-local clock time.
4. Configure a future opening later today: verify Closed and Opens at. Configure today closed
   and tomorrow 08:00-20:00: verify Opens tomorrow at 8:00 AM.
5. Configure several consecutive closed days followed by one open day, e.g. Monday 08:00-20:00.
   Verify the next actual weekday is shown, rather than assuming tomorrow.
6. Configure all seven days All day. Verify Open 24 Hours on card/details, with no Closes text.
7. Configure an overnight period such as 18:00-02:00. During that local period, verify Open and
   the next 2:00 AM closing. Shortly before the closing boundary it should count down; at the
   closing boundary the next minute update must show Closed and the next actual opening.
8. Configure all seven days Closed. Verify Closed with no fabricated opening time. A pharmacy
   whose schedule is missing should continue showing Hours unavailable.
9. Inspect at mobile width: timing wraps without overflow or noticeably larger cards. Check the
   saved pharmacy card inherits the same status display. Verify medicine search and Smart/Nearest
   ordering retain their existing priorities.
10. Restore the original development pharmacy schedule when finished.

No dependencies, authentication changes, pushes or deployments were added.
