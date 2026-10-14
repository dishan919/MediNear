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

- Backend npm test: 34 passed.
- Frontend npm test: 30 passed.
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
