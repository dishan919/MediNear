# MediNear

MediNear is a MERN-stack pharmacy and medicine availability platform for finding medicines and discovering pharmacies by availability, opening status and distance. Pharmacy owners manage their pharmacies, inventory, medicine holds, customer reviews and inventory analytics.

## Features

### Customer Features

- Search medicines by name, generic name or brand, with result counts and helpful no-result suggestions.
- Discover pharmacies using current location, province/district and distance-radius filters.
- Compare ranked results, live opening/closing information, weekly hours and emergency/open-now or 24-hour filters.
- Save pharmacies and subscribe to in-app restock alerts for unavailable medicines.
- Create, edit and delete pharmacy reviews and ratings.
- Request medicine holds, cancel pending requests and track accepted holds and pickup deadlines.
- Revisit recent medicine searches and recently viewed pharmacies stored in the browser.
- Call pharmacies, open WhatsApp contact links, get Google Maps directions, share pharmacy links and copy addresses.
- Edit profile details, upload/remove a profile photo and change password.
- Use responsive pages with toast feedback for supported actions.

### Pharmacy Owner Features

- Create and manage owned pharmacy profiles, locations and weekly opening hours.
- Add, edit and delete inventory records, including quantities, prices and optional medicine image URLs.
- Track low stock, out-of-stock medicines, expiry dates and Expiring Soon/Expired statuses.
- Accept or reject hold requests, monitor pickup deadlines and mark accepted holds as collected.
- View customer reviews, rating summaries and review filters in the owner dashboard.
- View six inventory metrics: Total Medicines, Total Stock Units, Low Stock, Out of Stock, Expiring Soon and Expired.
- Review a prioritized Needs Attention list with multiple issue badges and a link back to inventory.
- Edit account details and change password.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Axios, CSS, Google Maps JavaScript API |
| Backend | Node.js, Express 5, Mongoose 9 |
| Database | MongoDB |
| Authentication | JWT, bcryptjs, role and ownership authorization |
| Testing and tooling | Node.js test runner, React server rendering, Oxlint, nodemon |

## Architecture

```text
Customer / Pharmacy Owner → React UI → Express REST API → MongoDB
```

React handles role-specific pages and Axios requests. Express routes use JWT middleware, role checks and ownership checks to protect customer and owner workflows. MongoDB stores users, pharmacies with embedded inventory, reviews, holds, restock subscriptions and notifications. Shared utilities keep stock, expiry and opening-hours rules consistent between the API and UI.

### Smart Pharmacy Ranking

Default medicine results prioritize availability, then opening status (open, unknown, closed), then distance. Nearest sorting keeps availability first, followed by distance and opening status. Name and ID provide deterministic tie-breaks; unavailable distances sort last within the relevant group. Emergency mode filters to currently open pharmacies; the separate 24-hour filter selects 24-hour pharmacies.

### Medicine Holds

A customer submits a pending request without deducting stock. Owner acceptance reserves stock and sets a 24-hour pickup deadline; the owner can then mark it collected. Expired accepted holds restore reserved stock through the normal hold workflows. Transaction-sensitive hold operations and restock updates require MongoDB Atlas or a replica set; standalone MongoDB cannot exercise the complete workflow.

### Medicine Expiry and Analytics

Owners can set optional expiry dates. Expiring Soon uses the shared inclusive 30-day window, and medicines remain valid through their expiry day in Sri Lankan time. Expired inventory is excluded from customer availability. Owner analytics are read-only: stock and expiry issues may overlap, and the top ten attention items prioritize expired, out-of-stock, expiring-soon and low-stock medicines.

## Getting Started

Use Node.js 22.12+ with compatible npm and a running MongoDB instance. Use a local replica set for the complete development/test workflow, or Atlas for application use.

### Clone and Install

```bash
git clone https://github.com/dishan919/MediNear.git
cd MediNear
cd backend
npm ci
cd ../medinear
npm ci
cd ..
```

### Environment

Create `backend/.env` with your own values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/medinear
JWT_SECRET=replace_with_a_long_random_secret
PORT=5000
JWT_EXPIRES_IN=7d
```

For a replica set, use its connection string, including the appropriate `replicaSet` option. `PORT` and `JWT_EXPIRES_IN` are optional with the defaults shown. Optional `PROFILE_PHOTO_DIR` overrides the backend's local photo storage directory; keep this directory persistent when hosting.

The frontend defaults to `http://localhost:5000/api`. Create `medinear/.env` if overriding it or enabling the embedded map:

```dotenv
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_MAPS_API_KEY=your_browser_maps_key
```

`VITE_GOOGLE_MAPS_MAP_ID` is also optional. Without a Maps key, external directions links remain available. Frontend variables are browser-visible; restrict the Maps key appropriately and never put private secrets in `VITE_*` values. Keep real environment files out of version control and restart the apps after changes.

### Run Locally

In one terminal:

```bash
cd backend
npm run dev
```

In a second terminal:

```bash
cd medinear
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`. The API defaults to `http://localhost:5000/api`. Register as a customer or pharmacy owner; owners use `/pharmacy/dashboard` and customers use `/`.

For optional local sample accounts and pharmacies, run `npm run seed` and `npm run seed:pharmacies` from `backend/`. These scripts reject production/remote databases and preserve existing seeded records on repeat runs. See [the seed script](backend/scripts/seed.js) for development account credentials.

## Testing

Run these commands separately from **each** application directory (`backend/` and `medinear/`):

```bash
npm test
npm run test:integration
npm run lint
```

Integration tests require a running local development MongoDB database configured through `backend/.env`; seed local examples first for the frontend pharmacy-flow test. Use a local replica set for full transaction coverage: some transaction tests skip on standalone MongoDB. Use a dedicated development database, not production data. Frontend production build: `cd medinear` then `npm run build`.

## Deployment

Build the frontend with `npm run build` in `medinear/` and serve `medinear/dist` with SPA fallback routing. Run the backend with `npm start` in `backend/`, configure its database/JWT environment and set `VITE_API_URL` before building the frontend. Use transaction-capable MongoDB and persistent profile-photo storage. This repository does not include an automated deployment configuration or verify a live deployment.

## Current Scope and Documentation

Cart, checkout and order history are browser-local demonstrations; they do not submit backend orders or process payments. Change Password is implemented for signed-in users; forgotten-password recovery is not implemented. Restock alerts are in-app notifications, not email or SMS.

Detailed feature and validation reports are in [docs/](docs/), including [medicine holds](docs/MEDICINE_HOLD_REQUESTS.md), [pickup deadlines](docs/HOLD_EXPIRATION.md), [expiry tracking](docs/MEDICINE_EXPIRY_TRACKING.md) and [inventory analytics](docs/OWNER_INVENTORY_ANALYTICS.md).

## Author

Developed by Dishan — [dishan919](https://github.com/dishan919) · [GitHub Repository](https://github.com/dishan919/MediNear)
