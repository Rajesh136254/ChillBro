const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const resetPassword = async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n=== PASSWORD RESET UTILITY ===\n');

        // Show available users
        const [users] = await pool.execute(`
      SELECT id, email, full_name, role 
      FROM users 
      WHERE role != 'customer'
      ORDER BY created_at DESC
    `);

        if (users.length === 0) {
            console.log('❌ No admin/staff users found!');
            rl.close();
            process.exit(0);
        }

        console.log('Available users:');
        users.forEach((user, index) => {
            console.log(`  [${index + 1}] ${user.full_name} - ${user.email} (${user.role})`);
        });
        console.log('');

        // Get email from user
        const email = await question('Enter email address to reset: ');

        // Check if user exists
        const [userCheck] = await pool.execute(
            'SELECT id, email, full_name FROM users WHERE email = ?',
            [email.trim()]
        );

        if (userCheck.length === 0) {
            console.log(`❌ User with email "${email}" not found!`);
            rl.close();
            process.exit(1);
        }

        const user = userCheck[0];
        console.log(`\n✅ Found user: ${user.full_name} (${user.email})`);

        // Get new password
        const newPassword = await question('\nEnter new password (min 8 characters): ');

        if (newPassword.length < 8) {
            console.log('❌ Password must be at least 8 characters!');
            rl.close();
            process.exit(1);
        }

        // Confirm
        const confirm = await question(`\nReset password for "${user.email}" to "${newPassword}"? (yes/no): `);

        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
            console.log('❌ Cancelled.');
            rl.close();
            process.exit(0);
        }

        // Hash and update
        console.log('\n⏳ Hashing password...');
        const hash = await bcrypt.hash(newPassword, 10);

        console.log('⏳ Updating database...');
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE email = ?',
            [hash, email.trim()]
        );

        console.log('\n✅ PASSWORD RESET SUCCESSFUL!');
        console.log(`   Email: ${user.email}`);
        console.log(`   New Password: ${newPassword}`);
        console.log(`\nYou can now login with these credentials.`);

        rl.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        rl.close();
        process.exit(1);
    }
};

resetPassword();
