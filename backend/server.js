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
  getPasswordResetSuccessText,
  getSupportTicketTemplate,
  getSupportReplyTemplate
} = require('./emailTemplates');

// Email transporter configuration - Moved to top for global access
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or use 'smtp.ethereal.email' for testing
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter
transporter.verify(function (error, success) {
  if (error) {
    console.log('[EMAIL ERROR] Transporter verification failed:', error);
    console.log('[EMAIL ERROR] Check these settings:');
    console.log('[EMAIL ERROR] - EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'NOT SET');
    console.log('[EMAIL ERROR] - EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set (length: ' + process.env.EMAIL_PASS.length + ')' : 'NOT SET');
    console.log('[EMAIL ERROR] - If using Gmail, ensure you are using an App Password, not your regular password');
    console.log('[EMAIL ERROR] - Generate at: https://myaccount.google.com/apppasswords');
  } else {
    console.log('[EMAIL SUCCESS] Server is ready to send emails');
    console.log('[EMAIL SUCCESS] Using email:', process.env.EMAIL_USER);
  }
});

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
  'https://dineflowfrontend-6wmy.vercel.app',
  'https://endofhunger.work.gd',
  'http://endofhunger.work.gd',
  'https://redsorm.in',
  'https://www.redsorm.in',
  'http://redsorm.in',
  'http://www.redsorm.in'
];

// Serve static files - moved to top level
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public'))); // General public folder

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

      const customDomainRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?endofhunger\.work\.gd$/;
      if (customDomainRegex.test(origin)) return callback(null, true);

      // Allow redsorm.in domain and its subdomains
      const redsormRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?redsorm\.in$/;
      if (redsormRegex.test(origin)) return callback(null, true);

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

    // Allow localhost subdomains (e.g. http://tenant.localhost:3000 OR http://ma1.ma1.localhost:3000)
    // Updated regex to accept any level of subdomain nesting
    const localhostRegex = /^http:\/\/([a-zA-Z0-9-]+\.)*localhost(:\d+)?$/;
    if (localhostRegex.test(origin)) {
      return callback(null, true);
    }

    // Allow vercel preview deployments
    const vercelRegex = /^https:\/\/dineflowfrontend.*\.vercel\.app$/;
    if (vercelRegex.test(origin)) {
      return callback(null, true);
    }

    // Allow custom domain and its subdomains
    const customDomainRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?endofhunger\.work\.gd$/;
    if (customDomainRegex.test(origin)) {
      return callback(null, true);
    }

    // Allow redsorm.in domain and its subdomains (main production domain)
    const redsormRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?redsorm\.in$/;
    if (redsormRegex.test(origin)) {
      return callback(null, true);
    }

    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-company-slug', 'x-company-id', 'ngrok-skip-browser-warning'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Add JSON parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Middleware to resolve company from request (for public routes)
const resolveCompany = async (req, res, next) => {
  try {
    // 0) Priority: ID header (from Vercel testing mode or explicit selection)
    let companyIdHeader = req.headers['x-company-id'];
    if (companyIdHeader) {
      const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [companyIdHeader]);
      if (rows.length > 0) {
        req.company = rows[0];
        // console.log(`[Context] resolved company by ID: ${req.company.name} (${req.company.id})`);
        return next();
      }
    }

    // 1) Highest priority: explicit slug header
    let slug = req.headers['x-company-slug'];
    let isExplicitSlug = !!slug;

    // 2) Otherwise, derive from the Origin header (frontend domain with subdomain)
    if (!slug) {
      const origin = req.get('origin') || req.headers.origin;
      if (origin) {
        try {
          const originHost = new URL(origin).hostname; // e.g. company.myapp.vercel.app
          const parts = originHost.split('.');

          // We expect subdomain-based tenancy only when there is a subdomain present
          // (e.g. company.domain.com or company.localhost)
          if (parts.length > 2 || (parts.length === 2 && parts[1] === 'localhost')) {
            const candidate = parts[0];
            if (candidate && candidate !== 'www' && candidate !== 'api') {
              slug = candidate;
            }
          }
        } catch (e) {
          console.warn('Failed to parse Origin header for company slug:', origin, e.message);
        }
      }
    }

    // 3) If we still don't have a slug, DON'T apply fallback automatically
    // This endpoint is often called without authentication context
    // Authenticated users should use /api/company/profile which uses their token's company_id
    // Public/unauthenticated users on customer page can use the fallback
    if (!slug) {
      // Only apply fallback for customer-page-like routes or if explicitly needed
      // For now, let's NOT set a fallback company to avoid all admins seeing the same one
      return next();
    }


    // 4) Look up company in DB
    const [rows] = await pool.execute('SELECT * FROM companies WHERE slug = ?', [slug]);
    if (rows.length === 0) {
      // If explicit slug provided but not found -> 404
      if (isExplicitSlug) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }
      // If implicit (subdomain) and not found -> just continue without context (maybe fallback to main landing page logic later)
      // console.warn(`Company slug '${slug}' derived from subdomain not found in DB.`);
      return next();
    }

    // Attach company info to request
    req.company = rows[0];
    // console.log(`[Context] resolved company: ${req.company.name} (${req.company.id})`);
    next();

  } catch (error) {
    console.error('Error in resolveCompany middleware:', error);
    // Don't crash, just proceed without company context
    next();
  }
};

// Middleware to resolve company from request (for public routes) - placed here to be available for all routes
app.use(resolveCompany);

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
// Error handling middleware moved to the end


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


// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // console.log('Auth Header:', authHeader ? 'Present' : 'Missing', authHeader); // Commented out to reduce noise, enable if needed
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
    await addColumnIfNotExists('restaurant_tables', 'group_id', 'INT'); // Fix for table creation 500 error

    // Ensure table_groups exists before adding columns
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS table_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addColumnIfNotExists('table_groups', 'company_id', 'INT');
    await addColumnIfNotExists('orders', 'company_id', 'INT');
    await addColumnIfNotExists('order_items', 'company_id', 'INT');
    await addColumnIfNotExists('ingredients', 'branch_id', 'INT'); // Branch Management
    await addColumnIfNotExists('menu_items', 'company_id', 'INT');
    await addColumnIfNotExists('order_items', 'company_id', 'INT');
    await addColumnIfNotExists('staff', 'company_id', 'INT');
    await addColumnIfNotExists('recipe_items', 'company_id', 'INT');
    await addColumnIfNotExists('waste_log', 'company_id', 'INT');
    await addColumnIfNotExists('users', 'company_id', 'INT');

    // Companies multitenancy metadata
    await addColumnIfNotExists('companies', 'slug', 'VARCHAR(255)');
    await addColumnIfNotExists('companies', 'domain', 'VARCHAR(255)');

    // Support System Tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        company_id INT,
        name VARCHAR(255),
        email VARCHAR(255),
        subject VARCHAR(255),
        status VARCHAR(50) DEFAULT 'open',
        message_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT,
        sender_role VARCHAR(50),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
      )
    `);

    // Add company profile columns
    await addColumnIfNotExists('companies', 'logo_url', 'TEXT');
    await addColumnIfNotExists('companies', 'banner_url', 'TEXT');

    // Create roles table
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

    // Update users table
    await addColumnIfNotExists('users', 'phone', 'VARCHAR(20)');
    await addColumnIfNotExists('users', 'role_id', 'INT');

    // Update staff table
    await addColumnIfNotExists('staff', 'pin', 'VARCHAR(10)');
    await addColumnIfNotExists('staff', 'email', 'VARCHAR(100)');
    await addColumnIfNotExists('staff', 'phone', 'VARCHAR(20)');

    // Update tables for branch isolation
    await addColumnIfNotExists('restaurant_tables', 'branch_id', 'INT');

    // Update menu_items for branch isolation
    await addColumnIfNotExists('menu_items', 'branch_id', 'INT');

    // Update orders for branch isolation
    await addColumnIfNotExists('orders', 'branch_id', 'INT');

    // FIX: Update restaurant_tables constraints for branch-wise uniqueness
    try {
      // Drop ALL old constraints that don't include branch_id
      const [allIndexes] = await connection.execute("SHOW INDEX FROM restaurant_tables");

      for (const idx of allIndexes) {
        const keyName = idx.Key_name;
        // Skip PRIMARY key
        if (keyName === 'PRIMARY') continue;

        // Check if this is a unique constraint on table_number
        if (keyName.includes('table') || keyName.includes('idx_tables_number_company') || keyName === 'uq_table_company') {
          try {
            console.log(`Dropping old constraint: ${keyName}`);
            await connection.execute(`ALTER TABLE restaurant_tables DROP INDEX \`${keyName}\``);
          } catch (dropErr) {
            console.log(`Could not drop ${keyName}:`, dropErr.message);
          }
        }
      }

      // Create new branch-aware unique constraint
      console.log('Adding branch-aware unique constraint (table_number, company_id, branch_id)...');
      await connection.execute(`
        ALTER TABLE restaurant_tables 
        ADD UNIQUE KEY idx_table_company_branch (table_number, company_id, branch_id)
      `);

    } catch (err) {
      console.error('Error updating table constraints:', err);
      // Continue - don't block server start, but log clearly
    }

    // FIX: Update table_groups constraints for multitenancy
    try {
      // 1. Check for legacy 'name' index
      const [nameIndexes] = await connection.execute("SHOW INDEX FROM table_groups WHERE Key_name = 'name'");
      // If index exists and is not composite (no company_id), drop it
      if (nameIndexes.length > 0 && !nameIndexes.some(idx => idx.Column_name === 'company_id')) {
        console.log('Dropping legacy global unique constraint on table_groups.name...');
        await connection.execute('ALTER TABLE table_groups DROP INDEX name');
      }

      // 2. Check for other common index names for this constraint
      const [uniqIndexes] = await connection.execute("SHOW INDEX FROM table_groups WHERE Key_name = 'name_unique'");
      if (uniqIndexes.length > 0 && !uniqIndexes.some(idx => idx.Column_name === 'company_id')) {
        await connection.execute('ALTER TABLE table_groups DROP INDEX name_unique');
      }

      // 3. Add composite unique constraint
      await connection.execute(`
            ALTER TABLE table_groups
            ADD UNIQUE KEY IF NOT EXISTS company_group_name_unique (company_id, name)
        `);
    } catch (err) {
      // Ignore "Duplicate key" error if we are adding what already exists, but log others
      if (err.code !== 'ER_DUP_KEYNAME') {
        console.log('Note: table_groups constraint update:', err.message);
      }
    }

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
app.get('/api/menu', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching menu items...');
    let companyId = req.company ? req.company.id : null;

    // Check for admin/staff token if no company resolved from slug
    if (!companyId && req.user && req.user.company_id) {
      companyId = req.user.company_id;
    }

    // Default Fallback: If still no companyId (e.g. new customer on main domain),
    // fetch the default "demo" company (same logic as resolveCompany fallback)
    if (!companyId) {
      // Try to find the most "featured" company (has banner & logo)
      const [companies] = await pool.execute('SELECT id FROM companies WHERE logo_url IS NOT NULL AND banner_url IS NOT NULL ORDER BY id DESC LIMIT 1');
      if (companies.length > 0) {
        companyId = companies[0].id;
        console.log(`Using default fallback company: ${companyId}`);
      }
    }

    const { branch_id } = req.query;

    // Dynamic Query Builder
    let query = 'SELECT * FROM menu_items WHERE company_id = ?';
    let params = [companyId];

    // Branch Filtering - STRICT: Show only items from selected branch
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND branch_id = ?';
      params.push(branch_id);
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
    const { name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins, branch_id } = req.body;
    const { company_id } = req.user;
    console.log(`Creating menu item for company_id: ${company_id} branch_id: ${branch_id}`);

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company context missing. Please relogin.' });
    }

    // Validate category - prevent empty or 'add-new' categories
    if (!category || category.trim() === '' || category.toLowerCase() === 'add-new') {
      return res.status(400).json({ success: false, message: 'Please select a valid category' });
    }

    const [result] = await pool.execute(
      'INSERT INTO menu_items (name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins, company_id, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, price_inr, price_usd, category.trim(), image_url || null, is_available !== false, nutritional_info || null, vitamins || null, company_id, branch_id || null]
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
    const { name, description, price_inr, price_usd, category, image_url, is_available, nutritional_info, vitamins, branch_id } = req.body;
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
      'UPDATE menu_items SET name = ?, description = ?, price_inr = ?, price_usd = ?, category = ?, image_url = ?, is_available = ?, nutritional_info = ?, vitamins = ?, branch_id = ? WHERE id = ? AND company_id = ?',
      [name, description, price_inr, price_usd, category.trim(), image_url, is_available, nutritional_info || null, vitamins || null, branch_id || null, req.params.id, company_id]
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

    // 2. Check req.company (from resolveCompany)
    if (!company_id && req.company) {
      company_id = req.company.id;
    }

    // Default Fallback: If still no companyId (e.g. new customer on main domain),
    // fetch the default "demo" company (same logic as resolveCompany/menu fallback)
    if (!company_id) {
      const [companies] = await pool.execute('SELECT id FROM companies WHERE logo_url IS NOT NULL AND banner_url IS NOT NULL ORDER BY id DESC LIMIT 1');
      if (companies.length > 0) {
        company_id = companies[0].id;
        console.log(`Using default fallback company for tables: ${company_id}`);
      }
    }

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company context required' });
    }

    console.log('Fetching tables for company:', company_id);
    const { branch_id } = req.query;

    try {
      let query = 'SELECT rt.*, COALESCE(tg.name, "Non AC") as group_name FROM restaurant_tables rt LEFT JOIN table_groups tg ON rt.group_id = tg.id WHERE rt.company_id = ?';
      let params = [company_id];

      if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
        query += ' AND rt.branch_id = ?';
        params.push(branch_id);
      }

      query += ' ORDER BY rt.table_number';

      const [rows] = await pool.execute(query, params);
      console.log(`Found ${rows.length} tables for company ${company_id} ${branch_id ? `branch ${branch_id}` : ''}`);
      res.json({ success: true, data: rows });
    } catch (innerError) {
      console.error('Error fetching tables:', innerError);
      res.status(500).json({ success: false, message: innerError.message });
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

    const { table_number, table_name, group_id, branch_id } = req.body;
    const { company_id } = req.user;

    // 1. Validate required fields
    if (!table_number) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Table number is required.'
      });
    }

    // 2. Check if table number already exists for this company AND branch
    let checkQuery = 'SELECT id FROM restaurant_tables WHERE table_number = ? AND company_id = ?';
    const checkParams = [table_number, company_id];

    if (branch_id) {
      checkQuery += ' AND branch_id = ?';
      checkParams.push(branch_id);
    } else {
      checkQuery += ' AND branch_id IS NULL';
    }

    const [existingTable] = await connection.execute(checkQuery, checkParams);

    if (existingTable.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Table number ${table_number} already exists in this branch. Please choose a different number.`
      });
    }

    // 3. Proceed with insertion
    const qr_code_data = `table-${table_number}`;
    console.log('[DEBUG] Preparing insertion query...');

    // We know group_id exists because we update the schema on startup
    // However, if the user sends an invalid group_id, it will crash with FK error.
    // Validate group_id if provided
    if (group_id) {
      console.log(`[DEBUG] Validating group_id: ${group_id} for company: ${company_id}`);
      const [groupExists] = await connection.execute(
        'SELECT id FROM table_groups WHERE id = ? AND company_id = ?',
        [group_id, company_id]
      );
      console.log(`[DEBUG] Group validation result: ${JSON.stringify(groupExists)}`);
      if (groupExists.length === 0) {
        await connection.rollback();
        console.log('[DEBUG] Invalid group_id');
        return res.status(400).json({ success: false, message: 'Invalid Table Group selected.' });
      }
    }

    const query = 'INSERT INTO restaurant_tables (table_number, table_name, qr_code_data, group_id, company_id, branch_id) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [table_number, table_name || `Table ${table_number}`, qr_code_data, group_id || null, company_id, branch_id || null];

    console.log('[DEBUG] Executing Query:', query);
    console.log('[DEBUG] Values:', values);

    // Try-catch specific to insertion to capture SQL errors
    try {
      const [result] = await connection.execute(query, values);
      console.log('[DEBUG] Insert success, ID:', result.insertId);
      await connection.commit();

      // Get the newly created table
      // FIX: Use single quotes for string literal 'Non AC' to avoid it being interpreted as a column identifier
      const [newTable] = await pool.execute(
        `SELECT rt.*, COALESCE(tg.name, 'Non AC') as group_name FROM restaurant_tables rt LEFT JOIN table_groups tg ON rt.group_id = tg.id WHERE rt.id = ?`,
        [result.insertId]
      );

      res.json({ success: true, data: newTable[0] });

    } catch (insertError) {
      console.error('[DEBUG] Insert Error:', insertError);
      throw insertError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating table [CRITICAL]:', error);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.sqlMessage || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create table',
      error: error.message,
      debug_info: {
        code: error.code,
        sqlMessage: error.sqlMessage
      }
    });

  } finally {
    if (connection) connection.release();
  }
});

// START DEBUG ENDPOINT
app.get('/api/debug/schema/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const [columns] = await pool.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()`,
      [tableName]
    );
    res.json({ success: true, table: tableName, columns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// END DEBUG ENDPOINT

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
    res.status(500).json({
      success: false,
      message: 'Failed to create table group',
      error: error.message,
      debug_info: {
        code: error.code,
        sqlMessage: error.sqlMessage
      }
    });
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
app.get('/api/categories', authenticateToken, async (req, res) => {
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
    const { status, start_date, end_date, table_number, customer_id, branch_id } = req.query;
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

    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      conditions.push('branch_id = ?');
      params.push(branch_id);
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
app.post('/api/orders', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { table_number, items, currency, payment_method, customer_id, branch_id } = req.body;
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

    // Use branch_id to uniquely identify table if provided
    let tableQuery = 'SELECT id, branch_id FROM restaurant_tables WHERE table_number = ? AND company_id = ?';
    const tableParams = [table_number, companyId];
    if (branch_id) {
      tableQuery += ' AND branch_id = ?';
      tableParams.push(branch_id);
    }

    const [tableRows] = await connection.execute(tableQuery, tableParams);

    if (tableRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    const table_id = tableRows[0].id;
    // Use the branch_id from the table if we didn't get one (or verify match)
    const finalBranchId = branch_id || tableRows[0].branch_id;

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
      insertQuery = 'INSERT INTO orders (table_id, table_number, customer_id, total_amount_inr, total_amount_usd, currency, payment_method, order_status, payment_status, company_id, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      insertValues = [table_id, table_number, customer_id || null, total_inr.toFixed(2), total_usd.toFixed(2), currency, payment_method, 'pending', payment_method === 'cash' ? 'pending' : 'paid', companyId, finalBranchId || null];
    } else {
      // Fallback if company_id missing (unlikely given check)
      insertQuery = 'INSERT INTO orders (table_id, table_number, customer_id, total_amount_inr, total_amount_usd, currency, payment_method, order_status, payment_status, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      insertValues = [table_id, table_number, customer_id || null, total_inr.toFixed(2), total_usd.toFixed(2), currency, payment_method, 'pending', payment_method === 'cash' ? 'pending' : 'paid', finalBranchId || null];
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

    console.log('[ORDER STATUS] Updating order:', req.params.id, 'to status:', order_status);
    console.log('[ORDER STATUS] User:', req.user?.id, 'User company:', req.user?.company_id);

    // Resolve company_id (same logic as customer orders fetch)
    let company_id = null;

    // Priority 1: From middleware
    if (req.company && req.company.id) {
      company_id = req.company.id;
    }

    // Priority 2: From header
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
    }

    // Priority 3: From user
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
    }

    // Priority 4: Get from the order itself
    if (!company_id) {
      const [orderRows] = await pool.execute('SELECT company_id FROM orders WHERE id = ?', [req.params.id]);
      if (orderRows.length > 0) {
        company_id = orderRows[0].company_id;
        console.log('[ORDER STATUS] Got company_id from order:', company_id);
      }
    }

    console.log('[ORDER STATUS] Resolved company_id:', company_id);

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Could not determine company context' });
    }

    const [result] = await pool.execute(
      'UPDATE orders SET order_status = ? WHERE id = ? AND company_id = ?',
      [order_status, req.params.id, company_id]
    );

    if (result.affectedRows === 0) {
      console.log('[ORDER STATUS] No rows updated - order not found or wrong company');
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    const [updatedOrder] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    io.to(`company_${company_id}`).emit('order-status-updated', updatedOrder[0]);

    console.log('[ORDER STATUS] Successfully updated order');
    res.json({ success: true, data: updatedOrder[0] });
  } catch (error) {
    console.error('[ORDER STATUS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// Cancel Order Item
app.put('/api/orders/:orderId/items/:itemId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    console.log('[CANCEL ITEM] Order:', orderId, 'Item:', itemId, 'Reason:', reason);

    // Resolve company_id (same logic as order status)
    let company_id = null;
    if (req.company && req.company.id) {
      company_id = req.company.id;
    }
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
    }
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
    }

    // Get company_id from order if still not found
    if (!company_id) {
      const [orderRows] = await pool.execute('SELECT company_id FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length > 0) {
        company_id = orderRows[0].company_id;
      }
    }

    console.log('[CANCEL ITEM] Resolved company_id:', company_id);

    // Delete the item from order_items
    const [deleteResult] = await pool.execute(
      'DELETE FROM order_items WHERE id = ? AND order_id = ?',
      [itemId, orderId]
    );

    if (deleteResult.affectedRows === 0) {
      console.log('[CANCEL ITEM] Item not found');
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Recalculate order total
    const [remainingItems] = await pool.execute(
      'SELECT SUM(price_inr * quantity) as total_inr, SUM(price_usd * quantity) as total_usd FROM order_items WHERE order_id = ?',
      [orderId]
    );

    if (remainingItems[0].total_inr === null) {
      // No items left - cancel the entire order
      await pool.execute(
        'UPDATE orders SET order_status = ? WHERE id = ?',
        ['cancelled', orderId]
      );
      console.log('[CANCEL ITEM] All items cancelled - order cancelled');
    } else {
      // Update order total
      await pool.execute(
        'UPDATE orders SET total_amount_inr = ?, total_amount_usd = ? WHERE id = ?',
        [remainingItems[0].total_inr || 0, remainingItems[0].total_usd || 0, orderId]
      );
      console.log('[CANCEL ITEM] Order total updated');
    }

    // Emit socket event
    if (company_id) {
      io.to(`company_${company_id}`).emit('order-updated', { orderId, itemId, action: 'item_cancelled' });
    }

    console.log('[CANCEL ITEM] Successfully cancelled item');
    res.json({ success: true, message: 'Item cancelled successfully' });
  } catch (error) {
    console.error('[CANCEL ITEM] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel item',
      error: error.message
    });
  }
});

// Cancel Entire Order
app.put('/api/orders/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    console.log('[CANCEL ORDER] Order:', orderId, 'Reason:', reason);

    // Resolve company_id
    let company_id = null;
    if (req.company && req.company.id) {
      company_id = req.company.id;
    }
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
    }
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
    }

    // Get company_id from order if needed
    if (!company_id) {
      const [orderRows] = await pool.execute('SELECT company_id FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length > 0) {
        company_id = orderRows[0].company_id;
      }
    }

    console.log('[CANCEL ORDER] Resolved company_id:', company_id);

    // Update order status to cancelled
    const [result] = await pool.execute(
      'UPDATE orders SET order_status = ? WHERE id = ?',
      ['cancelled', orderId]
    );

    if (result.affectedRows === 0) {
      console.log('[CANCEL ORDER] Order not found');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Emit socket event
    if (company_id) {
      const [updatedOrder] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
      io.to(`company_${company_id}`).emit('order-status-updated', updatedOrder[0]);
    }

    console.log('[CANCEL ORDER] Successfully cancelled order');
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('[CANCEL ORDER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
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
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Build branch filter params
    const branchCondition = (branch_id && branch_id !== 'null' && branch_id !== 'undefined') ? ' AND branch_id = ?' : '';
    const baseParams = [startDate, endDate, company_id];
    if (branchCondition) baseParams.push(branch_id);

    // Total orders
    const [totalOrdersResult] = await pool.execute(`
      SELECT COUNT(*) as total_orders
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
    `, baseParams);
    const totalOrders = totalOrdersResult[0].total_orders;

    // Total revenue - use different queries based on currency
    let totalRevenue;
    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    const [totalRevenueResult] = await pool.execute(`
      SELECT SUM(${revenueColumn}) as total_revenue
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
    `, baseParams);
    totalRevenue = totalRevenueResult[0].total_revenue || 0;

    // Tables served
    const [tablesServedResult] = await pool.execute(`
      SELECT COUNT(DISTINCT table_id) as tables_served
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
    `, baseParams);
    const tablesServed = tablesServedResult[0].tables_served || 0;

    // Average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Customers
    const [customersResult] = await pool.execute(`
      SELECT COUNT(DISTINCT customer_id) as total_customers
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
    `, baseParams);
    const totalCustomers = customersResult[0].total_customers || 0;

    // Average items per order
    const [avgItemsResult] = await pool.execute(`
      SELECT AVG(item_count) as avg_items_per_order
      FROM (
        SELECT o.id, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?${branchCondition.replace('branch_id', 'o.branch_id')}
        GROUP BY o.id
      ) as order_items_count
    `, baseParams);
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
// Get revenue and orders over time
app.get('/api/analytics/revenue-orders', authenticateToken, async (req, res) => {
  try {
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Build branch filter params
    const branchCondition = (branch_id && branch_id !== 'null' && branch_id !== 'undefined') ? ' AND branch_id = ?' : '';
    const queryParams = [startDate, endDate, company_id];
    if (branchCondition) queryParams.push(branch_id);

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
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
      GROUP BY ${groupBy}
      ORDER BY date_group
      `, queryParams);

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
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'oi.price_inr' : 'oi.price_usd';

    let query = `
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
    `;

    const params = [startDate, endDate, company_id];
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND o.branch_id = ?';
      params.push(branch_id);
    }

    query += `
      GROUP BY mi.id, mi.name, mi.category
      ORDER BY quantity_sold DESC
      LIMIT 10
    `;

    const [results] = await pool.execute(query, params);

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
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'oi.price_inr' : 'oi.price_usd';

    let query = `
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
    `;

    const params = [startDate, endDate, company_id];
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND o.branch_id = ?';
      params.push(branch_id);
    }

    query += `
      GROUP BY mi.category
      ORDER BY total_revenue DESC
    `;

    const [results] = await pool.execute(query, params);

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
    const { period = 'daily', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    // Build branch conditions
    const branchConditionAlias = (branch_id && branch_id !== 'null' && branch_id !== 'undefined') ? ' AND o.branch_id = ?' : '';
    const branchConditionNoAlias = (branch_id && branch_id !== 'null' && branch_id !== 'undefined') ? ' AND branch_id = ?' : '';
    const queryParams = [startDate, endDate, company_id];
    if (branchConditionAlias) queryParams.push(branch_id);

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
        WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?${branchConditionAlias}
        GROUP BY o.customer_id, DATE(o.created_at)
      ) as customer_data
      GROUP BY DATE(created_at)
      ORDER BY date
      `, queryParams);

    // Calculate overall retention rate
    // Note: Reusing queryParams logic might be tricky if params count differs. It matches here (3 params + 1 optional).
    const [retentionRate] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT CASE WHEN order_count > 1 THEN customer_id END) as returning_customers,
      COUNT(DISTINCT customer_id) as total_customers
      FROM(
        SELECT 
          customer_id,
        COUNT(*) as order_count
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchConditionNoAlias}
        GROUP BY customer_id
      ) as customer_data
    `, queryParams);

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
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';

    let query = `
      SELECT 
        o.table_number,
        COALESCE(rt.table_name, CONCAT('Table ', o.table_number)) as table_name,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.${revenueColumn}), 0) as total_revenue,
        COALESCE(AVG(o.${revenueColumn}), 0) as avg_order_value,
        MAX(o.created_at) as last_order
      FROM orders o
      LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.company_id = ?
    `;

    const params = [startDate, endDate, company_id];
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND o.branch_id = ?';
      params.push(branch_id);
    }

    query += `
      GROUP BY o.table_number, rt.table_name, rt.id
      ORDER BY total_revenue DESC
    `;

    const [results] = await pool.execute(query, params);

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
    const { period = 'daily', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    let query = `
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount_inr), 0) as revenue_inr,
        COALESCE(SUM(total_amount_usd), 0) as revenue_usd,
        COUNT(DISTINCT table_id) as tables_used
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?
    `;

    const params = [startDate, endDate, company_id];
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND branch_id = ?';
      params.push(branch_id);
    }

    query += `
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `;

    const [results] = await pool.execute(query, params);

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
    const { period = 'daily', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getDateRangeForPeriod(period);

    let query = `
     SELECT
     payment_method,
       COUNT(*) as count
       FROM orders
       WHERE created_at >= ? AND created_at < ? AND company_id = ?
    `;

    const params = [startDate, endDate, company_id];
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND branch_id = ?';
      params.push(branch_id);
    }

    query += `
      GROUP BY payment_method
    `;

    const [results] = await pool.execute(query, params);

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
    const { period = 'daily', currency = 'INR', branch_id } = req.query;
    const { company_id } = req.user;
    const { startDate, endDate } = getPreviousPeriodDateRange(period);

    const branchCondition = (branch_id && branch_id !== 'null' && branch_id !== 'undefined') ? ' AND branch_id = ?' : '';
    const queryParams = [startDate, endDate, company_id];
    if (branchCondition) queryParams.push(branch_id);

    // Total orders
    const [totalOrdersResult] = await pool.execute(`
      SELECT COUNT(*) as total_orders
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
      `, queryParams);
    const totalOrders = totalOrdersResult[0].total_orders;

    // Total revenue - use dynamic column
    const revenueColumn = currency === 'INR' ? 'total_amount_inr' : 'total_amount_usd';
    const [totalRevenueResult] = await pool.execute(`
        SELECT SUM(${revenueColumn}) as total_revenue
        FROM orders
        WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
      `, queryParams);

    // Fallback? pool.execute returns rows. 
    // Wait, the syntax I wrote: SUM(${revenueColumn}) is template literal injection.
    const totalRevenue = totalRevenueResult[0].total_revenue || 0;

    // Tables served
    const [tablesServedResult] = await pool.execute(`
      SELECT COUNT(DISTINCT table_id) as tables_served
      FROM orders
      WHERE created_at >= ? AND created_at < ? AND company_id = ?${branchCondition}
      `, queryParams);
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
    // Ensure critical schema (including users.company_id) is present before we insert
    await updateDatabaseSchema();

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

    // Check if company exists (by slug). Some older databases may not yet have the
    // `slug` or `domain` columns, so we wrap this in a try/catch and gracefully
    // fall back when needed.
    let companyId;
    let companySlugForUrl = slug;

    try {
      const [existingCompany] = await pool.execute(
        'SELECT id FROM companies WHERE slug = ?',
        [slug]
      );

      if (existingCompany.length > 0) {
        companyId = existingCompany[0].id;
      } else {
        // Create new company with slug (and domain if column exists)
        try {
          const [newCompanyResult] = await pool.execute(
            'INSERT INTO companies (name, slug, domain) VALUES (?, ?, ?)',
            [companyName, slug, `${slug}.vercel.app`]
          );
          companyId = newCompanyResult.insertId;

          // --- VERCEL SUBDOMAIN INTEGRATION ---
          // Attempt to add this new subdomain to the Vercel project
          if (process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID) {
            const baseDomain = process.env.FRONTEND_URL
              ? process.env.FRONTEND_URL.replace(/(^\w+:|^)\/\//, '')
              : null;

            if (baseDomain) {
              const cleanBase = baseDomain.replace(/^www\./, '');
              const fullDomain = `${slug}.${cleanBase}`;
              console.log(`Attempting to add domain to Vercel: ${fullDomain}`);

              // Don't await this to prevent blocking registration if it fails or is slow
              fetch(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: fullDomain })
              })
                .then(async (vRes) => {
                  if (!vRes.ok) {
                    const errText = await vRes.text();
                    console.error('Vercel API Error:', errText);
                  } else {
                    console.log('Successfully added domain to Vercel:', fullDomain);
                  }
                })
                .catch(err => console.error('Failed to call Vercel API:', err));
            }
          }
          // ------------------------------------

        } catch (err) {
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
    } catch (err) {
      // If the `slug` column itself does not exist in this environment,
      // fall back to a simple company row without slug-based logic.
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.message.includes('slug')) {
        const [newCompanyResult] = await pool.execute(
          'INSERT INTO companies (name) VALUES (?)',
          [companyName]
        );
        companyId = newCompanyResult.insertId;
        // We cannot persist slug in DB, so URLs will not use subdomains here.
        companySlugForUrl = null;
      } else {
        throw err;
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
        slug: companySlugForUrl,
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

          // If we have a slug stored, use subdomain; otherwise, just use base domain.
          if (companySlugForUrl) {
            return `${protocol}://${companySlugForUrl}.${baseDomain}`;
          }
          return `${protocol}://${baseDomain}`;
        })()
      }
    });
  } catch (error) {
    // Log detailed error information for debugging (visible in Render logs)
    console.error('Error registering user:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });

    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      // Expose minimal details to help diagnose pre-prod issues without breaking frontend
      error: error.message,
      code: error.code
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[LOGIN] Attempt for email:', email);

    // Find user by email (including role_id for permissions)
    const [users] = await pool.execute(
      'SELECT id, full_name, email, password_hash, role, role_id, company_id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.log('[LOGIN] User not found for email:', email);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];
    console.log('[LOGIN] User found:', { id: user.id, email: user.email, role: user.role, company_id: user.company_id, has_role_id: !!user.role_id });

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      console.log('[LOGIN] Password mismatch for email:', email);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    console.log('[LOGIN] Password matched for email:', email);

    // Fetch role permissions if user has a role_id
    let permissions = null;
    if (user.role_id) {
      const [roles] = await pool.execute(
        'SELECT permissions FROM roles WHERE id = ?',
        [user.role_id]
      );
      if (roles.length > 0 && roles[0].permissions) {
        try {
          permissions = typeof roles[0].permissions === 'string'
            ? JSON.parse(roles[0].permissions)
            : roles[0].permissions;
          console.log('[LOGIN] Permissions loaded for role_id:', user.role_id, permissions);
        } catch (e) {
          console.error('Error parsing permissions:', e);
        }
      }
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
      data: { ...userWithoutPassword, token, permissions },
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

// GET /api/auth/me - Get current user (Missing endpoint fixed)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // Return user info attached to request by authenticateToken
    // If we need fresh data from DB (including role_id for permissions)
    const [users] = await pool.execute(
      'SELECT id, full_name, email, role, role_id, company_id FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    // Fetch role permissions if user has a role_id
    let permissions = null;
    if (user.role_id) {
      const [roles] = await pool.execute(
        'SELECT permissions FROM roles WHERE id = ?',
        [user.role_id]
      );
      if (roles.length > 0 && roles[0].permissions) {
        try {
          permissions = typeof roles[0].permissions === 'string'
            ? JSON.parse(roles[0].permissions)
            : roles[0].permissions;
        } catch (e) {
          console.error('Error parsing permissions:', e);
        }
      }
    }

    // Also fetch company info if applicable
    let company = null;
    if (user.company_id) {
      const [companies] = await pool.execute('SELECT id, name, slug FROM companies WHERE id = ?', [user.company_id]);
      if (companies.length > 0) company = companies[0];
    }

    res.json({
      success: true,
      user: { ...user, permissions },
      company: company
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Email transporter configuration moved to top


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

// Submit Feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const { order_id, customer_id, rating, comments } = req.body;

    // Validate if order exists
    const [orders] = await pool.execute('SELECT id, company_id FROM orders WHERE id = ?', [order_id]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const company_id = orders[0].company_id;

    // Save feedback (Assuming a 'feedback' table exists, if not create it or store in orders table)
    // For simplicity, let's update the orders table if columns exist, or create a separate table.
    // Let's create a feedback table if not exists in schema update, but for now safely check.

    // Use schema update check in startup, or lazy create here for robustness
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT,
        customer_id INT,
        company_id INT,
        rating INT,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    await pool.execute(
      'INSERT INTO feedback (order_id, customer_id, company_id, rating, comments) VALUES (?, ?, ?, ?, ?)',
      [order_id, customer_id || null, company_id, rating, comments]
    );

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ success: false, message: 'Failed to submit feedback' });
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
    const { branch_id } = req.query;

    let query = `
    SELECT *,
      current_stock as quantity,
      min_stock_level as threshold 
      FROM ingredients 
      WHERE company_id = ?`;

    const params = [company_id];

    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND (branch_id = ? OR branch_id IS NULL)';
      params.push(branch_id);
    }

    query += ' ORDER BY name';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ingredients', error: error.message });
  }
});

app.post('/api/ingredients', authenticateToken, async (req, res) => {
  try {
    const { name, quantity, unit, threshold, current_stock, min_stock_level, cost_per_unit, branch_id } = req.body;
    const { company_id } = req.user;
    console.log(`Creating ingredient for company_id: ${company_id} branch_id: ${branch_id}`);

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
      'INSERT INTO ingredients (name, current_stock, unit, min_stock_level, cost_per_unit, company_id, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, stock, unit, minStock, cost, company_id, branch_id || null]
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
    const { name, quantity, unit, threshold, current_stock, min_stock_level, cost_per_unit, branch_id } = req.body;
    const { company_id } = req.user;

    // Validation
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!unit) return res.status(400).json({ success: false, message: 'Unit is required' });

    const stock = quantity !== undefined ? quantity : (current_stock !== undefined ? current_stock : 0);
    const minStock = threshold !== undefined ? threshold : (min_stock_level !== undefined ? min_stock_level : 0);
    const cost = cost_per_unit !== undefined ? cost_per_unit : 0.00;

    const [result] = await pool.execute(
      'UPDATE ingredients SET name = ?, current_stock = ?, unit = ?, min_stock_level = ?, cost_per_unit = ?, branch_id = ? WHERE id = ? AND company_id = ?',
      [name, stock, unit, minStock, cost, branch_id || null, req.params.id, company_id]
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

    console.log('[CANCEL ORDER] Order:', req.params.id, 'User:', req.user?.id);

    // Resolve company_id (same as order status update)
    let company_id = null;
    if (req.company && req.company.id) {
      company_id = req.company.id;
    }
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
    }
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
    }

    // Get from order if needed
    if (!company_id) {
      const [orderRows] = await pool.execute('SELECT company_id FROM orders WHERE id = ?', [req.params.id]);
      if (orderRows.length > 0) {
        company_id = orderRows[0].company_id;
      }
    }

    console.log('[CANCEL ORDER] Resolved company_id:', company_id);

    // Verify ownership (check if order exists for this company)
    const [existing] = await pool.execute('SELECT id FROM orders WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (existing.length === 0) {
      console.log('[CANCEL ORDER] Order not found or access denied');
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    // Update order status (using parameterized query)
    await pool.execute('UPDATE orders SET order_status = ? WHERE id = ?', ['cancelled', req.params.id]);
    // Log cancellation (skip if table doesn't exist)
    try {
      await pool.execute(
        'INSERT INTO order_cancellations (order_id, reason, cancelled_by) VALUES (?, ?, ?)',
        [req.params.id, reason, cancelled_by]
      );
    } catch (logError) {
      console.log('[CANCEL ORDER] Could not log to order_cancellations table:', logError.message);
    }
    // Emit socket event for Kitchen Display System
    io.emit('order-status-updated', {
      id: req.params.id,
      order_status: 'cancelled',
      updated_at: new Date()
    });

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel order', error: error.message });
  }
});

app.post('/api/orders/:id/items/:itemId/cancel', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const orderId = req.params.id;
    const { reason, cancelled_by } = req.body;

    console.log('[CANCEL ITEM] Order:', orderId, 'Item:', req.params.itemId, 'User:', req.user?.id);

    // Resolve company_id
    let company_id = null;
    if (req.company && req.company.id) {
      company_id = req.company.id;
    }
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
    }
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
    }

    // Get from order if needed
    if (!company_id) {
      const [orderRows] = await connection.execute('SELECT company_id FROM orders WHERE id = ?', [orderId]);
      if (orderRows.length > 0) {
        company_id = orderRows[0].company_id;
      }
    }

    console.log('[CANCEL ITEM] Resolved company_id:', company_id);

    // Verify ownership
    const [existing] = await connection.execute('SELECT id FROM orders WHERE id = ? AND company_id = ?', [orderId, company_id]);
    if (existing.length === 0) {
      await connection.rollback();
      console.log('[CANCEL ITEM] Order not found or access denied');
      return res.status(404).json({ success: false, message: 'Order not found or access denied' });
    }

    // Delete the item (since item_status column doesn't exist)
    await connection.execute(
      'DELETE FROM order_items WHERE id = ? AND order_id = ?',
      [req.params.itemId, orderId]
    );

    // Recalculate order total
    const [remainingItems] = await connection.execute(
      'SELECT SUM(price_inr * quantity) as total_inr, SUM(price_usd * quantity) as total_usd FROM order_items WHERE order_id = ?',
      [orderId]
    );

    if (remainingItems[0].total_inr === null) {
      // No items left - cancel entire order
      await connection.execute('UPDATE orders SET order_status = ? WHERE id = ?', ['cancelled', orderId]);
    } else {
      // Update order total
      await connection.execute(
        'UPDATE orders SET total_amount_inr = ?, total_amount_usd = ? WHERE id = ?',
        [remainingItems[0].total_inr || 0, remainingItems[0].total_usd || 0, orderId]
      );
    }

    // Log cancellation (skip if table doesn't exist)
    try {
      await connection.execute(
        'INSERT INTO order_cancellations (order_id, item_id, reason, cancelled_by) VALUES (?, ?, ?, ?)',
        [orderId, req.params.itemId, reason, cancelled_by]
      );
    } catch (logError) {
      console.log('[CANCEL ITEM] Could not log to order_cancellations table:', logError.message);
    }

    await connection.commit();

    // Emit socket event for Kitchen Display System
    io.emit('order-status-updated', {
      id: orderId,
      // We don't change the main order status here, but the KDS might need to refresh
      // For now, let's just emit an update signal or the full order object if feasible
      // Ideally fetch updated order and emit it
      updated_at: new Date()
    });

    // Better: Emit a specific 'item-cancelled' event or just generic 'order-updated'
    // Fetch the updated order to send full details
    const [updatedOrderRows] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (updatedOrderRows.length > 0) {
      // Also fetch items to show updated status
      const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      updatedOrderRows[0].items = items;
      io.emit('order-updated', updatedOrderRows[0]);
    }

    res.json({ success: true, message: 'Item cancelled successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error cancelling item:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel item', error: error.message });
  } finally {
    connection.release();
  }
});

