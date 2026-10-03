# MediNear

Medicine inventory, weekly hours, location-based ranking and emergency search are now implemented. See [the implementation report](MEDICINE_FEATURES.md) for APIs, setup, migration and verification results. See [the customer and owner UI report](MEDICINE_UI_REPORT.md) for the redesigned pages, medicine image support and data-flow tests.

MediNear is a web application designed to help users find nearby pharmacies and access useful pharmacy information in one place. Its current implementation lets users browse pharmacy records, search by name or location text, filter by opening status, save favorites, and access contact and directions links.

The project aims to reduce the time spent locating a suitable pharmacy. Medicine search, explicit current-location detection, distance-based results and emergency filtering are implemented.

## Key Features

- **User registration and login:** React forms connected to the existing Express authentication API, with navigation between both pages and a redirect to the home page after login.
- **Form validation:** Required fields, email format, phone number validation, password strength checks, matching password confirmation, and field-level error messages. Password fields include Show/Hide controls.
- **Password hashing and token authentication:** bcryptjs password hashing and JWT verification for protected backend endpoints.
- **Pharmacy browsing and search:** Database-backed pharmacy listings with client-side search by pharmacy name, address, or district.
- **Opening-status filters:** Open Now, 24 Hour, Emergency Mode and distance-radius filters use backend-calculated hours and distance.
- **Pharmacy contact and directions:** Phone-call links and external Google Maps links using stored coordinates.
- **Saved pharmacies:** Database-backed favorites, including adding, removing, viewing, and clearing favorites.
- **User profile:** View and edit name, phone number, and address through authenticated API requests.
- **Responsive interface:** CSS layouts and media queries for pharmacy listings, authentication forms, and supporting pages.
- **Medicine inventory:** Owner-only add/edit/delete, image URLs and customer-visible price/quantity/status. The separate cart, checkout and order history remain local shopping demonstrations.

### Current Implementation Limits

The pharmacy detail page reads MongoDB pharmacy IDs and live inventory through the API. Cart, checkout, and order history use browser `localStorage`; they do not submit orders to the backend or process payments. Card payment and delivery selections are form options only.

Medicine results are ranked by availability, opening status and geographic distance. Opening status is calculated from stored weekly schedules and timezone; missing schedules show Hours unavailable. Embedded Google Maps requires the configured browser key; external directions links remain available.

The Forgot Password link displays an availability notice. Password recovery is not implemented.

## Medicine Search and Inventory

- Customer medicine search supports case-insensitive partial name/generic/brand matches and available stock.
- Smart ranking prioritizes open pharmacies, then distance, with emergency and 24-hour filters.
- `/pharmacy/:id` shows pharmacy information, medicine cards, customer-visible quantities and prices, weekly hours and location.
- Owners manage their own pharmacy inventory with a responsive table and Add/Edit dialog.
- Optional HTTPS medicine image URLs use local placeholders when missing or unavailable.
- From `backend`, run `npm run seed:pharmacies` for safe local development examples.
- Both apps have `npm run test:integration`; the frontend integration test verifies MongoDB ? API ? React rendering.

## System Architecture

MediNear uses a **client-server architecture**. The React frontend communicates with the Node.js/Express backend through JSON REST APIs using Axios. The backend separates routes, controllers, authentication middleware, validation utilities, and Mongoose models. MongoDB stores users, pharmacies, and user favorites.

```text
User
  |
React Frontend (Vite + React Router)
  |
JSON REST API (Axios over HTTP)
  |
Node.js / Express Backend
  |-- Routes and authentication middleware
  |-- Controllers and validation utilities
  |-- Mongoose models
  |
MongoDB
```

The cart and order demonstration follows a separate path: React reads and writes browser `localStorage`. The backend `Order.js` model and `orderRoutes.js` files are empty, and order routes are not mounted.

### Existing API Areas

| API area | Implemented behavior |
| --- | --- |
| `/api/auth` | Registration, login, and authenticated profile retrieval |
| `/api/users` | Authenticated profile retrieval/update and favorite management |
| `/api/pharmacies` | Pharmacy listing, lookup by ID, creation, update, and deletion |

