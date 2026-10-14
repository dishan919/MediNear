const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_PREFIX = '/api/users/profile-photos/';
const filenamePattern = /^[a-f0-9]{24}-[a-f0-9-]{36}\.(jpg|png|webp)$/;
function validatePhoto(buffer, mime) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!extensions[mime]) throw Object.assign(new Error('Choose a JPEG, PNG or WebP image.'), { status: 415 });
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error('An image file is required.'), { status: 400 });
  if (buffer.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('Photo must be 2 MB or smaller.'), { status: 413 });
  let valid = false;
  if (mime === 'image/jpeg' && buffer.length >= 30 && buffer.readUInt16BE(0) === 0xffd8 && buffer.readUInt16BE(buffer.length - 2) === 0xffd9) {
    let offset = 2, frame = false;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset++] !== 255) break;
      while (offset < buffer.length && buffer[offset] === 255) offset++;
      if (offset + 3 > buffer.length) break;
      const marker = buffer[offset++];
      if (marker === 0xda) { valid = frame; break; }
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) frame = length >= 8 && buffer.readUInt16BE(offset + 3) > 0 && buffer.readUInt16BE(offset + 5) > 0;
      offset += length;
    }
  }
  if (mime === 'image/png') valid = buffer.length >= 45 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR' && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0 && buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND';
  if (mime === 'image/webp') valid = buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' && buffer.readUInt32LE(4) + 8 === buffer.length && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16));
  if (valid && mime === 'image/png') {
    let offset = 8, data = false, end = false;
    while (offset + 12 <= buffer.length) {
      const size = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
      if (offset + size + 12 > buffer.length) break;
      if (type === 'IDAT' && size > 0) data = true;
      offset += size + 12;
      if (type === 'IEND') { end = size === 0 && offset === buffer.length; break; }
    }
    valid = data && end;
  }
  if (valid && mime === 'image/webp') {
    const size = buffer.readUInt32LE(16), type = buffer.toString('ascii', 12, 16);
    valid = size <= buffer.length - 20 && size >= (type === 'VP8L' ? 5 : 10);
  }
  if (!valid) throw Object.assign(new Error('The file does not match a supported image format.'), { status: 400 });
  return extensions[mime];
}
function photoStorage(directory = process.env.PROFILE_PHOTO_DIR || path.join(__dirname, '../uploads/profile-photos')) {
  const root = path.resolve(directory);
  return {
    directory: root,
    async write(userId, buffer, extension) {
      const filename = `${userId}-${randomUUID()}.${extension}`;
      if (!filenamePattern.test(filename)) throw new Error('Invalid managed filename');
      await fs.mkdir(root, { recursive: true });
      try { await fs.writeFile(path.join(root, filename), buffer, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') await fs.unlink(path.join(root, filename)).catch(() => {}); throw error; }
      return PHOTO_PREFIX + filename;
    },
    async remove(photo, userId) {
      if (typeof photo !== 'string' || !photo.startsWith(PHOTO_PREFIX)) return;
      const filename = photo.slice(PHOTO_PREFIX.length);
      if (!filenamePattern.test(filename) || !filename.startsWith(`${userId}-`)) return;
      try { await fs.unlink(path.join(root, filename)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    },
  };
}
module.exports = { MAX_PHOTO_BYTES, PHOTO_PREFIX, filenamePattern, validatePhoto, photoStorage };
