const express = require('express');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/authMiddleware');
const { MAX_PHOTO_BYTES, filenamePattern, validatePhoto, photoStorage } = require('../services/profilePhotos');
const logServerError = require('../utils/logServerError');
function profilePhotoRoutes(storage = photoStorage()) {
  const router = express.Router();
  // Only managed raster filenames are served; no upload-directory listings or arbitrary files.
  router.use('/profile-photos', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !filenamePattern.test(req.path.slice(1))) return res.status(404).json({ success: false, message: 'Photo not found' });
    next();
  }, express.static(storage.directory, { dotfiles: 'deny', index: false, fallthrough: false, maxAge: '1d', setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));
  router.put('/profile/photo', protect, requireRole('customer'), (req, res, next) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.get('Content-Type')?.split(';')[0])) return res.status(415).json({ success: false, message: 'Choose a JPEG, PNG or WebP image.' });
    next();
  }, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PHOTO_BYTES, inflate: false }), async (req, res) => {
    let photo;
    try {
      const extension = validatePhoto(req.body, req.get('Content-Type').split(';')[0]);
      photo = await storage.write(String(req.user._id), req.body, extension);
      // Atomic field-only update preserves personal information and captures the real old photo.
      const previous = await User.findOneAndUpdate({ _id: req.user._id, $or: [{ role: 'customer' }, { role: { $exists: false } }] }, { $set: { profileImage: photo } }, { returnDocument: 'before' }).select('profileImage');
      if (!previous) {
        await storage.remove(photo, String(req.user._id));
        return res.status(404).json({ success: false, message: 'Customer account not found.' });
      }
      try { await storage.remove(previous.profileImage, String(req.user._id)); } catch (error) { logServerError('remove old profile photo', error); }
      return res.json({ success: true, message: 'Profile photo saved.', profileImage: photo });
    } catch (error) {
      if (photo) { try { await storage.remove(photo, String(req.user._id)); } catch (cleanupError) { logServerError('clean up profile photo', cleanupError); } }
      if (!error.status) logServerError('upload profile photo', error);
      return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to save photo. Please try again.' });
    }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status === 413 ? 413 : error.status === 415 ? 415 : error.status === 404 ? 404 : 400;
    res.status(status).json({ success: false, message: status === 413 ? 'Photo must be 2 MB or smaller.' : status === 404 ? 'Photo not found' : 'Invalid photo upload.' });
  });
  return router;
}
module.exports = profilePhotoRoutes;
