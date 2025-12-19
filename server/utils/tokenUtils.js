const crypto = require('crypto');

// Generate random token
exports.generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash token for storage
exports.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
