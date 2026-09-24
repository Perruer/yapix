// Loaded with --require before every test file: point the server code at a test config.
const path = require('path');
process.env.YAPIX_CONFIG = process.env.YAPIX_CONFIG || path.join(__dirname, 'fixtures', 'config.json');
