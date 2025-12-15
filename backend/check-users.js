const mysql = require('mysql2/promise');
require('dotenv').config();

const checkUser = async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n=== CHECKING USERS IN DATABASE ===\n');

        // Get all non-customer users with their role and company info
        const [users] = await pool.execute(`
      SELECT 
        u.id,
        u.email,
        u.full_name,
        u.role as role_string,
        u.role_id,
        r.name as role_name,
        r.permissions,
        u.company_id,
        c.name as company_name,
        LEFT(u.password_hash, 30) as password_preview,
        u.created_at
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id  
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE u.role != 'customer'
      ORDER BY u.created_at DESC
    `);

        if (users.length === 0) {
            console.log('❌ No admin/staff users found in database!');
            console.log('   Create one via the Admin Panel (Users tab)');
            process.exit(0);
        }

        console.log(`Found ${users.length} admin/staff users:\n`);

        users.forEach((user, index) => {
            console.log(`[${index + 1}] ${user.full_name} (${user.email})`);
            console.log(`    ID: ${user.id}`);
            console.log(`    Role String: ${user.role_string}`);
            console.log(`    Role ID: ${user.role_id || 'NULL (Super Admin)'}`);
            if (user.role_id) {
                console.log(`    Role Name: ${user.role_name}`);
                console.log(`    Permissions: ${user.permissions || 'NULL'}`);
            }
            console.log(`    Company ID: ${user.company_id}`);
            console.log(`    Company Name: ${user.company_name || 'NULL'}`);
            console.log(`    Password Hash: ${user.password_preview}...`);
            console.log(`    Created: ${user.created_at}`);
            console.log('');
        });

        console.log('\n=== TESTING LOGIN CREDENTIALS ===\n');
        console.log('To test login, try these credentials:');
        console.log('');

        users.forEach((user, index) => {
            console.log(`[${index + 1}] Email: ${user.email}`);
            console.log(`    Password: [the password you set when creating this user]`);
            console.log(`    Expected Access: ${user.role_id ? 'Role-based (' + user.role_name + ')' : 'Super Admin (full access)'}`);
            console.log('');
        });

        console.log('\n=== COMMON ISSUES ===\n');
        console.log('If login fails with "Invalid email or password":');
        console.log('1. Double-check the email (no spaces, correct spelling)');
        console.log('2. Use the EXACT password you entered when creating the user');
        console.log('3. Password must match the bcrypt hash in database');
        console.log('');
        console.log('If you forgot the password, run: node backend/reset-password.js');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkUser();
