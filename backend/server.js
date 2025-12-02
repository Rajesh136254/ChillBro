const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  getWelcomeEmailTemplate,
  getForgotPasswordTemplate,
  getPasswordResetSuccessTemplate,
  getWelcomeEmailText,
  getForgotPasswordText,
  getPasswordResetSuccessText
} = require('./emailTemplates');

const app = express();
const httpServer = createServer(app);

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://dineflowfrontend.vercel.app',
  'https://dineflowbackend.onrender.com',
  'https://dineflowfrontend-6wmy.vercel.app'
];

// Socket.IO CORS configuration
// Socket.IO CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);

      const localhostRegex = /^http:\/\/[a-zA-Z0-9-]+\.localhost(?::\d+)?$/;
      if (localhostRegex.test(origin)) return callback(null, true);

      const vercelRegex = /^https:\/\/dineflowfrontend.*\.vercel\.app$/;
      if (vercelRegex.test(origin)) return callback(null, true);

      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Enhanced CORS configuration
// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Allow localhost subdomains (e.g. http://tenant.localhost:3000)
    const localhostRegex = /^http:\/\/[a-zA-Z0-9-]+\.localhost(?::\d+)?$/;
    if (localhostRegex.test(origin)) {
      return callback(null, true);
    }

    // Allow vercel preview deployments
    const vercelRegex = /^https:\/\/dineflowfrontend.*\.vercel\.app$/;
    if (vercelRegex.test(origin)) {
      return callback(null, true);
    }

    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Add cache control headers
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Socket.IO connection handling with Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}, Company: ${socket.user.company_id}`);

  // Join company-specific room
  const companyRoom = `company_${socket.user.company_id}`;
  socket.join(companyRoom);
  console.log(`Socket ${socket.id} joined room ${companyRoom}`);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// MySQL connection pool with proper configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Fixed SSL configuration for Aiven
  ssl: {
    rejectUnauthorized: false  // Allow self-signed certificates
  }
});

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('Auth Header:', authHeader ? 'Present' : 'Missing', authHeader);
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Authentication failed: Invalid token', err.message);
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    // console.log('Authentication successful for user:', user.id, 'Company:', user.company_id);
    req.user = user;
    next();
  });
};

// Middleware to resolve company from request (for public routes)
const resolveCompany = async (req, res, next) => {
  try {
    // Try to get slug from header
    let slug = req.headers['x-company-slug'];

    // If not in header, try to extract from Origin/Host (subdomain)
    if (!slug) {
      const host = req.headers.host;
      if (host && host.includes('.')) {
        // Assuming format: slug.domain.com or slug.localhost
        const parts = host.split('.');
        if (parts.length > 1) { // At least slug.localhost
          // Avoid 'www' or 'api' as slugs if possible, or handle them
          if (parts[0] !== 'www' && parts[0] !== 'api') {
            slug = parts[0];
          }
        }
      }
    }

    if (!slug) {
      // Fallback for development/testing if no slug found
      console.log('No company slug found, proceeding without company context (legacy mode)');
      return next();
    }

    const [companies] = await pool.execute(
      'SELECT id, name, slug FROM companies WHERE slug = ?',
      [slug]
    );

    if (companies.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    req.company = companies[0];
    next();
  } catch (error) {
    console.error('Error resolving company:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Test database connection
const testDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    console.log('Connection details:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    return false;
  }
};

// Update database schema for new features
// Update database schema for new features
const updateDatabaseSchema = async () => {
  try {
    const connection = await pool.getConnection();

    // Helper to add column if not exists
    const addColumnIfNotExists = async (tableName, columnName, columnDef) => {
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = ? 
        AND COLUMN_NAME = ?
        AND TABLE_SCHEMA = DATABASE()
      `, [tableName, columnName]);

      if (columns.length === 0) {
        console.log(`Adding ${columnName} column to ${tableName}...`);
        await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      }
    };

    // Menu Items columns
    await addColumnIfNotExists('menu_items', 'nutritional_info', 'TEXT');
    await addColumnIfNotExists('menu_items', 'vitamins', 'TEXT');

    // Multitenancy columns
    await addColumnIfNotExists('restaurant_tables', 'company_id', 'INT');
    await addColumnIfNotExists('table_groups', 'company_id', 'INT');
    await addColumnIfNotExists('orders', 'company_id', 'INT');
    await addColumnIfNotExists('ingredients', 'company_id', 'INT');
    await addColumnIfNotExists('menu_items', 'company_id', 'INT');
    await addColumnIfNotExists('order_items', 'company_id', 'INT');
    await addColumnIfNotExists('staff', 'company_id', 'INT');
    await addColumnIfNotExists('recipe_items', 'company_id', 'INT');
    await addColumnIfNotExists('waste_log', 'company_id', 'INT');

    connection.release();
    console.log('Schema check completed');
  } catch (error) {
    console.error('Schema update failed:', error);
  }
};

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await pool.execute('SELECT 1');
    await updateDatabaseSchema(); // Ensure schema is up to date
    res.json({
      status: 'ok',
      message: 'Restaurant QR Ordering System API',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// AI Nutrition Endpoint
app.post('/api/ai/nutrition', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured'
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Generate nutritional information for a menu item with Name: '${name}' and Description: '${description}'. 
    Return ONLY a valid JSON object with exactly two keys: 
    - nutritional_info: A short string summarizing calories, protein, etc. (e.g., "300 kcal, 10g Protein")
    - vitamins: A comma-separated string of vitamins (e.g., "Vitamin A, Vitamin C")
    Do not include any markdown formatting or code blocks. Just the raw JSON string.`;

    console.log(`Generating content for: ${name} using model gemini-2.0-flash`);
    const result = await model.generateContent(prompt);
    console.log('Generation complete, getting response text...');
    const response = await result.response;
    const text = response.text();
    console.log('AI Response:', text);

    // Clean up the text if it contains markdown code blocks
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(cleanText);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('AI Generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate nutritional info',
      error: error.message
    });
  }
});

// Menu endpoints with enhanced error handling
app.get('/api/menu', resolveCompany, async (req, res) => {
  try {
    console.log('Fetching menu items...');
    let companyId = req.company ? req.company.id : null;

    // Check for admin token if no company resolved from slug
    if (!companyId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          companyId = decoded.company_id;
        } catch (e) { }
      }
    }

    let query = 'SELECT * FROM menu_items';
    let params = [];

    if (companyId) {
      query += ' WHERE company_id = ?';
      params.push(companyId);
    } else {
      console.log('No company context for menu fetch, returning empty list');
      return res.json({ success: true, data: [] });
    }

    query += ' ORDER BY category, name';

    console.log('Executing menu query:', query, params);
    const [rows] = await pool.execute(query, params);
    console.log(`Found ${rows.length} menu items for company ${companyId}`);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu',
      error: error.message
    });
  }
});

app.get('/api/menu/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu item',
      error: error.message
    });
  }
});

app.post('/api/menu', authenticateToken, async (req, res) => {
  try {
    const { name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins } = req.body;
    const { company_id } = req.user;
    console.log(`Creating menu item for company_id: ${company_id}`);

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company context missing. Please relogin.' });
    }

    // Validate category - prevent empty or 'add-new' categories
    if (!category || category.trim() === '' || category.toLowerCase() === 'add-new') {
      return res.status(400).json({ success: false, message: 'Please select a valid category' });
    }

    const [result] = await pool.execute(
      'INSERT INTO menu_items (name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, price_inr, price_usd, category.trim(), image_url || null, is_available !== false, nutritional_info || null, vitamins || null, company_id]
    );

    const [newItem] = await pool.execute('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newItem[0] });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create menu item',
      error: error.message
    });
  }
});

app.put('/api/menu/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins } = req.body;
    const { company_id } = req.user;

    // Verify ownership
    const [existing] = await pool.execute('SELECT id FROM menu_items WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found or access denied' });
    }

    // Validate category - prevent empty or 'add-new' categories
    if (!category || category.trim() === '' || category.toLowerCase() === 'add-new') {
      return res.status(400).json({ success: false, message: 'Please select a valid category' });
    }

    const [result] = await pool.execute(
      'UPDATE menu_items SET name = ?, description = ?, price_inr = ?, price_usd = ?, category = ?, image_url = ?, is_available = ?, nutritional_info = ?, vitamins = ? WHERE id = ? AND company_id = ?',
      [name, description, price_inr, price_usd, category.trim(), image_url, is_available, nutritional_info || null, vitamins || null, req.params.id, company_id]
    );

    const [updatedItem] = await pool.execute('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedItem[0] });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update menu item',
      error: error.message
    });
  }
});

app.delete('/api/menu/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    // Verify ownership
    const [existing] = await pool.execute('SELECT id FROM menu_items WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found or access denied' });
    }

    // First check if this menu item is referenced in any orders
    const [orderItems] = await pool.execute(
      'SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?',
      [req.params.id]
    );

    if (orderItems[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete menu item that has been used in orders'
      });
    }

    // If not referenced, proceed with deletion
    const [result] = await pool.execute(
      'DELETE FROM menu_items WHERE id = ? AND company_id = ?',
      [req.params.id, company_id]
    );

    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item',
      error: error.message
    });
  }
});

// Table endpoints with enhanced error handling
// Table endpoints with enhanced error handling (updated to include group_id optionally)
app.get('/api/tables', authenticateToken, async (req, res) => {
  try {
    let { company_id } = req.user;

    // Fallback: Try to get company_id from token if not in req.user
    if (!company_id) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          company_id = decoded.company_id;
        } catch (e) { }
      }
    }

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company context required' });
    }

    console.log('Fetching tables for company:', company_id);
    try {
      const [rows] = await pool.execute(
        'SELECT rt.*, COALESCE(tg.name, "Non AC") as group_name FROM restaurant_tables rt LEFT JOIN table_groups tg ON rt.group_id = tg.id WHERE rt.company_id = ? AND rt.is_active = true ORDER BY rt.table_number',
        [company_id]
      );
      console.log(`Found ${rows.length} tables for company ${company_id}`);
      res.json({ success: true, data: rows });
    } catch (innerError) {
      // Fallback
      const [rows] = await pool.execute(
        "SELECT *, 'Non AC' as group_name FROM restaurant_tables WHERE company_id = ? ORDER BY table_number",
        [company_id]
      );
      res.json({ success: true, data: rows });
    }
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tables',
      error: error.message
    });
  }
});

// POST endpoint to create a new table
app.post('/api/tables', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { table_number, table_name, group_id } = req.body;
    const { company_id } = req.user;

    // 1. Validate required fields
    if (!table_number) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Table number is required.'
      });
    }

    // 2. Check if table number already exists for this company
    const [existingTable] = await connection.execute(
      'SELECT id FROM restaurant_tables WHERE table_number = ? AND company_id = ?',
      [table_number, company_id]
    );

    if (existingTable.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Table number ${table_number} already exists. Please choose a different number.`
      });
    }

    // 3. Proceed with insertion
    const qr_code_data = `table-${table_number}`;

    // Check if group_id column exists
    const [columnCheck] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'restaurant_tables' 
      AND COLUMN_NAME = 'group_id'
      AND TABLE_SCHEMA = DATABASE()
    `);

    let query, values;

    if (columnCheck.length > 0) {
      query = 'INSERT INTO restaurant_tables (table_number, table_name, qr_code_data, group_id, company_id) VALUES (?, ?, ?, ?, ?)';
      values = [table_number, table_name || `Table ${table_number}`, qr_code_data, group_id || null, company_id];
    } else {
      query = 'INSERT INTO restaurant_tables (table_number, table_name, qr_code_data, company_id) VALUES (?, ?, ?, ?)';
      values = [table_number, table_name || `Table ${table_number}`, qr_code_data, company_id];
    }

    const [result] = await connection.execute(query, values);
    await connection.commit();

    // Get the newly created table
    let getQuery;
    if (columnCheck.length > 0) {
      getQuery = `SELECT rt.*, COALESCE(tg.name, "Non AC") as group_name FROM restaurant_tables rt LEFT JOIN table_groups tg ON rt.group_id = tg.id WHERE rt.id = ?`;
    } else {
      getQuery = 'SELECT *, "Non AC" as group_name FROM restaurant_tables WHERE id = ?';
    }

    const [newTable] = await pool.execute(getQuery, [result.insertId]);

    res.json({ success: true, data: newTable[0] });

  } catch (error) {
    await connection.rollback();
    console.error('Error creating table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create table',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

app.put('/api/tables/:id', authenticateToken, async (req, res) => {
  try {
    const { table_number, table_name, group_id } = req.body;
    const { company_id } = req.user;

    const qr_code_data = `table-${table_number}`;
    let query = 'UPDATE restaurant_tables SET table_number = ?, table_name = ?, qr_code_data = ?';
    let values = [table_number, table_name || null, qr_code_data, req.params.id, company_id];

    // Conditionally add group_id update if provided
    if (group_id !== undefined) {
      query += ', group_id = ?';
      values.splice(3, 0, group_id || null); // Insert before id
    }

    query += ' WHERE id = ? AND company_id = ?';

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Table not found or access denied' });
    }

    const [updatedTable] = await pool.execute(
      'SELECT rt.*, COALESCE(tg.name, "Non AC") as group_name FROM restaurant_tables rt LEFT JOIN table_groups tg ON rt.group_id = tg.id WHERE rt.id = ?',
      [req.params.id]
    );
    res.json({ success: true, data: updatedTable[0] });
  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update table',
      error: error.message
    });
  }
});

app.delete('/api/tables/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [result] = await pool.execute(
      'DELETE FROM restaurant_tables WHERE id = ? AND company_id = ?',
      [req.params.id, company_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Table not found or access denied' });
    }
    res.json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete table',
      error: error.message
    });
  }
});

// Table Groups endpoints
app.get('/api/table-groups', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT * FROM table_groups WHERE company_id = ? ORDER BY name', [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching table groups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch table groups', error: error.message });
  }
});

app.post('/api/table-groups', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const { company_id } = req.user;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const trimmedName = name.trim();
    const [existing] = await pool.execute('SELECT id FROM table_groups WHERE name = ? AND company_id = ?', [trimmedName, company_id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Group already exists' });
    }
    const [result] = await pool.execute('INSERT INTO table_groups (name, company_id) VALUES (?, ?)', [trimmedName, company_id]);
    const [newGroup] = await pool.execute('SELECT * FROM table_groups WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newGroup[0] });
  } catch (error) {
    console.error('Error creating table group:', error);
    res.status(500).json({ success: false, message: 'Failed to create table group', error: error.message });
  }
});

app.put('/api/table-groups/:id', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const { company_id } = req.user;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const [result] = await pool.execute('UPDATE table_groups SET name = ? WHERE id = ? AND company_id = ?', [name.trim(), req.params.id, company_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Group not found or access denied' });
    }
    const [updatedGroup] = await pool.execute('SELECT * FROM table_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updatedGroup[0] });
  } catch (error) {
    console.error('Error updating table group:', error);
    res.status(500).json({ success: false, message: 'Failed to update table group', error: error.message });
  }
});

app.delete('/api/table-groups/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    // Check if used in tables
    const [tablesUsing] = await pool.execute('SELECT COUNT(*) as count FROM restaurant_tables WHERE group_id = ? AND company_id = ?', [req.params.id, company_id]);
    if (tablesUsing[0].count > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete group used by ${tablesUsing[0].count} tables` });
    }
    const [result] = await pool.execute('DELETE FROM table_groups WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Group not found or access denied' });
    }
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting table group:', error);
    res.status(500).json({ success: false, message: 'Failed to delete table group', error: error.message });
  }
});