// Support Ticket API

// Create Ticket
app.post('/api/support/ticket', async (req, res) => {
  try {
    const { name, email, subject, message, user_id } = req.body;
    let company_id = null;

    // Try to get company context
    if (req.user && req.user.company_id) {
      company_id = req.user.company_id;
    } else {
      // Fallback for public/guest tickets
      company_id = 1; // Default to main company if unknown
    }

    // Generate Message ID for Threading
    const messageId = `<${Date.now()}.${crypto.randomBytes(4).toString('hex')}@endofhunger.com>`;

    // Insert Ticket
    const [result] = await pool.execute(
      'INSERT INTO support_tickets (user_id, company_id, name, email, subject, message_id) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id || null, company_id, name, email, subject, messageId]
    );

    const ticketId = result.insertId;

    // Insert first message
    await pool.execute(
      'INSERT INTO support_messages (ticket_id, sender_role, message) VALUES (?, ?, ?)',
      [ticketId, 'user', message]
    );

    // Send Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log(`[SUPPORT] Attempting to send ticket email to ${email}`);

      const mailOptions = {
        from: `EndOfHunger Support <${process.env.EMAIL_USER}>`,
        to: email, // Send explicitly to user
        subject: `[Ticket #${ticketId}] ${subject}`,
        html: getSupportTicketTemplate(ticketId, name, subject, message),
        messageId: messageId,
        headers: {
          'References': messageId
        }
      };

      // Send asynchronously (don't block response)
      transporter.sendMail(mailOptions).catch(err => console.error('Failed to send support email:', err));
    }

    res.json({ success: true, ticketId, message: 'Ticket created successfully' });

  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
});

