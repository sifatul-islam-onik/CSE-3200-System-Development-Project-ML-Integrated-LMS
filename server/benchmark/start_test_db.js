// Starts a throwaway in-memory MongoDB for the OCR load test and seeds one teacher account.
// Prints {"ready": true, "uri": ...} on stdout once ready, then keeps running until killed.
// Env: BENCH_MONGO_PORT (default 27027), BENCH_EMAIL, BENCH_PASSWORD.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const port = parseInt(process.env.BENCH_MONGO_PORT || '27027', 10);
  const mongod = await MongoMemoryServer.create({ instance: { port } });
  const uri = mongod.getUri('obesynk_bench');

  await mongoose.connect(uri);
  await User.create({
    name: 'Load Test Teacher',
    email: process.env.BENCH_EMAIL,
    password: process.env.BENCH_PASSWORD,
    role: 'teacher',
    isEmailVerified: true,
    isApprovedByAdmin: true,
    isActive: true
  });
  await mongoose.disconnect();

  // dbPath lets the caller delete the data folder if this process is killed before it can clean up
  console.log(JSON.stringify({ ready: true, uri, dbPath: mongod.instanceInfo && mongod.instanceInfo.dbPath }));

  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