// Category endpoints with enhanced error handling
app.get('/api/categories', resolveCompany, async (req, res) => {
  try {
    console.log('Fetching categories...');
    let companyId = req.company ? req.company.id : null;

    // Check for admin token if no company resolved from slug
    if (!companyId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          companyId = decoded.company_id;
        } catch (e) { }
      }
    }

    let query = 'SELECT DISTINCT category FROM menu_items';
    let params = [];

    if (companyId) {
      query += ' WHERE company_id = ?';
      params.push(companyId);
    } else {
      console.log('No company context for categories fetch, returning empty list');
      return res.json({ success: true, data: [] });
    }

    query += ' ORDER BY category';

    const [rows] = await pool.execute(query, params);

    // Extract and filter category names - exclude empty, null, and 'add-new'
    const categories = rows
      .map(row => row.category)
      .filter(cat => cat && cat.trim() !== '' && cat.toLowerCase() !== 'add-new');

    console.log(`Found ${categories.length} valid categories`);

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const { company_id } = req.user;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const trimmedName = name.trim();

    // Check if category already exists in menu_items for this company
    const [existingCategory] = await pool.execute(
      'SELECT category FROM menu_items WHERE category = ? AND company_id = ? LIMIT 1',
      [trimmedName, company_id]
    );

    if (existingCategory.length > 0) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    // No need to create placeholder - category will exist when menu items use it
    res.json({
      success: true,
      message: 'Category created successfully',
      data: { name: trimmedName }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

app.delete('/api/categories/:name', authenticateToken, async (req, res) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    const { company_id } = req.user;

    // Check if any menu items are using this category (excluding placeholder)
    const [itemsInCategory] = await pool.execute(
      'SELECT COUNT(*) as count FROM menu_items WHERE category = ? AND name != "[Category Placeholder]" AND company_id = ?',
      [categoryName, company_id]
    );

    if (itemsInCategory[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${itemsInCategory[0].count} item(s) are using this category.`
      });
    }

    // Delete the placeholder menu item for this category
    await pool.execute(
      'DELETE FROM menu_items WHERE category = ? AND name = "[Category Placeholder]" AND company_id = ?',
      [categoryName, company_id]
    );

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

// Order endpoints
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { status, start_date, end_date, table_number, customer_id } = req.query;
    const { company_id } = req.user;

    // First, get the orders based on filters
    let query = 'SELECT * FROM orders WHERE company_id = ?';
    const params = [company_id];
    const conditions = [];

    if (status) {
      conditions.push('order_status = ?');
      params.push(status);
    }

    if (table_number) {
      conditions.push('table_number = ?');
      params.push(table_number);
    }

    if (customer_id) {
      conditions.push('customer_id = ?');
      params.push(customer_id);
    }

    if (start_date) {
      conditions.push('created_at >= ?');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('created_at <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const [orders] = await pool.execute(query, params);

    // Now, get the items for each order
    const processedOrders = await Promise.all(
      orders.map(async (order) => {
        const [items] = await pool.execute(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );

        return {
          ...order,
          items: items
        };
      })
    );

    res.json({ success: true, data: processedOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Add more logging to the order creation endpoint
// Add more logging to the order creation endpoint
app.post('/api/orders', resolveCompany, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { table_number, items, currency, payment_method, customer_id } = req.body;
    let companyId = req.company ? req.company.id : null;

    // Fallback: Try to get company_id from token if not resolved from slug
    if (!companyId) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          companyId = decoded.company_id;
        } catch (e) {
          console.log('Token verification failed in order creation:', e.message);
        }
      }
    }

    if (!companyId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Company context required to create order'
      });
    }

    // Validate input
    if (!table_number || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Table number and items are required'
      });
    }

    const [tableRows] = await connection.execute(
      'SELECT id FROM restaurant_tables WHERE table_number = ? AND company_id = ?',
      [table_number, companyId]
    );

    if (tableRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const table_id = tableRows[0].id;

    let total_inr = 0;
    let total_usd = 0;

    for (const item of items) {
      total_inr += parseFloat(item.price_inr) * item.quantity;
      total_usd += parseFloat(item.price_usd) * item.quantity;
    }

    // Check if company_id column exists in orders
    const [columnCheck] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'company_id'
      AND TABLE_SCHEMA = DATABASE()
    `);

    let insertQuery, insertValues;

    if (columnCheck.length > 0) {
      insertQuery = 'INSERT INTO orders (table_id, table_number, customer_id, total_amount_inr, total_amount_usd, currency, payment_method, order_status, payment_status, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      insertValues = [table_id, table_number, customer_id || null, total_inr.toFixed(2), total_usd.toFixed(2), currency, payment_method, 'pending', payment_method === 'cash' ? 'pending' : 'paid', companyId];
    } else {
      insertQuery = 'INSERT INTO orders (table_id, table_number, customer_id, total_amount_inr, total_amount_usd, currency, payment_method, order_status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
      insertValues = [table_id, table_number, customer_id || null, total_inr.toFixed(2), total_usd.toFixed(2), currency, payment_method, 'pending', payment_method === 'cash' ? 'pending' : 'paid'];
    }

    const [orderResult] = await connection.execute(insertQuery, insertValues);

    const order_id = orderResult.insertId;

    for (const item of items) {
      await connection.execute(
        'INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price_inr, price_usd) VALUES (?, ?, ?, ?, ?, ?)',
        [order_id, item.id, item.name, item.quantity, item.price_inr, item.price_usd]
      );
    }

    const [itemsRows] = await connection.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order_id]
    );

    await connection.commit();

    const [orderRows] = await connection.execute('SELECT * FROM orders WHERE id = ?', [order_id]);
    const orderData = {
      ...orderRows[0],
      items: itemsRows
    };

    // Emit socket event for real-time updates
    // Emit to company-specific room
    io.to(`company_${companyId}`).emit('new-order', orderData);

    res.json({ success: true, data: orderData });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { order_status } = req.body;
    const { company_id } = req.user;

    const [result] = await pool.execute(
      'UPDATE orders SET order_status = ? WHERE id = ? AND company_id = ?',
      [order_status, req.params.id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    const [updatedOrder] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    io.to(`company_${company_id}`).emit('order-status-updated', updatedOrder[0]);

    res.json({ success: true, data: updatedOrder[0] });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Analytics endpoints
// Analytics endpoints
app.get('/api/analytics/daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const { company_id } = req.user;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [summaryRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount_inr) as total_revenue_inr,
        SUM(total_amount_usd) as total_revenue_usd,
        COUNT(DISTINCT table_number) as tables_served
      FROM orders
      WHERE DATE(created_at) = ? AND company_id = ?
    `, [targetDate, company_id]);

    const [itemsRows] = await pool.execute(`
      SELECT 
        oi.item_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.price_inr * oi.quantity) as revenue_inr,
        SUM(oi.price_usd * oi.quantity) as revenue_usd
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = ? AND o.company_id = ?
      GROUP BY oi.item_name
      ORDER BY quantity_sold DESC
    `, [targetDate, company_id]);

    res.json({
      success: true,
      data: {
        summary: summaryRows[0],
        items: itemsRows,
        date: targetDate
      }
    });
  } catch (error) {
    console.error('Error fetching daily analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

app.get('/api/analytics/monthly', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { company_id } = req.user;
    const targetMonth = month || (new Date().getMonth() + 1);
    const targetYear = year || new Date().getFullYear();

    const [summaryRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount_inr) as total_revenue_inr,
        SUM(total_amount_usd) as total_revenue_usd,
        COUNT(DISTINCT table_number) as tables_served
      FROM orders
      WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? AND company_id = ?
    `, [targetMonth, targetYear, company_id]);

    const [itemsRows] = await pool.execute(`
      SELECT 
        oi.item_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.price_inr * oi.quantity) as revenue_inr,
        SUM(oi.price_usd * oi.quantity) as revenue_usd
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE MONTH(o.created_at) = ? AND YEAR(o.created_at) = ? AND o.company_id = ?
      GROUP BY oi.item_name
      ORDER BY quantity_sold DESC
    `, [targetMonth, targetYear, company_id]);

    const [dailyRows] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total_amount_inr) as revenue_inr,
        SUM(total_amount_usd) as revenue_usd
      FROM orders
      WHERE MONTH(created_at) = ? AND YEAR(created_at) = ? AND company_id = ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [targetMonth, targetYear, company_id]);

    res.json({
      success: true,
      data: {
        summary: summaryRows[0],
        items: itemsRows,
        daily: dailyRows,
        month: targetMonth,
        year: targetYear
      }
    });
  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

app.get('/api/analytics/quarterly', authenticateToken, async (req, res) => {
  try {
    const { quarter, year } = req.query;
    const { company_id } = req.user;
    const targetQuarter = quarter || Math.ceil((new Date().getMonth() + 1) / 3);
    const targetYear = year || new Date().getFullYear();

    const startMonth = (targetQuarter - 1) * 3 + 1;
    const endMonth = targetQuarter * 3;

    const [summaryRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount_inr) as total_revenue_inr,
        SUM(total_amount_usd) as total_revenue_usd,
        COUNT(DISTINCT table_number) as tables_served
      FROM orders
      WHERE MONTH(created_at) BETWEEN ? AND ? 
        AND YEAR(created_at) = ? AND company_id = ?
    `, [startMonth, endMonth, targetYear, company_id]);

    const [itemsRows] = await pool.execute(`
      SELECT 
        oi.item_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.price_inr * oi.quantity) as revenue_inr,
        SUM(oi.price_usd * oi.quantity) as revenue_usd
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE MONTH(o.created_at) BETWEEN ? AND ? 
        AND YEAR(o.created_at) = ? AND o.company_id = ?
      GROUP BY oi.item_name
      ORDER BY quantity_sold DESC
    `, [startMonth, endMonth, targetYear, company_id]);

    res.json({
      success: true,
      data: {
        summary: summaryRows[0],
        items: itemsRows,
        quarter: targetQuarter,
        year: targetYear
      }
    });
  } catch (error) {
    console.error('Error fetching quarterly analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

app.get('/api/analytics/yearly', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const { company_id } = req.user;
    const targetYear = year || new Date().getFullYear();

    const [summaryRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount_inr) as total_revenue_inr,
        SUM(total_amount_usd) as total_revenue_usd,
        COUNT(DISTINCT table_number) as tables_served
      FROM orders
      WHERE YEAR(created_at) = ? AND company_id = ?
    `, [targetYear, company_id]);

    const [itemsRows] = await pool.execute(`
      SELECT 
        oi.item_name,
        SUM(oi.quantity) as quantity_sold,
        SUM(oi.price_inr * oi.quantity) as revenue_inr,
        SUM(oi.price_usd * oi.quantity) as revenue_usd
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE YEAR(o.created_at) = ? AND o.company_id = ?
      GROUP BY oi.item_name
      ORDER BY quantity_sold DESC
    `, [targetYear, company_id]);

    const [monthlyRows] = await pool.execute(`
      SELECT 
        MONTH(created_at) as month,
        COUNT(*) as orders,
        SUM(total_amount_inr) as revenue_inr,
        SUM(total_amount_usd) as revenue_usd
      FROM orders
      WHERE YEAR(created_at) = ? AND company_id = ?
      GROUP BY MONTH(created_at)
      ORDER BY month
    `, [targetYear, company_id]);

    res.json({
      success: true,
      data: {
        summary: summaryRows[0],
        items: itemsRows,
        monthly: monthlyRows,
        year: targetYear
      }
    });
  } catch (error) {
    console.error('Error fetching yearly analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});
// Test endpoint for revenue/orders data
app.get('/api/analytics/test-revenue-orders', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Get a simple count of orders in the date range
    const [orderCount] = await pool.execute(`
            SELECT COUNT(*) as count
            FROM orders
            WHERE created_at >= ? AND created_at < ? AND company_id = ?
        `, [startDate, endDate, company_id]);

    res.json({
      success: true,
      message: 'Test endpoint for revenue/orders data',
      period,
      currency,
      startDate,
      endDate,
      orderCount: orderCount[0].count
    });
  } catch (error) {
    console.error('Error in test revenue/orders endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint failed',
      error: error.message
    });
  }
});

// Analytics page endpoints
app.get('/api/analytics/test', (req, res) => {
  res.json({ success: true, message: 'Analytics API is working' });
});

// Helper function to get date range based on period
// Helper function to get date range based on period
const getDateRangeForPeriod = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'daily':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 28); // Last 4 weeks
      endDate = new Date(now);
      break;
    case 'monthly':
      // TEMPORARY CHANGE: Look back 2 years for testing
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 2); // Look back 2 years
      endDate = new Date(now);
      break;
    case 'yearly':
      // TEMPORARY CHANGE: Look back 5 years for testing
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 5); // Look back 5 years
      endDate = new Date(now);
      break;
    default:
      // Default to last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
  }

  console.log(`Date range for period ${period}: ${startDate} to ${endDate}`);
  return { startDate, endDate };
};

