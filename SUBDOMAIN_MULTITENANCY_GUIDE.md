# Subdomain-Based Multitenancy Implementation

## Overview
The system now implements **true subdomain-based multitenancy** where each company gets its own subdomain/site.

## How It Works

### 1. **Signup Flow**
When a new admin signs up:

1. **Email**: `ma@gmail.com`
2. **Company Slug Created**: `ma` (extracted from email before @)
3. **Company Created** in database with:
   - `name`: "Full Name's Restaurant"
   - `slug`: `ma`
   - `domain`: `ma.vercel.app` (for production)

4. **Redirect**:
   - **Localhost**: `http://ma.localhost:3000/homepage?token=xxx`
   - **Production**: `http://ma.yourdomain.com/homepage?token=xxx`

### 2. **Login Flow**
When a user logs in:

1. Backend finds user and their `company_id`
2. Backend fetches company details (including `slug`)
3. Returns company info in login response
4. **Frontend Redirects**:
   - **Localhost**: `http://{company.slug}.localhost:3000/homepage?token=xxx`
   - **Production**: `http://{company.slug}.yourdomain.com/homepage?token=xxx`

### 3. **Company Isolation**
Each subdomain shows ONLY that company's data:

- **ma.localhost:3000** → Shows only Company "ma"'s:
  - Menu items
  - Tables
  - Orders
  - Staff
  - Logo/Banner
  
- **raju.localhost:3000** → Shows only Company "raju"'s data

## Testing on Localhost

### Step 1: Sign Up a New Admin
```
1. Go to: http://localhost:3000/signup
2. Full Name: "Mahesh Kumar"
3. Email: "ma@gmail.com"
4. Password: "test12345"
5. Click "Create Account"
```

### Step 2: Automatic Redirect
```
- After signup, you'll be redirected to: http://ma.localhost:3000/homepage
- This is YOUR company's site!
```

### Step 3: Sign Up Another Admin (Different Company)
```
1. Open incognito/private window
2. Go to: http://localhost:3000/signup
3. Full Name: "Raju Sharma"
4. Email: "raju@gmail.com"
5. Password: "test12345"
6. Click "Create Account"
```

### Step 4: See Different Site
```
- After signup, you'll be redirected to: http://raju.localhost:3000/homepage
- This is a DIFFERENT company's site!
- Completely separate data from "ma"
```

### Step 5: Verify Data Isolation
```
1. In ma.localhost:3000 - Add some menu items
2. In raju.localhost:3000 - Add different menu items
3. Verify each company sees ONLY their own items
```

## How Subdomain Routing Works

### On Localhost:
Browser natively supports `*.localhost` subdomains:
- `http://localhost:3000` → Main signup/login page
- `http://ma.localhost:3000` → Company "ma"'s site
- `http://raju.localhost:3000` → Company "raju"'s site
- `http://anything.localhost:3000` → Any company's site

**No DNS/hosts file changes needed!** This works out of the box.

### On Production:
You need to configure wildcard DNS:
- Main domain: `yourdomain.com`
- Wildcard: `*.yourdomain.com` → Points to your Vercel/server IP
- Then:
  - `ma.yourdomain.com` → Company "ma"
  - `raju.yourdomain.com` → Company "raju"

## Backend: How Company is Resolved

The `resolveCompany` middleware checks:

1. **Subdomain from Origin header**:
   - Request from `http://ma.localhost:3000`
   - Extract subdomain: `ma`
   - Query DB: `SELECT * FROM companies WHERE slug = 'ma'`
   - Attach to request: `req.company = { id: 1, name: "...", slug: "ma" }`

2. **All subsequent API calls use this company**:
   - `GET /api/menu` → Returns menu for `req.company.id`
   - `GET /api/orders` → Returns orders for `req.company.id`
   - etc.

## Database Structure

