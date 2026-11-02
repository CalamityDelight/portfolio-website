// Cloudinary uploads. Videos are big, so they go straight from Axel's browser
// to Cloudinary instead of through this server. The server's only job is to
// "sign" each upload with the secret key, which never leaves the server.
//
//   browser --(1) may I upload?--> server --(2) signature--> browser
//   browser --(3) file + signature--> Cloudinary --(4) file URL--> browser
const express = require('express');
const cloudinary = require('cloudinary').v2; // reads CLOUDINARY_URL from the environment
const { requireLogin } = require('./auth');

const router = express.Router();
const FOLDER = 'portfolio';

router.get('/api/upload-signature', requireLogin, (req, res) => {
  const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } = cloudinary.config();
  if (!cloudName || !apiKey || !apiSecret || cloudName === 'cloud_name') {
    return res.status(503).json({ error: 'Cloudinary is not set up yet. Add CLOUDINARY_URL to .env.' });
  }

  // The signature covers these exact values, so the browser can't change the folder.
  // Cloudinary rejects signatures older than one hour.
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder: FOLDER }, apiSecret);

  res.json({ cloudName, apiKey, timestamp, signature, folder: FOLDER });
});

module.exports = router;