// Helper function to get previous period date range
const getPreviousPeriodDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Get the start of the current week
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);

      // Previous week is 7 days before that
      startDate = new Date(currentWeekStart);
      startDate.setDate(currentWeekStart.getDate() - 7);

      endDate = new Date(currentWeekStart);
      endDate.setDate(currentWeekStart.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// Get summary analytics - UPDATED
// Get summary analytics - UPDATED
app.get('/api/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Total orders
    const [totalOrdersResult] = await pool.execute(`
      SELECT COUNT(*) as total_orders
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
    `, [startDate, endDate, company_id]);
    const totalOrders = totalOrdersResult[0].total_orders;

    // Total revenue - use different queries based on currency
    let totalRevenue;
    if (currency === 'INR') {
      const [totalRevenueResult] = await pool.execute(`
        SELECT SUM(total_amount_inr) as total_revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
      totalRevenue = totalRevenueResult[0].total_revenue || 0;
    } else {
      const [totalRevenueResult] = await pool.execute(`
        SELECT SUM(total_amount_usd) as total_revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
      totalRevenue = totalRevenueResult[0].total_revenue || 0;
    }

    // Tables served
    const [tablesServedResult] = await pool.execute(`
      SELECT COUNT(DISTINCT table_id) as tables_served
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
    `, [startDate, endDate, company_id]);
    const tablesServed = tablesServedResult[0].tables_served || 0;

    // Average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Customers
    const [customersResult] = await pool.execute(`
      SELECT COUNT(DISTINCT customer_id) as total_customers
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
    `, [startDate, endDate, company_id]);
    const totalCustomers = customersResult[0].total_customers || 0;

    // Average items per order
    const [avgItemsResult] = await pool.execute(`
      SELECT AVG(item_count) as avg_items_per_order
      FROM (
        SELECT o.id, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
        GROUP BY o.id
      ) as order_items_count
    `, [startDate, endDate, company_id]);
    const avgItemsPerOrder = avgItemsResult[0].avg_items_per_order || 0;

    res.json({
      success: true,
      data: {
        total_orders: totalOrders,
        [`total_revenue_${currency.toLowerCase()}`]: totalRevenue,
        tables_served: tablesServed,
        avg_order_value: avgOrderValue,
        total_customers: totalCustomers,
        avg_items_per_order: avgItemsPerOrder
      }
    });
  } catch (error) {
    console.error('Error fetching summary analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary analytics',
      error: error.message
    });
  }
});

