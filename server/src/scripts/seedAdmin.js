const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { connectDB, disconnectDB } = require('../config/db');

async function seedAdmin() {
  await connectDB();

  const email = process.argv[2] || 'admin@noxira.com';
  const password = process.argv[3] || 'NoxiraAdmin@2026';
  const name = process.argv[4] || 'Aditya Jha';

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`ℹ️ Admin with email ${email} already exists. Updating password...`);
    existing.passwordHash = await Admin.hashPassword(password);
    existing.role = 'SUPER_ADMIN';
    existing.isActive = true;
    await existing.save();
    console.log(`✅ Admin updated successfully: ${email}`);
  } else {
    const passwordHash = await Admin.hashPassword(password);
    const newAdmin = new Admin({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true
    });
    await newAdmin.save();
    console.log(`🎉 Super Admin created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }

  await disconnectDB();
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('❌ Seeder failed:', err);
  process.exit(1);
});
