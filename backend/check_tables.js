
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'restaurant_db',
    port: process.env.DB_PORT || 3306
};

async function checkTables() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute("SHOW COLUMNS FROM users LIKE 'company_id'");
        console.log('company_id column in users table exists:', rows.length > 0);
        await connection.end();
    } catch (error) {
        console.error('Error checking tables:', error.message);
    }
}

checkTables();
