// Simple server test without MongoDB
const express = require('express');
require('dotenv').config();

const app = express();

app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`Try: http://localhost:${PORT}/test`);
});
