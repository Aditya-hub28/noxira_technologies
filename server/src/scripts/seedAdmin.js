const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const db = require('../config/db');

async function seedAdmin(options = {}) {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialPassword || !initialPassword.trim()) {
    console.error('[ERROR] INITIAL_ADMIN_PASSWORD environment variable is required.');
    if (options.doNotExit) {
      throw new Error('INITIAL_ADMIN_PASSWORD_REQUIRED');
    }
    process.exit(1);
  }

  const isExternalConnection = mongoose.connection.readyState === 1;
  if (!isExternalConnection) {
    await db.connectDB();
  }

  const email = (process.env.INITIAL_ADMIN_EMAIL || process.argv[2] || 'admin@noxira.com').toLowerCase().trim();
  const name = process.env.INITIAL_ADMIN_NAME || 'System Administrator';

  const existing = await Admin.findOne({ email });
  if (existing) {
    const isExplicitReset = process.argv.includes('--force-reset') || options.forceReset;
    if (isExplicitReset) {
      existing.passwordHash = await Admin.hashPassword(initialPassword.trim());
      existing.role = 'SUPER_ADMIN';
      existing.isActive = true;
      await existing.save();
      console.log(`✅ Admin password reset successfully for: ${email}`);
    } else {
      console.log(`ℹ️ Admin account already exists: ${email}. No changes made. (Pass --force-reset to update password).`);
    }
  } else {
    const passwordHash = await Admin.hashPassword(initialPassword.trim());
    const newAdmin = new Admin({
      name,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true
    });
    await newAdmin.save();
    console.log(`🎉 Super Admin provisioned successfully: ${email}`);
  }

  if (!isExternalConnection) {
    await db.disconnectDB();
  }
  if (!options.doNotExit) {
    process.exit(0);
  }
}

if (require.main === module) {
  seedAdmin().catch(err => {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedAdmin };
