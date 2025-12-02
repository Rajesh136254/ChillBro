# Multi-Tenant SaaS Implementation Guide

## Overview
This document outlines the implementation of subdomain-based multi-tenancy for the restaurant QR ordering system. Each company will have its own subdomain (e.g., `companyname.vercel.app`).

## ✅ Completed Tasks

### 1. Database Schema Updates
- ✅ Added `slug` field to `companies` table (URL-friendly identifier)
- ✅ Added `domain` field for custom domain support
- ✅ All tables already have `company_id` foreign keys

### 2. Utility Functions Created
- ✅ Created `backend/lib/slug-utils.js` - Functions to generate URL-friendly slugs
- ✅ Created `backend/lib/subdomain-middleware.js` - Middleware to extract company from subdomain

## 🔄 Tasks To Implement

### 3. Update server.js

#### A. Add Missing Imports
At the top of `server.js`, after existing requires, add:

```javascript
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
```

#### B. Add Subdomain Middleware
After the pool creation and before existing middlewares, add:

```javascript
// Subdomain Multi-Tenancy Middleware
const { subdomainMiddleware } = require('./lib/subdomain-middleware');
app.use(subdomainMiddleware(pool));
```

#### C. Update Registration Endpoint
Replace the `/api/auth/register` endpoint with:

```javascript
app.post('/api/auth/register', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, password, company_name } = req.body;

    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) { 
      await conn.rollback(); 
      return res.status(400).json({ message: 'User already exists' }); 
    }

    // Generate unique slug for the company
    const { generateUniqueSlug, getSubdomainUrl } = require('./lib/slug-utils');
    const companyBaseName = company_name || `${name}'s Company`;
    const slug = await generateUniqueSlug(conn, companyBaseName);
    
    // Create company with slug
    const [compRes] = await conn.execute(
      'INSERT INTO companies (name, slug) VALUES (?, ?)', 
      [companyBaseName, slug]
    );
    const companyId = compRes.insertId;

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (name, email, password, company_id, role) VALUES (?, ?, ?, ?, ?)', 
      [name, email, hashedPassword, companyId, 'admin']
    );
    const userId = userRes.insertId;

    await conn.execute(
      'INSERT INTO table_groups (name, company_id) VALUES (?, ?)', 
      ['Non AC', companyId]
    );

    await conn.commit();

    // Get the subdomain URL
    const baseDomain = process.env.BASE_DOMAIN || 'vercel.app';
    const subdomainUrl = getSubdomainUrl(slug, baseDomain);

    const token = jwt.sign(
      { userId, email, role: 'admin', companyId, companySlug: slug }, 
      process.env.JWT_SECRET || 'your_jwt_secret', 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      token, 
      user: { id: userId, name, email, role: 'admin', companyId }, 
      company: { id: companyId, name: companyBaseName, slug, subdomainUrl, baseDomain } 
    });
  } catch (e) { 
    await conn.rollback(); 
    res.status(500).json({ error: e.message }); 
  } finally { 
    conn.release(); 
  }
});
```

#### D. Update Login Endpoint
Add company slug to login response:

```javascript
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.execute(
      'SELECT u.*, c.slug as company_slug FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.email = ?', 
      [email]
    );
    if (users.length === 0) return res.status(400).json({ message: 'User not found' });

    const user = users[0];
    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, companyId: user.company_id, companySlug: user.company_slug }, 
        process.env.JWT_SECRET || 'your_jwt_secret', 
        { expiresIn: '24h' }
      );
      
     const baseDomain = process.env.BASE_DOMAIN || 'vercel.app';
      const { getSubdomainUrl } = require('./lib/slug-utils');
      const subdomainUrl = user.company_slug ? getSubdomainUrl(user.company_slug, baseDomain) : null;
      
      res.json({ 
        success: true, 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          companyId: user.company_id,
          companySlug: user.company_slug 
        },
        company: user.company_slug ? { slug: user.company_slug, subdomainUrl, baseDomain } : null
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});
```

### 4. Environment Variables
Add to `backend/.env`:
```
BASE_DOMAIN=vercel.app
```

Later, when custom domain is configured, update to:
```
BASE_DOMAIN=yourdomain.com
```

### 5. Vercel Configuration
Create `vercel.json` in the root of dineflowreact folder:

```json
{
  "version": 2,
  "build": {
    "env": {
      "REACT_APP_API_URL": "https://dineflowbackend.onrender.com",
      "REACT_APP_BASE_DOMAIN": "vercel.app"
    }
  },
  "routes": [
    {
      "src": "/(.*)  ",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 📋 Testing Steps

### After Implementation:

1. **Test Registration**:
   - Register a new company
   - Response should include `company.slug` and `company.subdomainUrl`
   - Example: Company "Test Restaurant" → slug: "test-restaurant", URL: "test-restaurant.vercel.app"

2. **Test Login**:
   - Login with the registered user
   - Response should include company slug and subdomain URL

3. **Test Subdomain (After Vercel DNS)**:
   - Access `https://test-restaurant.vercel.app`
   - Should load the app scoped to that company's data

## 🚀 Deployment Steps

### Backend:
1. Deploy updated `database.sql` (creates slug column)
2. Deploy updated `server.js` with new middleware
3. Deploy lib files
4. Add `BASE_DOMAIN` to environment variables

### Frontend (Later - After Backend Works):
1. Update registration page to show subdomain URL after signup
2. Update login to redirect to company subdomain
3. Deploy `vercel.json` configuration
4. Configure Vercel wildcard domain: `*.vercel.app`

### DNS Configuration (Final Step):
1. In Vercel, add custom domain
2. Update `BASE_DOMAIN` environment variable
3. Configure wildcard DNS: `*.yourdomain.com` → Vercel
4. Test with `companyname.yourdomain.com`

## 🔒 Data Isolation

The middleware automatically:
- Extracts subdomain from hostname
- Looks up company by slug
- Sets `req.companyId` for all subsequent queries
- All existing endpoints already filter by `company_id`

## 📝 Notes

1. **No INSERT Statements**: The `database.sql` file contains ONLY `CREATE TABLE` statements - no dummy data
2. **Forgot Password**: Already implemented with reset tokens (console logging for now)
3. **Company Info**: Shows subdomain URL to users after registration
4. **Backwards Compatible**: System still works without subdomain (uses default company_id)

## Next Steps
1. Apply server.js changes carefully
2. Test locally first
3. Deploy to production
4. Set up Vercel wildcard subdomain