Pharmacy write endpoints currently have no authentication or role checks. Their existence does not constitute a completed pharmacy-owner or administrator workflow.

## Technologies Used

| Area | Technologies |
| --- | --- |
| Frontend | React 19, JavaScript/JSX, React DOM, CSS |
| Frontend tooling | Vite 8, React Vite plugin, Oxlint |
| Routing | React Router DOM 7 with `BrowserRouter`, `Routes`, and route guards |
| HTTP client | Axios |
| Backend | Node.js, Express 5, CommonJS modules |
| Database | MongoDB and Mongoose 9 |
| Authentication | bcryptjs and jsonwebtoken (JWT) |
| Backend configuration | dotenv and cors |
| Development server | nodemon |
| Tests | Node.js built-in test runner, assertions, mocks, and React server rendering |

Leaflet and React Leaflet are installed dependencies, but the current application does not use them to render a map. Directions currently open Google Maps in a separate browser tab.

## Project Structure

```text
MediNear/
|-- backend/
|   |-- config/             # MongoDB connection
|   |-- controllers/        # Authentication, users, and pharmacies
|   |-- middleware/         # JWT verification
|   |-- models/             # User and Pharmacy; Order placeholder
|   |-- routes/             # API routes; order route placeholder
|   |-- tests/              # Authentication controller tests
|   |-- utils/              # Server-side auth validation
|   |-- package.json
|   `-- server.js
|-- medinear/
|   |-- public/
|   |-- src/
|   |   |-- api/            # Axios client
|   |   |-- assets/
|   |   |-- components/     # Auth fields/layout, route guard, cards, navigation
|   |   |-- pages/          # Auth, home, favorites, profile, and shopping pages
|   |   |-- styles/
|   |   |-- utils/          # Frontend auth validation
|   |   |-- App.jsx         # Application routes
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- tests/              # Validation and rendered-page tests
|   |-- package.json
|   `-- vite.config.js
|-- AUTH_IMPLEMENTATION.md
|-- package.json            # Separate root dependency manifest
`-- README.md
```

The local checkout may be named `Medi`; cloning the repository normally creates a directory named `MediNear`. Install and run the application from its `backend/` and `medinear/` directories.

## Installation and Setup

### 1. Prerequisites and Clone

Use Node.js compatible with the installed tooling: Node.js 20.19+ within the 20.x release line, or Node.js 22.12+ and newer compatible releases. Install npm and provide a running local MongoDB instance or a MongoDB connection string.

```bash
git clone https://github.com/dishan919/MediNear.git
cd MediNear
```

### 2. Install Dependencies

Install backend dependencies:

```bash
cd backend
npm ci
cd ..
```

Install frontend dependencies:

```bash
cd medinear
npm ci
cd ..
```

### 3. Configure Environment Variables

Create `backend/.env`:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/medinear
JWT_SECRET=replace_with_a_long_random_secret
```

`MONGO_URI` and `JWT_SECRET` are required for the database and token authentication. Optional settings supported by the backend are:

```dotenv
PORT=5000
JWT_EXPIRES_IN=7d
```

The backend defaults to port `5000` and a JWT expiry of `7d` when these optional values are omitted. Replace example values with your own local configuration. Never commit real credentials or secrets; `.env` files are excluded by the repository's `.gitignore`.

The frontend defaults to `http://localhost:5000/api`. If the backend address or port differs, create `medinear/.env`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

`VITE_API_URL` is optional and must include the `/api` suffix. Vite exposes frontend environment values to the browser, so do not put secrets in them. Restart the frontend after changing its environment file.

### 4. Start the Backend

In a terminal at the repository root:

```bash
cd backend
npm run dev
```

Use `npm start` to run without nodemon. The default API base is `http://localhost:5000/api`; `http://localhost:5000/` returns an API status message. The backend exits if its MongoDB connection fails.

