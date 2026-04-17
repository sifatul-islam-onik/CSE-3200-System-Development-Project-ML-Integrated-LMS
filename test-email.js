const { sendPasswordResetEmail } = require('./server/utils/emailService');
require('dotenv').config({ path: './server/.env' });

async function test() {
  try {
    await sendPasswordResetEmail('test@example.com', 'Test User', '123456');
    console.log('Success');
  } catch (err) {
    console.error('Caught:', err);
  }
}
test();