// Reply to Ticket
app.post('/api/support/ticket/:id/reply', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { message, sender_role } = req.body; // 'user' or 'admin'

    await pool.execute(
      'INSERT INTO support_messages (ticket_id, sender_role, message) VALUES (?, ?, ?)',
      [ticketId, sender_role || 'user', message]
    );

    // Fetch ticket details for email
    const [tickets] = await pool.execute('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
    if (tickets.length > 0) {
      const ticket = tickets[0];

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log(`[SUPPORT] Attempting to send reply email to ${ticket.email}`);

        // Threading Headers

        // Threading Headers
        const originalMessageId = ticket.message_id;
        const replyMessageId = `<${Date.now()}.${crypto.randomBytes(4).toString('hex')}@endofhunger.com>`;

        const mailOptions = {
          from: `EndOfHunger Support <${process.env.EMAIL_USER}>`,
          to: ticket.email,
          subject: `Re: [Ticket #${ticketId}] ${ticket.subject}`,
          html: getSupportReplyTemplate(ticketId, ticket.name, "Context Message", message),
          messageId: replyMessageId,
          inReplyTo: originalMessageId,
          references: originalMessageId
        };

        transporter.sendMail(mailOptions).catch(err => console.error('Failed to send reply email:', err));
      }
    }

    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to reply' });
  }
});

