// Test values for settings that normally come from server/.env, so the suites run without one (e.g. in CI).
// dotenv does not override variables that are already set, so these also take precedence over a local .env.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';
