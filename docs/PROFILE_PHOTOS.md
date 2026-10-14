# Customer profile photos

## Storage and schema

The existing `User.profileImage` string field is reused without schema changes or migration.
Only the generated public photo path is stored in that field. Image bytes are stored by the
Express backend, not in User documents, React source, public assets, Vite dist or the frontend
web root. No cloud service or dependency was added.

The default directory is `backend/uploads/profile-photos`, resolved relative to backend code
rather than the process working directory. It is ignored by Git. `PROFILE_PHOTO_DIR` can point
to a dedicated absolute backend storage directory; no .env files were changed. Tests inject
isolated temporary directories and clean up their own files.

## API

- `PUT /api/users/profile/photo`: authenticated customer only. Send the raw image file as the
  request body with `Content-Type: image/jpeg`, `image/png` or `image/webp`. This avoids adding
  a multipart parser. The response includes success, message and the generated profileImage.
- `GET /api/users/profile-photos/:filename`: serves only matching managed raster filenames,
  with MIME inferred from the generated extension and `X-Content-Type-Options: nosniff`.
  There are no directory listings or arbitrary upload-file routes. Photos at these random
  URLs are publicly retrievable; this is not a private/signed-image storage service.
- Existing users/profile and auth/profile responses return profileImage. Login and registration
  responses include it so the existing session context receives the same profile information.
- Customer PUT users/profile continues to update name, phone and address, but rejects direct
  profileImage changes: customers must use the validated upload endpoint. Owner behavior is
  unchanged. There is no user-ID upload parameter.

## Validation and replacement

Authentication and role checks precede image parsing/storage. Files must be non-empty JPEG,
PNG or WebP, no larger than 2 MiB (displayed as 2 MB in the UI). The backend validates MIME
against image signatures and basic format structure; SVG, scripts, unsupported types,
spoofed signatures and oversized bodies are rejected. This is not a full image decoder or
re-encoding service. Compressed upload request bodies are not accepted.

Filenames use the authenticated account ID plus a random UUID and a server-selected raster
extension. Client filenames are never used. File creation is exclusive and uses restrictive
permissions. The User update changes only profileImage atomically and returns the actual prior
photo for cleanup. An unsuccessful database update removes the newly written file. Old-file
cleanup occurs after successful persistence; only exact managed paths with that same customer
ID can be removed. Default assets, other customers' files and unrelated paths are never removed.
Cleanup errors after successful persistence are logged safely; they may leave an old orphan
file for operational cleanup but do not invalidate the new profile photo.

## Existing UI integration

Profile.jsx keeps its existing card, fields, Edit Profile form and initials calculation.
The avatar now shows a circular, object-fit: cover image with initials on missing/failed images.
Customers get Change Photo, image-only file selection, a temporary object-URL preview, Cancel,
and Save Photo. Preview URLs are revoked on replacement/cancel/unmount. Loading guards prevent
duplicate submissions. Upload failures restore the original saved avatar and show inline errors.
Photo upload is disabled while editing personal information, and Edit Profile is disabled while
an upload is in progress. Existing fields and the owner workspace are preserved.

The current profile and auth context are updated after a successful backend response. The
existing local session cache contains only user data/photo path; MongoDB remains authoritative
on profile refresh and login. Managed image paths resolve against the configured API origin,
so separate frontend and backend hosts work.

## Files created

- backend/services/profilePhotos.js
- backend/routes/profilePhotoRoutes.js
- backend/tests/profilePhoto.test.js
- backend/tests/integration/profilePhoto.integration.js
- medinear/src/utils/profilePhoto.js
- medinear/src/components/ProfilePhoto.jsx
- medinear/tests/profilePhoto.test.js
- docs/PROFILE_PHOTOS.md

## Files modified

- .gitignore
- backend/routes/userRoutes.js
- backend/controllers/userController.js
- backend/controllers/authController.js
- medinear/src/auth/AuthProvider.jsx
- medinear/src/pages/Profile.jsx
- medinear/src/styles/Profile.css

## Validation results

- Backend npm test: 35 passed.
- Frontend npm test: 32 passed.
- Backend npm run test:integration: 5 passed, 1 skipped.
- Frontend npm run test:integration: 1 passed.
- Backend/frontend npm run lint: passed.
- Frontend npm run build: passed.
- git diff --check: passed.

The existing restock commit/rollback integration test is skipped on standalone MongoDB because
it requires replica-set transactions. The real standalone Restock Alert integration passed.
The new real MongoDB test verifies upload persistence, profile/auth refresh, personal-info edit,
replacement and a fresh login. New unit/HTTP tests verify image validation, size limits, customer
access, unauthenticated/owner rejection, safe public serving, protected-file deletion boundaries,
database-failure cleanup and preserved personal fields. Frontend tests follow existing utility
and React server-rendering tests, rather than browser file-picker automation.

## Exact manual browser checks (not yet performed)

