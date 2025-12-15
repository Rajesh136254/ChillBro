const mysql = require('mysql2/promise');
require('dotenv').config();

const updateSchema = async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const connection = await pool.getConnection();
        console.log('Connected to database');

        // 1. Create roles table
        console.log('Creating roles table...');
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        permissions JSON,
        company_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

        // 2. Add phone and role_id to users table
        console.log('Updating users table...');

        // Check if phone column exists
        const [phoneCol] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone' AND TABLE_SCHEMA = DATABASE()
    `);
        if (phoneCol.length === 0) {
            await connection.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
            console.log('Added phone column to users');
        }

        // Check if role_id column exists
        const [roleIdCol] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id' AND TABLE_SCHEMA = DATABASE()
    `);
        if (roleIdCol.length === 0) {
            await connection.execute('ALTER TABLE users ADD COLUMN role_id INT');
            await connection.execute('ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)');
            console.log('Added role_id column to users');
        }

        // 3. Insert default Admin role if not exists for each company (optional, but good for migration)
        // For now, we'll leave it empty or let the user create roles. 
        // But to avoid breaking existing admins, we might want to ensure they have a role.
        // However, existing logic uses 'role' string column. We will keep 'role' column for backward compatibility 
        // or migrate it. The user said "without effecting single existing functionalitiy". 
        // So we will use role_id for the new feature, and fallback to role string if needed, 
        // or just use role_id if present.

        console.log('Schema update complete');
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('Schema update failed:', error);
        process.exit(1);
    }
};

updateSchema();
