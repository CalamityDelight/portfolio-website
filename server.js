// Express server. In Part 1 it only serves the static front end in /public;
// the API routes (posts, comments, login, Kp) are added in Parts 2 and 3.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