### 5. Start the Frontend

In a second terminal at the repository root:

```bash
cd medinear
npm run dev
```

Open the URL printed by Vite, normally:

- Login: `http://localhost:5173/login`
- Register: `http://localhost:5173/register`
- Main/home page: `http://localhost:5173/`

Vite may choose another port if `5173` is occupied. Register an account, then log in to access the protected pages. An existing stored token redirects Login/Register visits to Home; use a private browser window to inspect the login page with a fresh session.

From `backend`, run `npm run seed:pharmacies` to create safe local development pharmacies and medicine inventory. It refuses production/remote databases and preserves existing values on repeat runs. All pharmacy-detail data comes from MongoDB/API records.

## Authentication

- **Registration:** Collects full name, email, phone, password, and confirmation. The frontend sends name, normalized email, phone, and password to `POST /api/auth/register`. After success, it returns to Login with a success message.
- **Validation:** Frontend and backend validate required registration inputs, email format, phone numbers with 9–15 digits, and passwords containing at least eight characters with uppercase, lowercase, and a number. Registration rejects passwords over 72 UTF-8 bytes. Matching confirmation is checked by the frontend. Login validates email and requires a password while allowing older accounts to retain their existing password rules.
- **Password storage:** The backend hashes passwords with bcryptjs using cost factor 10 and compares hashes during login. Passwords are not saved in frontend storage.
- **Login:** `POST /api/auth/login` returns a JWT and user information. The frontend stores them under `token` and `user` in `localStorage`, then navigates to `/`.
- **Route protection:** The frontend checks for a stored token. Backend middleware verifies the JWT, checks expiry, loads the user, and excludes the password from the authenticated user object. Protected requests send `Authorization: Bearer <token>`.
- **Recovery:** Password-reset endpoints, reset tokens, and email delivery are not implemented.

## Testing

Neither application package defines an `npm test` script. Existing tests run directly with Node.js after installing dependencies.

From the repository root, run frontend validation and backend authentication tests:

```bash
node --test medinear/tests/authValidation.test.js backend/tests/auth.test.js
```

From `medinear/`, run the rendered authentication-page test:

```bash
node --test tests/authPages.test.js
```

The tests cover validation, authentication page markup and reciprocal links, password hashing, invalid credentials, JWT verification, and duplicate email handling. Backend tests mock database operations while using real bcrypt and JWT libraries; they do not verify live MongoDB persistence. Rendered-page tests do not replace browser interaction or responsive visual testing.

For frontend linting and a production build, run from `medinear/`:

```bash
npm run lint
npm run build
```

## Future Improvements

- Backend-connected medicine availability search and inventory management.
- Smart pharmacy ranking using availability, distance, and opening status.
- A dedicated emergency/24-hour mode with location-aware results.
- Browser geolocation, integrated maps, and distance calculation.
- Pharmacy-owner workflows and authorization for pharmacy management.
- Connect pharmacy details to database records instead of numeric sample IDs.
- Backend order persistence and real payment/delivery integrations.
- Notifications for relevant pharmacy, inventory, or order updates.
- Secure password recovery with expiring, single-use reset tokens and email delivery.
- Broader browser and database integration tests.
- Improved session expiry handling, restricted CORS, and authentication rate limiting.

## Security

Implemented practices include bcrypt password hashing, registration/login input validation, normalized unique email addresses, signed expiring JWTs, server-side authentication middleware, and environment-based secret configuration. Auth/profile responses exclude password hashes, and external directions links use `noopener,noreferrer`.

Current limitations should be addressed before production use: JWTs are stored in JavaScript-accessible `localStorage`, frontend guards only check token presence, CORS is unrestricted, and pharmacy create/update/delete endpoints have no authentication or role enforcement. Rate limiting, email verification, token refresh/revocation, and password recovery are not implemented.

## Author

Developed by Dishan

GitHub: [dishan919](https://github.com/dishan919)

## Repository

[MediNear on GitHub](https://github.com/dishan919/MediNear)