// Get revenue and orders over time
// Get revenue and orders over time
app.get('/api/analytics/revenue-orders', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    let groupBy, dateFormat;
    switch (period) {
      case 'daily':
        groupBy = 'DATE(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        groupBy = 'YEARWEEK(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'monthly':
        groupBy = 'YEAR(created_at), MONTH(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'yearly':
        groupBy = 'YEAR(created_at)';
        dateFormat = '%Y-%m-%d';
        break;
      default:
        groupBy = 'DATE(created_at)';
        dateFormat = '%Y-%m-%d';
    }

    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    const [results] = await pool.execute(`
      SELECT 
        ${groupBy} as date_group,
      DATE_FORMAT(MIN(created_at), '${dateFormat}') as date,
      COUNT(*) as orders,
      COALESCE(SUM(${revenueColumn}), 0) as revenue,
      COUNT(DISTINCT table_id) as tables_used,
      COALESCE(AVG(${revenueColumn}), 0) as avg_order_value
      FROM orders 
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY ${groupBy}
      ORDER BY date_group
      `, [startDate, endDate, company_id]);

    // Format the data for the chart
    const formattedData = results.map(row => ({
      date: row.date,
      orders: row.orders,
      revenue: row.revenue,
      tables_used: row.tables_used,
      avg_order_value: row.avg_order_value,
      [`revenue_${currency.toLowerCase()}`]: row.revenue,
      [`avg_order_value_${currency.toLowerCase()}`]: row.avg_order_value
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching revenue/orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue/orders',
      error: error.message
    });
  }
});

