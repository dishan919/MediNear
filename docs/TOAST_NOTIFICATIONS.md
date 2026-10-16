# Toast notifications

Existing architecture: StrictMode mounts App; BrowserRouter wraps AuthProvider and AlertsProvider. AlertsProvider handles persistent restock notifications, not temporary action feedback. No toast system existed. Copy Address and Share already share copyText. Existing action feedback was inline (favorite success was screen-reader-only).

Implementation: ToastProvider sits above auth/alerts and routes. useToast exposes showToast({ message, type }). ToastContainer displays success, error and info with icons, text labels, polite atomic status regions and labelled native dismiss buttons. No animation is used, including with reduced motion. Top-right placement uses viewport width and safe-area spacing; Back to Top is unchanged.

TOAST_DURATION is 3000 ms. At most three notifications remain visible. Each has one timer, cleared on dismissal, eviction, expiry or provider cleanup. Repeated dismissal is harmless. Normal route changes preserve the provider, and notifications expire within three seconds.

Migrated feedback: address copy success/failure; share clipboard success and native-share errors; favorite add/remove success; profile photo update/remove success. Native share success and cancellation stay quiet. Failed share clipboard fallback retains persistent manual-copy instructions and URL. Favorite API errors, photo validation/API failures, profile form validation, authentication, restock, search, location and inventory messages remain inline because users may need them while resolving a problem. No backend, dependency, environment, deployment or push changes.

Created: src/auth/ToastContext.jsx, src/components/ToastProvider.jsx, src/styles/Toast.css, src/utils/toastStore.js, src/utils/toastFeedback.js, tests/toast.test.js (all under medinear), and this document.
Modified: medinear/src/App.jsx and components CopyAddressButton.jsx, SharePharmacyButton.jsx, FavoriteButton.jsx, ProfilePhoto.jsx.

Validation: 77 frontend tests passed; 2 frontend integration tests passed; lint, production build and git diff --check passed. Tests follow the existing Node test + Vite SSR/controlled-view approach. Timer tests use an injected clock; action tests cover utility results, feedback mapping and source wiring. These do not substitute for mounted browser interaction or assistive-technology testing. Manual checks below have not been executed.

## Exact manual browser checks

Start the existing frontend with `cd medinear` then `npm run dev`, with the application's usual backend available. Sign in as a customer.

A. Open a pharmacy from Home. Click Copy Address. Expect ?Address copied.? and disappearance after three seconds. Deny clipboard permission in browser site settings (legacy copying may still succeed); where copying fails expect ?Could not copy address.? The displayed address remains selectable.

B. On pharmacy details click Save Pharmacy. Expect ?Pharmacy saved.? Click Saved to remove it; expect ?Pharmacy removed.? Repeat removal from Saved Pharmacies and verify the toast survives removal of its card. With the backend unavailable, attempt a save; verify the meaningful error remains inline.

C. In a browser without navigator.share (or set navigator.share to undefined using DevTools), click Share. Expect ?Pharmacy link copied.? On a device supporting native sharing, open and cancel the share sheet; expect no toast. When all clipboard methods fail, verify manual-copy instructions and the read-only link remain inline.

D. Open My Profile. Click Change Photo, select a valid JPEG/PNG/WebP under 2 MB, then Save Photo. Expect ?Profile photo updated.? Click Remove Photo, then confirm Remove; expect ?Profile photo removed.? Select an invalid/oversized image and verify its error remains inline. Edit Profile, clear Name and submit; verify ?Name is required.? remains inline.

E. Trigger any toast, tab to Dismiss notification and press Enter or Space. Expect immediate removal; wait beyond three seconds and check for no console warnings.

F. Quickly copy an address and toggle Save Pharmacy. Expect separate readable notifications. Trigger more than three actions; expect at most three notifications and no console errors. Navigate to another route during a toast; expect normal navigation and expiry within three seconds.

G. Set DevTools viewport to 375 x 812. Trigger a toast; verify readable wrapping, usable close button, safe spacing and no horizontal scrolling.

H. Scroll Home until Back to Top appears. Trigger Save Pharmacy on a visible pharmacy card. Verify the top-right toast does not overlap the bottom floating button. Click Back to Top and verify scrolling still works.

I. In DevTools Rendering emulate prefers-reduced-motion: reduce. Trigger and dismiss a toast; expect normal functionality without motion. With a screen reader, verify each message is announced politely once with its type and the close button is named.
