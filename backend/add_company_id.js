
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'restaurant_db',
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // Check if company_id exists in users
        const [columns] = await connection.execute("SHOW COLUMNS FROM users LIKE 'company_id'");
        if (columns.length === 0) {
            console.log('Adding company_id to users table...');
            await connection.execute('ALTER TABLE users ADD COLUMN company_id INT');
            await connection.execute('ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id)');
            console.log('company_id added to users table.');
        } else {
            console.log('company_id already exists in users table.');
        }

        await connection.end();
    } catch (error) {
        console.error('Migration failed:', error.message);
    }
}

migrate();