// Get top items - UPDATED
app.get('/api/analytics/top-items', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'oi.price_inr' : 'oi.price_usd';

    const [results] = await pool.execute(`
      SELECT 
        mi.id,
      mi.name as item_name,
      mi.category,
      SUM(oi.quantity) as quantity_sold,
      COALESCE(SUM(oi.quantity * ${revenueColumn}), 0) as revenue,
      COUNT(DISTINCT oi.order_id) as order_count,
      COALESCE(AVG(oi.quantity), 0) as avg_quantity_per_order
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
      GROUP BY mi.id, mi.name, mi.category
      ORDER BY quantity_sold DESC
      LIMIT 10
      `, [startDate, endDate, company_id]);

    // Format the data for the chart
    const formattedData = results.map(row => ({
      ...row,
      [`revenue_${currency.toLowerCase()}`]: row.revenue
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching top items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top items',
      error: error.message
    });
  }
});

// Get category performance
app.get('/api/analytics/category-performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'oi.price_inr' : 'oi.price_usd';

    const [results] = await pool.execute(`
      SELECT 
        mi.category,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(oi.quantity) as total_items,
      COALESCE(SUM(oi.quantity * ${revenueColumn}), 0) as total_revenue,
      COALESCE(AVG(oi.quantity * ${revenueColumn}), 0) as avg_item_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
      GROUP BY mi.category
      ORDER BY total_revenue DESC
      `, [startDate, endDate, company_id]);

    // Format the data for the chart
    const formattedData = results.map(row => ({
      ...row,
      [`total_revenue_${currency.toLowerCase()}`]: row.total_revenue,
      [`avg_item_revenue_${currency.toLowerCase()}`]: row.avg_item_revenue
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching category performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category performance',
      error: error.message
    });
  }
});

app.get('/api/analytics/customer-retention', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Get customer retention data
    const [retentionData] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
      COUNT(*) as total_customers,
      SUM(CASE WHEN order_count > 1 THEN 1 ELSE 0 END) as returning_customers,
      SUM(CASE WHEN order_count = 1 THEN 1 ELSE 0 END) as new_customers
      FROM(
        SELECT 
          o.customer_id,
        DATE(o.created_at) as created_at,
        COUNT(*) as order_count
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
        GROUP BY o.customer_id, DATE(o.created_at)
      ) as customer_data
      GROUP BY DATE(created_at)
      ORDER BY date
      `, [startDate, endDate, company_id]);

    // Calculate overall retention rate
    const [retentionRate] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT CASE WHEN order_count > 1 THEN customer_id END) as returning_customers,
      COUNT(DISTINCT customer_id) as total_customers
      FROM(
        SELECT 
          customer_id,
        COUNT(*) as order_count
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?
        GROUP BY customer_id
      ) as customer_data
    `, [startDate, endDate, company_id]);

    const rate = retentionRate[0].total_customers > 0
      ? (retentionRate[0].returning_customers / retentionRate[0].total_customers * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        timeline: retentionData,
        retention_rate: rate,
        new_customers: retentionRate[0].total_customers - retentionRate[0].returning_customers,
        returning_customers: retentionRate[0].returning_customers
      }
    });
  } catch (error) {
    console.error('Error fetching customer retention:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer retention',
      error: error.message
    });
  }
});