### Companies Table:
```sql
CREATE TABLE companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE,  -- e.g., "ma", "raju"
  domain VARCHAR(255),        -- e.g., "ma.vercel.app"
  logo_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Users Table (links to company):
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  role_id INT,
  company_id INT,  -- Links user to their company
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

## Example Flow

### Scenario: Two Restaurant Owners

**Owner 1: Mahesh (ma@gmail.com)**
```
1. Signs up → Creates company "ma"
2. Gets redirected to: ma.localhost:3000
3. Adds menu items, tables, staff
4. Invites staff member: kitchen@ma-restaurant.com
5. Staff logs in → Also redirected to ma.localhost:3000
6. Staff sees only "ma" company's data
```

**Owner 2: Raju (raju@gmail.com)**
```
1. Signs up → Creates company "raju"
2. Gets redirected to: raju.localhost:3000
3. Adds different menu items, tables, staff
4. Invites staff member: kitchen@raju-restaurant.com
5. Staff logs in → Also redirected to raju.localhost:3000
6. Staff sees only "raju" company's data
```

**Result**: Two completely isolated restaurant management systems on the same codebase!

## User Login to Correct Company

When user logs in from `http://localhost:3000/signup`:
1. Enters: `kitchen@ma-restaurant.com`
2. Backend finds user's `company_id` (e.g., company_id = 1)
3. Backend fetches company slug: `ma`
4. **Login response includes**:
   ```json
   {
     "success": true,
     "data": { "id": 5, "email": "kitchen@ma-restaurant.com", "token": "..." },
     "company": { "id": 1, "name": "Mahesh Kumar's Restaurant", "slug": "ma" }
   }
   ```
5. Frontend redirects to: `http://ma.localhost:3000/homepage?token=xxx`

## Role-Based Access + Multitenancy

Now you have BOTH:

1. **Company Isolation** (via subdomain):
   - `ma.localhost:3000` shows only Company A's data
   - `raju.localhost:3000` shows only Company B's data

2. **Role-Based Access** (within each company):
   - Super admin → Sees all features
   - Kitchen Manager → Sees only Kitchen + Ingredients
   - Customer → Sees only Customer pages

Example:
- User: `kitchen@ma-restaurant.com`
- Company: `ma` (company_id = 1)
- Role: `Kitchen Manager` (role_id = 2)
- Permissions: `{ kitchen: true, ingredients: true }`
- Site: `http://ma.localhost:3000`
- Can Access: Only Kitchen and Ingredients pages of Company "ma"

## Troubleshooting

### Issue: "localhost:3000 redirecting in loops"
**Solution**: Make sure you're accessing the subdomain correctly:
- ✅ `http://ma.localhost:3000`
- ❌ `http://localhost:3000/ma`

### Issue: "Company not found"
**Check**:
```sql
SELECT * FROM companies WHERE slug = 'ma';
```
If empty, the company wasn't created during signup.

### Issue: "After signup, stuck on signup page"
**Check browser console** for redirect URL. If you see:
```
[SIGNUP] Redirecting to: http://ma.localhost:3000/homepage?token=xxx
```
But it doesn't redirect, check for JavaScript errors or popup blocking.

### Issue: "Can't access subdomain on localhost"
**This should work automatically**, but if not:
- Try different browsers (Chrome, Firefox both support *.localhost)
- Check if port 3000 is accessible: `http://localhost:3000`
- Make sure React dev server is running

## Production Deployment

### For Vercel:
1. Add wildcard domain: `*.yourdomain.com`
2. Point DNS A record: `*` → Vercel IP
3. Backend will automatically create URLs like: `ma.yourdomain.com`

### For Render/Custom Server:
1. Configure wildcard DNS: `*.yourdomain.com` → Server IP
2. Set `FRONTEND_URL` env var: `https://yourdomain.com`
3. Backend will create: `https://ma.yourdomain.com`

## Summary

✅ Each signup creates a new company with unique slug
✅ Users are automatically redirected to their company's subdomain
✅ Each subdomain shows ONLY that company's data
✅ Works seamlessly on localhost with *.localhost
✅ Production ready with wildcard DNS
✅ Combined with role-based permissions for fine-grained access control

**This is true multitenancy!** 🎉
