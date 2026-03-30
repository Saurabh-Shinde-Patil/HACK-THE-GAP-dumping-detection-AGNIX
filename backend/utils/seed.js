require('dotenv').config();
require('dns').setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cleancity')
  .then(() => console.log('✅ MongoDB connected for seeding'))
  .catch(err => { console.error(err); process.exit(1); });

const User = require('../models/User');
const Report = require('../models/Report');

const seed = async () => {
  try {
    await User.deleteMany({});
    await Report.deleteMany({});

    const users = await User.create([
      { name: 'Super Admin', email: 'superadmin@cleancity.com', password: 'admin123', role: 'superadmin', ward: 'All' },
      { name: 'Ward Admin', email: 'admin@cleancity.com', password: 'admin123', role: 'admin', ward: 'Ward-1' },
      { name: 'Field Worker', email: 'worker@cleancity.com', password: 'admin123', role: 'worker', ward: 'Ward-1' },
      { name: 'Citizen User', email: 'citizen@cleancity.com', password: 'admin123', role: 'citizen' },
    ]);

    console.log('✅ Users seeded:', users.map(u => `${u.role}: ${u.email}`));

    // Sample reports with real Pune coords
    const sampleReports = [
      { image: '/uploads/sample1.jpg', location: { type: 'Point', coordinates: [73.8567, 18.5204] }, address: 'FC Road, Pune', ward: 'Ward-1', severity: 'high', status: 'pending', source: 'citizen', detectionConfidence: 0.88 },
      { image: '/uploads/sample2.jpg', location: { type: 'Point', coordinates: [73.8699, 18.5157] }, address: 'Camp, Pune', ward: 'Ward-2', severity: 'medium', status: 'in-progress', source: 'cctv', detectionConfidence: 0.72 },
      { image: '/uploads/sample3.jpg', location: { type: 'Point', coordinates: [73.8407, 18.5089] }, address: 'Kothrud, Pune', ward: 'Ward-3', severity: 'low', status: 'completed', source: 'citizen', detectionConfidence: 0.55 },
      { image: '/uploads/sample4.jpg', location: { type: 'Point', coordinates: [73.8777, 18.5286] }, address: 'Viman Nagar, Pune', ward: 'Ward-1', severity: 'critical', status: 'pending', source: 'cctv', detectionConfidence: 0.95 },
      { image: '/uploads/sample5.jpg', location: { type: 'Point', coordinates: [73.8545, 18.4983] }, address: 'Hadapsar, Pune', ward: 'Ward-4', severity: 'high', status: 'assigned', source: 'citizen', detectionConfidence: 0.81 },
    ];

    for (const r of sampleReports) {
      r.reporter = users[3]._id;
    }
    await Report.insertMany(sampleReports);
    console.log('✅ Reports seeded:', sampleReports.length);

    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('  superadmin@cleancity.com / admin123  →  Super Admin');
    console.log('  admin@cleancity.com / admin123       →  Ward Admin');
    console.log('  worker@cleancity.com / admin123      →  Field Worker');
    console.log('  citizen@cleancity.com / admin123     →  Citizen User');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