// Get Tickets (User)

// Company Profile Endpoints
app.get('/api/company/profile', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [company_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch company profile', error: error.message });
  }
});

app.put('/api/company/profile', authenticateToken, async (req, res) => {
  try {
    const { name, logo_url, banner_url } = req.body;
    const { company_id } = req.user;

    console.log('[PROFILE UPDATE] Company:', company_id);
    console.log('[PROFILE UPDATE] Name:', name);
    console.log('[PROFILE UPDATE] Logo:', logo_url);
    console.log('[PROFILE UPDATE] Banner:', banner_url);

    const [result] = await pool.execute(
      'UPDATE companies SET name = ?, logo_url = ?, banner_url = ? WHERE id = ?',
      [name, logo_url, banner_url, company_id]
    );

    console.log('[PROFILE UPDATE] Rows affected:', result.affectedRows);

    const [rows] = await pool.execute('SELECT * FROM companies WHERE id = ?', [company_id]);

    console.log('[PROFILE UPDATE] Updated company:', rows[0]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[PROFILE UPDATE] ERROR:', error.message);
    console.error('[PROFILE UPDATE] Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to update company profile', error: error.message });
  }
});

app.get('/api/company/public', resolveCompany, async (req, res) => {
  try {
    if (!req.company) {
      // Return null data instead of 404 to avoid frontend console errors
      return res.json({ success: true, data: null });
    }
    // Return safe public info
    res.json({
      success: true,
      data: {
        id: req.company.id,
        name: req.company.name,
        slug: req.company.slug,
        logo_url: req.company.logo_url || '',
        banner_url: req.company.banner_url || ''
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Staff Endpoints
app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT * FROM staff WHERE company_id = ?', [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
  try {
    const { name, role, pin, email, phone } = req.body;
    const { company_id } = req.user;
    const [resDb] = await pool.execute(
      'INSERT INTO staff (name, role, pin, email, phone, company_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name || null, role || null, pin || null, email || null, phone || null, company_id]
    );
    const [newStaff] = await pool.execute('SELECT * FROM staff WHERE id = ?', [resDb.insertId]);
    res.json({ success: true, data: newStaff[0] });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    // Verify ownership
    const [exists] = await pool.execute('SELECT id FROM staff WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (exists.length === 0) return res.status(404).json({ success: false, message: 'Staff not found' });
    await pool.execute('DELETE FROM staff WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Staff deleted' });
  } catch (e) {
    console.error('Error deleting staff:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/staff/leaves', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT sl.*, s.name as staff_name FROM staff_leaves sl JOIN staff s ON sl.staff_id = s.id WHERE sl.company_id = ?', [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/staff/leaves/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { company_id } = req.user;
    // Verify ownership via join or subquery
    await pool.execute('UPDATE staff_leaves SET status = ? WHERE id = ? AND company_id = ?', [status, req.params.id, company_id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Roles Endpoints
app.get('/api/roles', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT * FROM roles WHERE company_id = ?', [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



app.post('/api/roles', authenticateToken, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const { company_id } = req.user;
    const [resDb] = await pool.execute(
      'INSERT INTO roles (name, permissions, company_id) VALUES (?, ?, ?)',
      [name, JSON.stringify(permissions), company_id]
    );
    const [newRole] = await pool.execute('SELECT * FROM roles WHERE id = ?', [resDb.insertId]);
    res.json({ success: true, data: newRole[0] });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    const { company_id } = req.user;
    await pool.execute(
      'UPDATE roles SET name = ?, permissions = ? WHERE id = ? AND company_id = ?',
      [name, JSON.stringify(permissions), req.params.id, company_id]
    );
    const [updated] = await pool.execute('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/roles/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [exists] = await pool.execute('SELECT id FROM roles WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (exists.length === 0) return res.status(404).json({ success: false });
    await pool.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting role:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Users Endpoints
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [rows] = await pool.execute('SELECT id, full_name, email, phone, role, role_id FROM users WHERE company_id = ?', [company_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { full_name, email, password, phone, role_id, role } = req.body;
    const { company_id } = req.user;

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [resDb] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, phone, role, role_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [full_name, email, passwordHash, phone, role || 'staff', role_id || null, company_id]
    );

    const [newUser] = await pool.execute('SELECT id, full_name, email, phone, role, role_id FROM users WHERE id = ?', [resDb.insertId]);
    res.json({ success: true, data: newUser[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { full_name, email, phone, role_id, role } = req.body;
    const { company_id } = req.user;

    // Check if password update is requested? (Assuming not for now, or minimal update)
    await pool.execute(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, role_id = ? WHERE id = ? AND company_id = ?',
      [full_name, email, phone, role, role_id, req.params.id, company_id]
    );

    const [updated] = await pool.execute('SELECT id, full_name, email, phone, role, role_id FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const [exists] = await pool.execute('SELECT id FROM users WHERE id = ? AND company_id = ?', [req.params.id, company_id]);
    if (exists.length === 0) return res.status(404).json({ success: false });
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Error deleting user:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// BRANCH MANAGEMENT ENDPOINTS
// ============================================

// GET /api/branches - Get all branches for the company
app.get('/api/branches', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    const [branches] = await pool.execute(
      `SELECT id, name, address, phone, manager_name, is_active, created_at, updated_at
       FROM branches 
       WHERE company_id = ?
       ORDER BY created_at DESC`,
      [company_id]
    );

    res.json({ success: true, data: branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/branches - Create new branch
app.post('/api/branches', authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, manager_name, is_active } = req.body;
    const { company_id } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Branch name is required' });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM branches WHERE company_id = ? AND name = ?',
      [company_id, name.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'A branch with this name already exists' });
    }

    const [result] = await pool.execute(
      `INSERT INTO branches (company_id, name, address, phone, manager_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [company_id, name.trim(), address || null, phone || null, manager_name || null, is_active !== false]
    );

    const [newBranch] = await pool.execute(
      'SELECT id, name, address, phone, manager_name, is_active, created_at, updated_at FROM branches WHERE id = ?',
      [result.insertId]
    );

    console.log('[BRANCH] Created:', newBranch[0].name);
    res.json({ success: true, data: newBranch[0] });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/branches/:id - Update branch
app.put('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const { name, address, phone, manager_name, is_active } = req.body;
    const { company_id } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Branch name is required' });
    }

    const [exists] = await pool.execute(
      'SELECT id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.id, company_id]
    );

    if (exists.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const [duplicate] = await pool.execute(
      'SELECT id FROM branches WHERE company_id = ? AND name = ? AND id != ?',
      [company_id, name.trim(), req.params.id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({ success: false, message: 'A branch with this name already exists' });
    }

    await pool.execute(
      `UPDATE branches SET name = ?, address = ?, phone = ?, manager_name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [name.trim(), address || null, phone || null, manager_name || null, is_active !== false, req.params.id, company_id]
    );

    const [updated] = await pool.execute(
      'SELECT id, name, address, phone, manager_name, is_active, created_at, updated_at FROM branches WHERE id = ?',
      [req.params.id]
    );

    console.log('[BRANCH] Updated:', updated[0].name);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/branches/:id - Delete branch
app.delete('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    const [exists] = await pool.execute(
      'SELECT id, name FROM branches WHERE id = ? AND company_id = ?',
      [req.params.id, company_id]
    );

    if (exists.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const [menuCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM menu_items WHERE branch_id = ?',
      [req.params.id]
    );
    const [orderCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM orders WHERE branch_id = ?',
      [req.params.id]
    );

    if (menuCount[0].count > 0 || orderCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch. It has ${menuCount[0].count} menu items and ${orderCount[0].count} orders.`
      });
    }

    await pool.execute('DELETE FROM branches WHERE id = ?', [req.params.id]);
    console.log('[BRANCH] Deleted:', exists[0].name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/branches/:id - Get single branch with stats
app.get('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;

    const [branch] = await pool.execute(
      `SELECT id, name, address, phone, manager_name, is_active, created_at, updated_at
       FROM branches WHERE id = ? AND company_id = ?`,
      [req.params.id, company_id]
    );

    if (branch.length === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const [menuCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM menu_items WHERE branch_id = ?',
      [req.params.id]
    );
    const [orderCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM orders WHERE branch_id = ?',
      [req.params.id]
    );
    const [ingredientCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM ingredients WHERE branch_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...branch[0],
        stats: {
          menu_items: menuCount[0].count,
          orders: orderCount[0].count,
          ingredients: ingredientCount[0].count
        }
      }
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Orders (Customer) - Simplified for reliability
app.get('/api/customer/orders', authenticateToken, async (req, res) => {
  try {
    console.log('[ORDERS] Starting customer orders fetch...');
    console.log('[ORDERS] User:', req.user?.id, 'Company from user:', req.user?.company_id);
    console.log('[ORDERS] req.company:', req.company?.id);
    console.log('[ORDERS] Headers - Host:', req.headers.host, 'Origin:', req.headers.origin);

    // Determine company_id with comprehensive fallback
    let company_id = null;

    // Priority 1: From resolved middleware
    if (req.company && req.company.id) {
      company_id = req.company.id;
      console.log('[ORDERS] Using company from middleware:', company_id);
    }

    // Priority 2: From header
    if (!company_id && req.headers['x-company-id']) {
      company_id = parseInt(req.headers['x-company-id']);
      console.log('[ORDERS] Using company from header:', company_id);
    }

    // Priority 3: From authenticated user
    if (!company_id && req.user && req.user.company_id) {
      company_id = req.user.company_id;
      console.log('[ORDERS] Using company from user:', company_id);
    }

    // Priority 4: Database fallback
    if (!company_id) {
      console.log('[ORDERS] No company found, attempting database fallback...');
      try {
        const [companies] = await pool.execute(
          'SELECT id FROM companies WHERE logo_url IS NOT NULL AND banner_url IS NOT NULL ORDER BY id DESC LIMIT 1'
        );
        if (companies.length > 0) {
          company_id = companies[0].id;
          console.log('[ORDERS] Fallback company:', company_id);
        }
      } catch (dbError) {
        console.error('[ORDERS] Database fallback failed:', dbError.message);
      }
    }

    // Validate we have a company_id
    if (!company_id || isNaN(company_id) || company_id <= 0) {
      console.log('[ORDERS] No valid company_id, returning empty array');
      return res.json({ success: true, data: [] });
    }

    console.log('[ORDERS] Fetching orders for user:', req.user.id, 'company:', company_id);

    // Simplified query without subquery to avoid potential issues
    const [orders] = await pool.execute(
      'SELECT o.* FROM orders o WHERE o.customer_id = ? AND o.company_id = ? ORDER BY o.created_at DESC',
      [req.user.id, company_id]
    );

    console.log('[ORDERS] Found', orders.length, 'orders');

    // Fetch items for each order
    for (const order of orders) {
      try {
        const [items] = await pool.execute(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        order.items = items || [];

        // Check for feedback separately (this won't break if feedback table doesn't exist)
        try {
          const [feedback] = await pool.execute(
            'SELECT COUNT(*) as count FROM feedback WHERE order_id = ?',
            [order.id]
          );
          order.has_feedback = feedback[0].count > 0;
        } catch (feedbackError) {
          // Feedback table might not exist, that's OK
          order.has_feedback = false;
        }
      } catch (itemError) {
        console.error('[ORDERS] Error fetching items for order', order.id, ':', itemError.message);
        order.items = [];
      }
    }

    console.log('[ORDERS] Returning', orders.length, 'orders with items');
    res.json({ success: true, data: orders });

  } catch (error) {
    console.error('[ORDERS] CRITICAL ERROR:', error.message);
    console.error('[ORDERS] Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Image Upload Endpoint - Using Cloudinary (works on Render/Vercel)
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('[UPLOAD] File received:', req.file.originalname, 'Size:', req.file.size);

    // Convert image to base64 for database storage
    // This is stored directly in the database, so it persists on Render
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    console.log('[UPLOAD] Converted to base64, length:', base64Image.length);

    // Return base64 string - this will be saved directly in the database
    res.json({
      success: true,
      url: base64Image
    });

  } catch (error) {
    console.error('[UPLOAD] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/support/tickets', async (req, res) => {
  try {
    const { user_id, email } = req.query;
    let query = 'SELECT * FROM support_tickets WHERE ';
    let params = [];

    if (user_id) {
      query += 'user_id = ?';
      params.push(user_id);
    } else if (email) {
      query += 'email = ?';
      params.push(email);
    } else {
      return res.json({ success: true, data: [] });
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
});

// Get Ticket Details
app.get('/api/support/ticket/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const [messages] = await pool.execute(
      'SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Global error handling middleware - MUST be the last middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;

// Initialize and start server
const startServer = async () => {
  try {
    // Test database connection first
    const dbConnected = await testDatabaseConnection();

    if (dbConnected) {
      console.log('Database connected, checking schema...');
      await updateDatabaseSchema();
    } else {
      console.log('Warning: Database connection failed, but server will continue running...');
    }

    httpServer.listen(PORT, '0.0.0.0', async () => {
      console.log(`Server is running and accessible on the network at port ${PORT} `);
      console.log(`API endpoints available at http://localhost:${PORT}/api`);
      console.log('Allowed origins:', allowedOrigins);

      // Initialize database after server starts
      await initializeDatabase();
      await updateDatabaseSchema(); // Run schema updates explicitly after init

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