// Get hourly orders
// Get table performance
app.get('/api/analytics/table-performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    const [results] = await pool.execute(`
      SELECT 
        table_number,
        COUNT(*) as total_orders,
        COALESCE(SUM(${revenueColumn}), 0) as total_revenue,
        COALESCE(AVG(${revenueColumn}), 0) as avg_order_value,
        MAX(created_at) as last_order
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY table_number
      ORDER BY total_revenue DESC
    `, [startDate, endDate, company_id]);

    // Format the data
    const formattedData = results.map(row => ({
      ...row,
      [`total_revenue_${currency.toLowerCase()}`]: row.total_revenue,
      [`avg_order_value_${currency.toLowerCase()}`]: row.avg_order_value
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching table performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table performance',
      error: error.message
    });
  }
});

app.get('/api/analytics/hourly-orders', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const [results] = await pool.execute(`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount_inr), 0) as revenue_inr,
        COALESCE(SUM(total_amount_usd), 0) as revenue_usd,
        COUNT(DISTINCT table_id) as tables_used
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `, [startDate, endDate, company_id]);

    // Fill in missing hours with 0 orders
    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      const hourData = results.find(item => item.hour === i);
      hourlyData.push({
        hour: i,
        orders: hourData ? hourData.orders : 0,
        revenue_inr: hourData ? hourData.revenue_inr : 0,
        revenue_usd: hourData ? hourData.revenue_usd : 0,
        tables_used: hourData ? hourData.tables_used : 0
      });
    }

    res.json({ success: true, data: hourlyData });
  } catch (error) {
    console.error('Error fetching hourly orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly orders',
      error: error.message
    });
  }
});


// Get payment methods distribution
app.get('/api/analytics/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const [results] = await pool.execute(`
    SELECT
    payment_method,
      COUNT(*) as count
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY payment_method
        `, [startDate, endDate, company_id]);

    // Convert to object format for the chart
    const paymentMethods = {};
    results.forEach(item => {
      paymentMethods[item.payment_method] = item.count;
    });

    res.json({ success: true, data: paymentMethods });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message
    });
  }
});

// Get previous period data for comparison
app.get('/api/analytics/previous-period', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getPreviousPeriodDateRange(period);

    // Total orders
    const [totalOrdersResult] = await pool.execute(`
      SELECT COUNT(*) as total_orders
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
    const totalOrders = totalOrdersResult[0].total_orders;

    // Total revenue - use different queries based on currency
    let totalRevenue;
    if (currency === 'INR') {
      const [totalRevenueResult] = await pool.execute(`
        SELECT SUM(total_amount_inr) as total_revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
      totalRevenue = totalRevenueResult[0].total_revenue || 0;
    } else {
      const [totalRevenueResult] = await pool.execute(`
        SELECT SUM(total_amount_usd) as total_revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
      totalRevenue = totalRevenueResult[0].total_revenue || 0;
    }

    // Tables served
    const [tablesServedResult] = await pool.execute(`
      SELECT COUNT(DISTINCT table_id) as tables_served
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      `, [startDate, endDate, company_id]);
    const tablesServed = tablesServedResult[0].tables_served || 0;

    // Average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    res.json({
      success: true,
      data: {
        total_orders: totalOrders,
        [`total_revenue_${currency.toLowerCase()} `]: totalRevenue,
        tables_served: tablesServed,
        avg_order_value: avgOrderValue
      }
    });
  } catch (error) {
    console.error('Error fetching previous period data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch previous period data',
      error: error.message
    });
  }
});

