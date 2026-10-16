const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pelotonhub_payments';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[mongo] connected to ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[mongo] connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
