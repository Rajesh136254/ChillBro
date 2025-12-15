const mysql = require('mysql2/promise');
require('dotenv').config();

const addBranchManagement = async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n==========================================');
        console.log('BRANCH MANAGEMENT SCHEMA UPDATE');
        console.log('==========================================\n');

        // Helper function to check if table exists
        const tableExists = async (tableName) => {
            const [tables] = await pool.execute(`SHOW TABLES LIKE '${tableName}'`);
            return tables.length > 0;
        };

        // Helper function to check if column exists
        const columnExists = async (tableName, columnName) => {
            const [columns] = await pool.execute(
                `SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`
            );
            return columns.length > 0;
        };

        // Step 1: Create branches table
        console.log('📋 Step 1: Creating branches table...');
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        manager_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        UNIQUE KEY unique_branch_name (company_id, name)
      )
    `);
        console.log('✅ Branches table created successfully\n');

        // List of tables to update
        const tablesToUpdate = [
            'menu_items',
            'tables',
            'orders',
            'ingredients',
            'users'
        ];

        let stepNum = 2;
        for (const tableName of tablesToUpdate) {
            console.log(`📋 Step ${stepNum}: Adding branch_id to ${tableName}...`);

            if (!(await tableExists(tableName))) {
                console.log(`  ⚠️  Table '${tableName}' does not exist, skipping...\n`);
                stepNum++;
                continue;
            }

            // Add column if it doesn't exist
            if (!(await columnExists(tableName, 'branch_id'))) {
                await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN branch_id INT DEFAULT NULL`);
                console.log('  ✓ Added branch_id column');
            } else {
                console.log('  ⚠️  branch_id already exists');
            }

            // Add foreign key constraint
            try {
                await pool.execute(
                    `ALTER TABLE ${tableName} ADD CONSTRAINT fk_${tableName}_branch 
           FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL`
                );
                console.log('  ✓ Added foreign key constraint');
            } catch (e) {
                if (e.code === 'ER_DUP_KEY' || e.code === 'ER_FK_DUP_NAME' || e.code === 'ER_CANT_CREATE_FK') {
                    console.log('  ⚠️  Foreign key already exists or cannot be created');
                } else {
                    console.log(`  ⚠️  Could not add foreign key: ${e.message}`);
                }
            }

            console.log(`✅ ${tableName} updated\n`);
            stepNum++;
        }

        console.log('==========================================');
        console.log('✅ BRANCH MANAGEMENT SCHEMA UPDATE COMPLETE!');
        console.log('==========================================\n');
        console.log('Summary:');
        console.log('✓ branches table created');
        console.log('✓ branch_id added to existing tables');
        console.log('✓ Foreign keys configured\n');
        console.log('Next steps:');
        console.log('1. Backend API endpoints will be added');
        console.log('2. Frontend UI will be implemented');
        console.log('3. Branch filtering will be integrated\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
};

addBranchManagement();
