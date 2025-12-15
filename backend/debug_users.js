const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: { rejectUnauthorized: false }
        });
        const [rows] = await pool.execute('SELECT id, email, role, company_id FROM users');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
})();
