# MediNear role authentication and local verification

MediNear keeps its existing User model (`name`, not a second `fullName` field), bcrypt password hashing, JWT login, and `/api/auth/profile` session check. Registration responses, login responses, and session responses include the role and never include the password hash.

Registration accepts only `customer` and `pharmacy_owner`. Omitting the role defaults to `customer`. Login ignores any submitted role and uses MongoDB's user record. The same Login page serves both account types. Registration still redirects to `/login` without saving the registration token.

Customers go to `/`. Owners go to `/pharmacy/dashboard`. The frontend waits for the backend session check before showing routes. Customer routes and owner routes check their required role. Guest routes send authenticated users to their role's home. Logout removes the saved token and user and immediately redirects to Login.

The existing pharmacy POST, PUT, and DELETE endpoints now run JWT authentication followed by `requireRole("pharmacy_owner")`. Guests receive 401 and customers receive 403. Pharmacy reads remain unchanged. This initial implementation checks the owner role; it does not yet associate pharmacies with individual owners or implement per-pharmacy ownership permissions. Dashboard tools are placeholders, with no medicine, opening-hours, ranking, or emergency features added.

Users without a role default to customer. Obsolete `admin` and `pharmacy` values also receive customer access, never owner access. Existing accounts can still log in; no bulk database migration runs. A subsequent profile update saves the normalized customer role for such records.

## Development seed

From the repository root:

```powershell
cd backend
npm run seed
```

This separate script reads the existing backend environment configuration. It refuses `NODE_ENV=production` and permits only a local MongoDB connection. It is never called when the server starts. Each email uses an insert-only upsert and the model's unique email index, so rerunning it creates no duplicates and preserves existing records and passwords. Passwords use the same hashing helper as registration, with bcrypt cost 10. These credentials are DEVELOPMENT ONLY and must never be used for real accounts:

| Name | Email | Phone | Role | Development-only password |
| --- | --- | --- | --- | --- |
| Test Customer | customer@medinear.test | 0771234567 | customer | DevCustomer123! |
| Test Pharmacy Owner | owner@medinear.test | 0777654321 | pharmacy_owner | DevOwner123! |

If those emails already exist, seeding leaves them unchanged; their previous passwords and roles remain in effect.

## Verify MongoDB Compass

The current local configuration uses database **medinear**, collection **users**. The database name comes from the configured `MONGO_URI`; it may differ if that environment setting changes. No connection string or database credentials are documented here.

1. Open MongoDB Compass and connect using your existing local MongoDB connection.
2. Refresh the database list, open `medinear`, then select `users`.
3. Enter `{ "email": "customer@medinear.test" }` in the Filter field and click Find. Repeat with `owner@medinear.test`.
4. Check `name`, `email`, `phone`, and `role` against the table above. The stored name field is `name`; API responses also offer `fullName` for frontend compatibility.
5. Check that `password` contains a 60-character bcrypt hash beginning with `$2b$10$`, rather than the development password. The automated integration check also uses `bcrypt.compare` to verify the hash matches.
6. Check `createdAt` and `updatedAt`, stored as dates by Mongoose timestamps.
7. Register a new account in the app, then search with its lowercased email: `{ "email": "your-new-email@example.com" }`. Verify the selected role and the same fields. Registration returns you to Login; log in there to check the role-specific destination.

## Verify with mongosh

Open mongosh using your existing local connection, then run:

```javascript
use medinear
db.users.find(
  { email: { $in: ["customer@medinear.test", "owner@medinear.test"] } },
  { name: 1, email: 1, phone: 1, role: 1, createdAt: 1, updatedAt: 1 }
)
db.users.aggregate([
  { $match: { email: { $in: ["customer@medinear.test", "owner@medinear.test"] } } },
  { $project: {
    email: 1, role: 1,
    passwordIsBcrypt: { $regexMatch: { input: "$password", regex: /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/ } }
  } }
])
db.users.countDocuments({ email: "customer@medinear.test" })
db.users.countDocuments({ email: "owner@medinear.test" })
```

Each count should be 1 after seeding, including after running the seed again. For a newly registered account, change the email filter to that account's normalized email.

## Checks

```powershell
cd backend
npm test
npm run seed
npm run test:integration
cd ../medinear
npm test
npm run build
npm run lint
```

The explicit integration command requires the local configured MongoDB and seeded development accounts. It exercises the existing Express routes against real MongoDB, verifies stored password hashes and both roles, checks sessions and authorization, and deletes only its temporary test users. Unit tests use mocks and run without MongoDB. Frontend tests cover role destinations, route guards, forms, validation, and loading behavior.

## Implementation file manifest

Created:

- `backend/utils/roles.js`
- `backend/utils/hashPassword.js`
- `backend/scripts/seed.js`
- `backend/tests/roles.test.js`
- `backend/tests/seed.test.js`
- `backend/tests/integration/auth.integration.js`
- `medinear/src/auth/roles.js`
- `medinear/src/pages/PharmacyDashboard.jsx`
- `medinear/src/styles/PharmacyDashboard.css`
- `medinear/tests/roles.test.js`
- `ROLE_AUTH_DEVELOPMENT.md`

Modified:

- `backend/models/User.js`
- `backend/controllers/authController.js`
- `backend/controllers/userController.js`
- `backend/controllers/pharmacyController.js` (access comments only)
- `backend/middleware/authMiddleware.js`
- `backend/routes/pharmacyRoutes.js`
- `backend/utils/authValidation.js`
- `backend/package.json`
- `medinear/src/App.jsx`
- `medinear/src/components/GuestRoute.jsx`
- `medinear/src/components/ProtectedRoute.jsx`
- `medinear/src/pages/Login.jsx`
- `medinear/src/pages/Register.jsx`
- `medinear/src/styles/Auth.css`
- `medinear/src/utils/authValidation.js`
- `medinear/tests/authPages.test.js`
- `medinear/tests/authRoutes.test.js`
- `medinear/package.json`

Validation completed: 13 frontend tests, 9 backend unit tests, and 1 real-MongoDB HTTP integration test passed. Frontend build and lint passed, as did all backend JavaScript syntax checks and `git diff --check`. Frontend redirection is covered by destination-helper and rendered-guard tests; no browser-driven end-to-end run was performed. Both development users were created in the configured local MongoDB. Repeated seeding was checked for duplicate prevention and exact preservation of existing records, including passwords and timestamps.