// User authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    // Extract role from request body with default value of 'customer'
    const { fullName, email, password, role = 'customer' } = req.body;

    // Check if user already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create company based on email (e.g., raju from raju@gmail.com)
    const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyName = fullName + "'s Restaurant";

    // Check if company exists (by slug)
    let companyId;
    const [existingCompany] = await pool.execute(
      'SELECT id FROM companies WHERE slug = ?',
      [slug]
    );

    if (existingCompany.length > 0) {
      companyId = existingCompany[0].id;
    } else {
      // Create new company. Some databases may not yet have the `domain` column,
      // so we first try the new schema and gracefully fall back if needed.
      try {
        const [newCompanyResult] = await pool.execute(
          'INSERT INTO companies (name, slug, domain) VALUES (?, ?, ?)',
          [companyName, slug, `${slug}.vercel.app`]
        );
        companyId = newCompanyResult.insertId;
      } catch (err) {
        // If the `domain` column doesn't exist in this environment, fall back
        // to the older schema without breaking existing functionality.
        if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('domain')) {
          const [newCompanyResult] = await pool.execute(
            'INSERT INTO companies (name, slug) VALUES (?, ?)',
            [companyName, slug]
          );
          companyId = newCompanyResult.insertId;
        } else {
          throw err;
        }
      }
    }

    // Create new user with specified role and company_id
    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role, company_id) VALUES (?, ?, ?, ?, ?)',
      [fullName, email, passwordHash, role, companyId]
    );

    // Get the created user
    const [newUser] = await pool.execute(
      'SELECT id, full_name, email, role, company_id FROM users WHERE id = ?',
      [result.insertId]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: newUser[0].id,
        email: newUser[0].email,
        role: newUser[0].role,
        company_id: companyId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send Welcome Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      const mailOptions = {
        from: `"EndOfHunger Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Welcome to EndOfHunger! 🍔',
        text: getWelcomeEmailText(fullName, loginUrl),
        html: getWelcomeEmailTemplate(fullName, loginUrl)
      };

      // Send email asynchronously without blocking the response
      transporter.sendMail(mailOptions).catch(err => console.error('Failed to send welcome email:', err));
    }

    res.json({
      success: true,
      message: 'User registered successfully',
      data: { ...newUser[0], token },
      company: {
        id: companyId,
        name: companyName,
        slug: slug,
        url: (() => {
          const protocol = req.protocol;
          const origin = req.get('origin');

          let baseDomain;
          if (process.env.FRONTEND_URL) {
            baseDomain = process.env.FRONTEND_URL.replace(/(^\w+:|^)\/\//, '');
          } else if (origin) {
            baseDomain = origin.replace(/(^\w+:|^)\/\//, '');
          } else {
            baseDomain = req.get('host');
          }

          baseDomain = baseDomain.replace(/^www\./, '');
          return `${protocol}://${slug}.${baseDomain}`;
        })()
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [users] = await pool.execute(
      'SELECT id, full_name, email, password_hash, role, company_id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Get company details if user has a company
    let company = null;
    if (user.company_id) {
      const [companies] = await pool.execute(
        'SELECT id, name, slug FROM companies WHERE id = ?',
        [user.company_id]
      );

      if (companies.length > 0) {
        const comp = companies[0];
        company = {
          ...comp,
          url: (() => {
            const protocol = req.protocol;
            const origin = req.get('origin');

            let baseDomain;
            if (process.env.FRONTEND_URL) {
              baseDomain = process.env.FRONTEND_URL.replace(/(^\w+:|^)\/\//, '');
            } else if (origin) {
              baseDomain = origin.replace(/(^\w+:|^)\/\//, '');
            } else {
              baseDomain = req.get('host');
            }

            baseDomain = baseDomain.replace(/^www\./, '');
            return `${protocol}://${comp.slug}.${baseDomain}`;
          })()
        };
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: { ...userWithoutPassword, token },
      company: company
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message
    });
  }
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or use 'smtp.ethereal.email' for testing
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Don't reveal that user doesn't exist
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save token to database
    await pool.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, user.id]
    );

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"EndOfHunger Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      text: getForgotPasswordText(resetUrl),
      html: getForgotPasswordTemplate(resetUrl)
    };

    // Only send email if credentials are provided, otherwise log it
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } else {
      console.log('Email credentials not found. Logging reset link:', resetUrl);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request',
      error: error.message
    });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Find user with valid token
    const [users] = await pool.execute(
      'SELECT id, email FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = users[0];

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear token
    await pool.execute(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );
    // Send success email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      const mailOptions = {
        from: `"EndOfHunger Support" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Password Changed Successfully ✅',
        text: getPasswordResetSuccessText(loginUrl),
        html: getPasswordResetSuccessTemplate(loginUrl)
      };

      transporter.sendMail(mailOptions).catch(err => console.error('Failed to send password reset success email:', err));
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

// Get revenue by payment method
app.get('/api/analytics/revenue-by-payment', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    const [results] = await pool.execute(`
    SELECT
    payment_method,
      COUNT(*) as order_count,
      COALESCE(SUM(${revenueColumn}), 0) as total_revenue,
      COALESCE(AVG(${revenueColumn}), 0) as avg_order_value
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY payment_method
      ORDER BY total_revenue DESC
    `, [startDate, endDate, company_id]);

    // Format the data for the chart
    const formattedData = results.map(row => ({
      ...row,
      [`total_revenue_${currency.toLowerCase()} `]: row.total_revenue,
      [`avg_order_value_${currency.toLowerCase()} `]: row.avg_order_value
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching revenue by payment method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue by payment method',
      error: error.message
    });
  }
});

// Get order status distribution
app.get('/api/analytics/order-status', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const [results] = await pool.execute(`
    SELECT
    order_status,
      COUNT(*) as count,
      COALESCE(SUM(total_amount_inr), 0) as revenue_inr,
      COALESCE(SUM(total_amount_usd), 0) as revenue_usd
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
      GROUP BY order_status
      ORDER BY count DESC
      `, [startDate, endDate, company_id]);

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching order status distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order status distribution',
      error: error.message
    });
  }
});

// Get inventory analytics
app.get('/api/analytics/inventory', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Most used ingredients
    const [ingredientsData] = await pool.execute(`
    SELECT
    i.name as ingredient_name,
      SUM(ri.quantity * oi.quantity) as total_used,
      i.unit,
      i.current_stock,
      i.min_stock_level,
      (i.current_stock / i.min_stock_level) as stock_ratio
      FROM ingredients i
      JOIN recipe_items ri ON i.id = ri.ingredient_id
      JOIN order_items oi ON ri.menu_item_id = oi.menu_item_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ? AND o.created_at < ? AND i.company_id = ?
      GROUP BY i.id, i.name, i.unit, i.current_stock, i.min_stock_level
      ORDER BY total_used DESC
      LIMIT 20
      `, [startDate, endDate, company_id]);

    // Low stock items
    const [lowStockData] = await pool.execute(`
    SELECT
    i.name as ingredient_name,
      i.current_stock,
      i.min_stock_level,
      i.unit,
      (i.current_stock / i.min_stock_level) as stock_ratio
      FROM ingredients i
      WHERE i.current_stock <= i.min_stock_level * 1.5 AND i.company_id = ?
      ORDER BY stock_ratio ASC
      LIMIT 10
      `, [company_id]);

    // Waste analysis
    const [wasteData] = await pool.execute(`
    SELECT
    i.name as ingredient_name,
      SUM(w.quantity) as waste_quantity,
      i.unit,
      SUM(w.quantity * i.cost_per_unit) as waste_cost
      FROM waste_log w
      JOIN ingredients i ON w.ingredient_id = i.id
      WHERE w.created_at >= ? AND w.created_at < ? AND i.company_id = ?
      GROUP BY i.id, i.name, i.unit, i.cost_per_unit
      ORDER BY waste_cost DESC
      LIMIT 10
      `, [startDate, endDate, company_id]);

    res.json({
      success: true,
      data: {
        ingredients: ingredientsData,
        lowStock: lowStockData,
        waste: wasteData
      }
    });
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory analytics',
      error: error.message
    });
  }
});

// Get staff performance analytics
app.get('/api/analytics/staff-performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR' } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    // Staff performance
    const [staffData] = await pool.execute(`
    SELECT
    s.id,
      s.name as staff_name,
      s.role,
      COUNT(o.id) as orders_handled,
      COALESCE(SUM(${revenueColumn}), 0) as total_revenue,
      COALESCE(AVG(${revenueColumn}), 0) as avg_order_value,
      AVG(o.preparation_time) as avg_preparation_time
      FROM staff s
      LEFT JOIN orders o ON s.id = o.staff_id AND o.created_at >= ? AND o.created_at < ?
      WHERE s.company_id = ?
      GROUP BY s.id, s.name, s.role
      ORDER BY total_revenue DESC
      `, [startDate, endDate, company_id]);

    // Service time analysis
    const [serviceTimeData] = await pool.execute(`
    SELECT
    HOUR(o.created_at) as hour,
      AVG(o.preparation_time) as avg_preparation_time,
      AVG(o.service_time) as avg_service_time,
      COUNT(o.id) as order_count
      FROM orders o
      WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
      GROUP BY HOUR(o.created_at)
      ORDER BY hour
    `, [startDate, endDate, company_id]);

    // Format the data for the charts
    const formattedStaffData = staffData.map(row => ({
      ...row,
      [`total_revenue_${currency.toLowerCase()} `]: row.total_revenue,
      [`avg_order_value_${currency.toLowerCase()} `]: row.avg_order_value
    }));

    res.json({
      success: true,
      data: {
        staff: formattedStaffData,
        serviceTime: serviceTimeData
      }
    });
  } catch (error) {
    console.error('Error fetching staff performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff performance analytics',
      error: error.message
    });
  }
});

// Enhanced database initialization
const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');

    // Read and execute SQL file
    const sqlFilePath = path.join(__dirname, 'database.sql');
    if (fs.existsSync(sqlFilePath)) {
      const sqlFile = fs.readFileSync(sqlFilePath, 'utf8');

      // Split the file into individual statements
      const statements = sqlFile.split(';').filter(statement => statement.trim());

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.execute(statement);
          } catch (error) {
            // Ignore specific, harmless errors
            const errorMessage = error.message;
            if (
              errorMessage.includes('Duplicate entry') ||
              errorMessage.includes('already exists') ||
              // This is the key part: ignore the error if the column already exists
              errorMessage.includes('Duplicate column name') ||
              errorMessage.includes('ER_DUP_FIELDNAME')
            ) {
              console.log('Ignoring expected error:', errorMessage);
            } else {
              // Log other unexpected errors
              console.error('Error executing SQL statement:', error.message);
              console.log('Statement:', statement.substring(0, 100) + '...');
            }
          }
        }
      }

      console.log('Database initialized successfully');
    } else {
      console.log('Database initialization file not found, skipping...');
    }

  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Ingredients Endpoints
app.get('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute(`
    SELECT *,
      current_stock as quantity,
      min_stock_level as threshold 
      FROM ingredients 
      WHERE company_id = ?
      ORDER BY name
      `, [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ingredients', error: error.message });
  }
});

app.post('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const { name, quantity, unit, threshold, current_stock, min_stock_level, cost_per_unit } = req.body;
    const { company_id } = req.user;
    console.log(`Creating ingredient for company_id: ${company_id}`);

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company context missing. Please relogin.' });
    }

    // Validation
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!unit) return res.status(400).json({ success: false, message: 'Unit is required' });

    // Handle both naming conventions, default to 0 if undefined
    const stock = quantity !== undefined ? quantity : (current_stock !== undefined ? current_stock : 0);
    const minStock = threshold !== undefined ? threshold : (min_stock_level !== undefined ? min_stock_level : 0);
    const cost = cost_per_unit !== undefined ? cost_per_unit : 0.00;

    const [result] = await pool.execute(
      'INSERT INTO ingredients (name, current_stock, unit, min_stock_level, cost_per_unit, company_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, stock, unit, minStock, cost, company_id]
    );

    const [newIngredient] = await pool.execute(`
    SELECT *,
      current_stock as quantity,
      min_stock_level as threshold 
      FROM ingredients WHERE id = ?
      `, [result.insertId]);

    res.json({ success: true, data: newIngredient[0] });
  } catch (error) {
    console.error('Error creating ingredient:', error);
    res.status(500).json({ success: false, message: 'Failed to create ingredient', error: error.message });
  }
});

app.put('/api/ingredients/:id', authenticateToken, async (req, res) => {
  try {
    const { name, quantity, unit, threshold, current_stock, min_stock_level, cost_per_unit } = req.body;
    const { company_id } = req.user;

    // Validation
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!unit) return res.status(400).json({ success: false, message: 'Unit is required' });

    const stock = quantity !== undefined ? quantity : (current_stock !== undefined ? current_stock : 0);
    const minStock = threshold !== undefined ? threshold : (min_stock_level !== undefined ? min_stock_level : 0);
    const cost = cost_per_unit !== undefined ? cost_per_unit : 0.00;

    const [result] = await pool.execute(
      'UPDATE ingredients SET name = ?, current_stock = ?, unit = ?, min_stock_level = ?, cost_per_unit = ? WHERE id = ? AND company_id = ?',
      [name, stock, unit, minStock, cost, req.params.id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found or access denied' });
    }

    const [updatedIngredient] = await pool.execute(`
      SELECT *,
      current_stock as quantity,
      min_stock_level as threshold 
      FROM ingredients WHERE id = ?
      `, [req.params.id]);

    res.json({ success: true, data: updatedIngredient[0] });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    res.status(500).json({ success: false, message: 'Failed to update ingredient', error: error.message });
  }
});

app.delete('/api/ingredients/:id', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { company_id } = req.user;

    // Verify ownership first
    const [existing] = await connection.execute('SELECT id FROM ingredients WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Ingredient not found or access denied' });
    }

    // Delete related records first to satisfy foreign key constraints
    await connection.execute('DELETE FROM recipe_items WHERE ingredient_id = ?', [req.params.id]);
    await connection.execute('DELETE FROM waste_log WHERE ingredient_id = ?', [req.params.id]);

    // Now delete the ingredient
    await connection.execute('DELETE FROM ingredients WHERE id = ? AND company_id = ?', [req.params.id, company_id]);

    await connection.commit();
    res.json({ success: true, message: 'Ingredient deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting ingredient:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ingredient', error: error.message });
  } finally {
    connection.release();
  }
});

// Feedback Endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { order_id, customer_id, rating, comments } = req.body;
    await pool.execute(
      'INSERT INTO order_feedback (order_id, customer_id, rating, comments) VALUES (?, ?, ?, ?)',
      [order_id, customer_id, rating, comments]
    );
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: 'Failed to submit feedback', error: error.message });
  }
});

// Cancellation Endpoints
// Cancellation Endpoints
app.post('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason, cancelled_by } = req.body;
    const { company_id } = req.user;

    // Verify ownership
    const [existing] = await pool.execute('SELECT id FROM orders WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    // Update order status
    await pool.execute('UPDATE orders SET order_status = "cancelled" WHERE id = ?', [req.params.id]);
    // Log cancellation
    await pool.execute(
      'INSERT INTO order_cancellations (order_id, reason, cancelled_by) VALUES (?, ?, ?)',
      [req.params.id, reason, cancelled_by]
    );
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order', error: error.message });
  }
});

app.post('/api/orders/:id/items/:itemId/cancel', authenticateToken, async (req, res) => {
  try {
    const { reason, cancelled_by } = req.body;
    const { company_id } = req.user;

    // Verify ownership
    const [existing] = await pool.execute('SELECT id FROM orders WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    // Update item status
    await pool.execute('UPDATE order_items SET item_status = "cancelled" WHERE id = ? AND order_id = ?', [req.params.itemId, req.params.id]);
    // Log cancellation
    await pool.execute(
      'INSERT INTO order_cancellations (order_id, item_id, reason, cancelled_by) VALUES (?, ?, ?, ?)',
      [req.params.id, req.params.itemId, reason, cancelled_by]
    );
    res.json({ success: true, message: 'Item cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling item:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel item', error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;

// Initialize and start server
const startServer = async () => {
  try {
    // Test database connection first
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.log('Warning: Database connection failed, but server will continue running...');
    }

    httpServer.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server is running and accessible on the network at port ${PORT} `);
      console.log(`API endpoints available at http://localhost:${PORT}/api`);

      // Initialize database after server starts
      await initializeDatabase();

      // Cleanup invalid data (placeholders and empty categories)
      try {
        const connection = await pool.getConnection();
        console.log('Running database cleanup...');

        // Delete placeholder items
        const [delResult] = await connection.execute(
          "DELETE FROM menu_items WHERE name = '[Category Placeholder]' OR category = 'add-new' OR category = '' OR category IS NULL"
        );
        console.log(`Cleanup: Deleted ${delResult.affectedRows} invalid menu items`);

        connection.release();
      } catch (err) {
        console.error('Cleanup failed:', err);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, io };
