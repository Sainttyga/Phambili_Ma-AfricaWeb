// seed-admin.js (updated with better env handling)
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { Admin } = require('../models');
const sequelize = require('../config');

async function seedAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');

    // Debug: Check what's actually being read
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

    console.log('🔍 Debug - Environment Variables:');
    console.log('ADMIN_EMAIL:', adminEmail);
    console.log('ADMIN_INITIAL_PASSWORD length:', adminPassword ? adminPassword.length : 'undefined');
    console.log('ADMIN_INITIAL_PASSWORD value:', adminPassword ? '*'.repeat(adminPassword.length) : 'undefined');

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must be set in .env');
    }

    if (adminPassword.length < 8) {
      throw new Error(`ADMIN_INITIAL_PASSWORD must be at least 8 characters long. Current length: ${adminPassword.length}`);
    }

    // Additional password strength check
    const passwordErrors = [];
    if (!/(?=.*[A-Z])/.test(adminPassword)) {
      passwordErrors.push('at least one uppercase letter');
    }
    if (!/(?=.*[a-z])/.test(adminPassword)) {
      passwordErrors.push('at least one lowercase letter');
    }
    if (!/(?=.*\d)/.test(adminPassword)) {
      passwordErrors.push('at least one number');
    }
    if (passwordErrors.length > 0) {
      throw new Error(`ADMIN_INITIAL_PASSWORD must contain: ${passwordErrors.join(', ')}`);
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ 
      where: { 
        Email: adminEmail.toLowerCase().trim() 
      } 
    });
    
    if (existingAdmin) {
      console.log('⚠️  Admin already exists. Skipping creation.');
      console.log('ℹ️  Existing admin email:', existingAdmin.Email);
      return;
    }

    // Create admin with hashed password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const admin = await Admin.create({
      Name: 'System Administrator',
      Email: adminEmail,
      Password: hashedPassword,
      First_Login: true,
      Role: 'main_admin',
      Created_By: null
    });

    console.log('✅ Main admin created successfully!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log('🔐 Password meets security requirements');
    console.log('🚨 SECURITY: Admin will be prompted to change password on first login!');

  } catch (error) {
    console.error('❌ Admin seeding failed:', error.message);
    console.error('💡 Troubleshooting tips:');
    console.error('   - Check if .env file is in the correct directory');
    console.error('   - Ensure .env variables are properly formatted');
    console.error('   - Verify there are no special characters causing issues');
    console.error('   - Check for trailing spaces in the .env file');
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;