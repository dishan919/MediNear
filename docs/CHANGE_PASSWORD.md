# Change Password

## Architecture and security

The existing backend uses the Mongoose User model, bcryptjs comparisons in login, hashPassword with genSalt(10), and JWT protect middleware. protect verifies the token and loads the user without the password. The new controller reloads the authenticated user's record to verify the stored hash. User model and middleware are unchanged.

PATCH /api/users/password requires protect for both customer and pharmacy_owner accounts. Its JSON body contains currentPassword and newPassword only. A supplied userId or _id does not control the target account. Current password is checked with bcrypt.compare, same-password changes are rejected, and the existing hashPassword helper hashes the replacement. The database update matches the old hash as well as the authenticated account ID, preventing concurrent password changes from silently overwriting one another. Responses contain only safe status/messages/validation errors, with no user record or hash. The controller does not log request data or errors.

The existing registration policy was extracted as validatePassword in each existing backend/frontend authValidation module and reused by registration and password change: at least eight characters, uppercase, lowercase and a number; maximum 72 UTF-8 bytes. No policy was added to login, and registration's existing requirements remain unchanged. No dependencies, schema or environment settings changed.

JWTs are stateless and have no password version, token revocation list or session store. The current session remains valid. Previously issued JWTs also remain valid until their existing expiry (configured JWT_EXPIRES_IN, otherwise seven days). Changing the password affects subsequent password-based logins; it does not revoke issued tokens.

## Frontend and feedback

Profile now includes a compact, separate Change Password form using existing profile styles, AuthField password visibility controls and autocomplete attributes. Client validation blocks missing fields, weak new passwords and mismatched confirmation before making a request. Inline errors use AuthField's existing associations and focus the first invalid input. Request-level failures stay inline with safe wording. The button and fields disable while submitting, with a synchronous submission lock preventing duplicate requests before React rerenders.

On success all three fields clear and the existing Toast system shows "Password changed successfully." Password values are held only in component/request memory and never written to browser storage, URLs or notifications. The request omits confirmPassword. Unmount disables response callbacks; StrictMode effect replay reactivates the submission handler.

Profile was previously inside the customer-only route group. It now uses the existing generic ProtectedRoute so both authenticated roles can reach their own profile; owners have a My Profile dashboard link. Customer/owner guards on all other routes are unchanged. Inventory logic and Profile Photo behavior are unchanged.

## Files

Created:
- backend/controllers/passwordController.js
- backend/tests/changePassword.test.js
- backend/tests/integration/changePassword.integration.js
- medinear/src/components/ChangePassword.jsx
- medinear/src/utils/changePassword.js
- medinear/tests/changePassword.test.js
- docs/CHANGE_PASSWORD.md

Modified:
- backend/routes/userRoutes.js
- backend/utils/authValidation.js
- medinear/src/App.jsx
- medinear/src/pages/PharmacyDashboard.jsx (profile navigation link)
- medinear/src/pages/Profile.jsx
- medinear/src/styles/Profile.css
- medinear/src/utils/authValidation.js

## Validation

- Backend npm test: 46 passed.
- Frontend npm test: 82 passed, including existing Profile Photo tests.
- Backend relevant integration tests (auth, profilePhoto, changePassword): 3 passed against the existing development database. Temporary password-test accounts were removed.
- Frontend npm run test:integration: 2 passed.
- Backend npm run lint (repository syntax checks): passed.
- Frontend npm run lint: passed without warnings.
- Frontend npm run build: passed.
- git diff --check: passed.

Backend tests cover missing authentication, current-password verification, hashing, registration-policy equivalence, same-password rejection, identity isolation, safe errors, concurrent-update conflicts and old/new login behavior. The real database/HTTP test exercises both user roles and JWT continuity. Frontend tests follow the existing Node/Vite SSR approach, exercising validation, request payload, duplicate-submit locking, errors, lifecycle cleanup, controlled form markup and success wiring. They do not constitute a mounted-browser test. Manual browser checks below have not been executed.

## Exact manual browser tests

Start the backend with its usual local development configuration (`cd backend`, `npm run dev`) and frontend (`cd medinear`, `npm run dev`). Use a disposable test account or account whose password you intend to change. Record the initial password privately so you can complete the login checks.

A. Sign in and open My Profile from Home. Owners can use My Profile on the owner dashboard. Scroll to Change Password. Enter the correct current password and a new password satisfying the displayed policy, then repeat it in Confirm New Password. Click Change Password. Expect "Password changed successfully." in a toast, all three fields empty, and the session still signed in. Refresh Profile and verify it still loads.

B. Click Logout. Attempt login using the old password: expect failure. Login using the new password: expect success.

C. Open Profile and enter an incorrect Current Password with a valid matching new/confirm pair. Submit. Expect "Current password is incorrect." inline at Current Password. Logout and verify the password from test A still works.

D. In browser DevTools Network, clear the request list and filter for /users/password. Enter the correct Current Password, New Password = PasswordA1, Confirm New Password = PasswordB1. Submit. Expect "New passwords do not match." inline, with no password-change request. Submit empty fields and a weak new password too; expect inline validation and no request.

E. In DevTools Network enable Slow 3G. Enter valid values using the latest current password and double-click Change Password. Expect only one PATCH request, a disabled button reading Changing Password..., and disabled inputs/show-hide controls until completion. On success fields clear and one success toast appears. Restore normal network speed.

F. Inspect the successful PATCH request locally: its body contains currentPassword and newPassword, with no confirmPassword or user ID, and the Authorization header uses the existing Bearer token. Do not copy or share the credential-bearing request. Verify the response has no password/hash. Try using the current password as the new password; expect the inline different-password message.

G. Toggle Show/Hide for all three fields and check keyboard operation and labels. In offline mode, submit otherwise valid data; expect understandable inline connection feedback and an enabled button after failure. Restore network access. Confirm existing Profile editing, photo upload and photo removal still work. Navigate away during a slow password request; expect no unmounted-component errors (the server may still complete the already submitted change).

No push or deployment was performed.