1. Run npm run dev in backend and medinear. Open the Vite URL and log in as a customer.
2. Open Profile. An account without a photo should still show its name-derived initials.
3. Click Change Photo. Select a JPEG, PNG or WebP smaller than 2 MB. Verify a circular preview
   and the preview notice appear; personal information remains unchanged.
4. Click Cancel. Verify the existing avatar returns and no photo was saved.
5. Select another valid image and click Save Photo. Verify Saving Photo appears, repeated clicks
   are disabled, and success feedback/new photo appear after the server succeeds.
6. Refresh the browser. Verify the saved photo appears. Log out, log back in, and reopen Profile:
   the same photo should appear.
7. Replace it with a different image. Verify the new image appears after refresh. The old managed
   image URL should return 404; the new URL should return the image.
8. Try an SVG/unsupported type (enable all-file selection if the picker hides it), then a photo
   over 2 MB. Verify a useful error and no saved-photo change.
9. Select a valid preview, temporarily stop/disconnect the backend, and click Save Photo. Verify
   an inline failure and the original saved avatar. Restart the backend and retry.
10. Use Edit Profile to change name, phone and address. Verify email remains unchanged, the form
    works as before, and the saved photo remains after saving and refreshing.
11. At mobile width verify the avatar is circular, image is cropped correctly, controls wrap and
    no horizontal overflow occurs. Use keyboard Tab/Enter to operate Change Photo/Save/Cancel.
12. Log in as an owner and verify its existing pharmacy profile/inventory remains unchanged.

## EC2 considerations

Local files live on one EC2 instance; MongoDB Atlas does not back up these image bytes. Frontend
build/deployment must not touch the backend upload directory. For production operations, place
PROFILE_PHOTO_DIR on persistent EBS storage outside versioned/replaced application releases,
ensure the backend service account has read/write access, and back it up together with the
MongoDB photo references. A redeployed/replaced instance needs that volume or restored files;
multiple instances need shared storage. Configure the reverse proxy to forward the photo API
and static path and allow a 2 MB upload body (its limit must not be lower). Avoid serving arbitrary
backend directories. These are deployment considerations only; no EC2 configuration, deployment,
GitHub push or .env changes were performed.

## Remove Profile Photo

Added `DELETE /api/users/profile/photo`, protected by the existing JWT/customer middleware.
It accepts no user ID or photo path. An atomic field-only update clears the authenticated
customer's profileImage and captures its prior database value; the existing storage.remove
helper deletes only that customer's exact managed filename. Missing files are ignored.
Default assets, traversal paths and another account's files are never deleted. If the database
update fails, the photo file is left intact. Unexpected file-cleanup errors after persistence
are logged for operational cleanup, following the existing replacement behavior. The endpoint
returns only safe profile fields with profileImage set to an empty string.

The existing photo controls now show Remove Photo when a photo is stored. Clicking it opens
an inline "Remove profile photo?" confirmation with Cancel and Remove. Cancel sends no
request. Confirmation focuses Cancel; cancellation restores focus to the trigger. Removal
shows "Removing...", locks upload/change/edit conflicts, and updates the existing profile/auth
state only after success. Failure leaves the photo and confirmation available for retry.
The existing initials avatar immediately replaces a successfully removed image.

Files modified for removal only:

- backend/routes/profilePhotoRoutes.js
- medinear/src/utils/profilePhoto.js
- medinear/src/components/ProfilePhoto.jsx
- medinear/src/styles/Profile.css
- backend/tests/profilePhoto.test.js
- backend/tests/integration/profilePhoto.integration.js
- medinear/tests/profilePhoto.test.js
- docs/PROFILE_PHOTOS.md

Removal validation: backend 35 passed; frontend 32 passed; backend integration 5 passed and
1 existing replica-set-only restock test skipped; frontend integration 1 passed; both lint
checks, production build and git diff --check passed. HTTP tests cover missing files, unsafe
paths, unrelated default assets, other accounts, ignored client-supplied IDs/paths, role checks,
database failure and safe response fields. Real MongoDB tests verify removal persistence and
successful re-upload. Existing Change Photo and Edit Profile tests remain passing.

Manual removal browser checks (remain to be performed):

1. Log in as a customer with a saved photo and open Profile. Verify Change Photo and Remove
   Photo are visible. Without a photo, verify initials and no Remove Photo button.
2. Click Remove Photo. Verify "Remove profile photo?", Cancel and Remove. Click Cancel: the
   photo remains and no DELETE request is sent.
3. Click Remove Photo, then Remove. Verify Removing... and disabled actions during the request.
   After success, verify initials, "Profile photo removed.", and no Remove Photo button.
4. Refresh, then log out and log in again. Reopen Profile: initials must remain.
5. Click Change Photo, choose a valid image and Save Photo. Verify the new photo works and
   Remove Photo returns. Edit name/phone/address and verify both edit behavior and photo remain.
6. Stop/disconnect the backend during a removal attempt. Verify an inline failure, the saved
   photo remains, and retry/Cancel work after reconnection.

No schema changes, dependencies, frontend routes, .env changes, push or deployment were added.
