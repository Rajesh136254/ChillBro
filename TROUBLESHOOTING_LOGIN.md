# Troubleshooting Login Issues for Role-Based Users

## Issue
Users created via Admin Panel (with roles assigned) cannot login via SignupPage.js

## How to Debug

### Step 1: Check Backend Logs
When you try to login, check the backend terminal/console. You should see logs like:
```
[LOGIN] Attempt for email: test@example.com
[LOGIN] User found: { id: 5, email: 'test@example.com', role: 'staff', company_id: 1, has_role_id: true }
[LOGIN] Password matched for email: test@example.com
[LOGIN] Permissions loaded for role_id: 2, { kitchen: true, ingredients: true }
```

### Step 2: Identify the Issue

#### ❌ If you see: `[LOGIN] User not found for email: xxx`
**Problem**: Email doesn't exist in database or there's a typo
**Solution**: 
- Check the exact email in the database
- Ensure there are no leading/trailing spaces
- Email comparison is case-sensitive in some databases

```sql
-- Check if user exists
SELECT id, email, full_name, role, company_id, role_id 
FROM users 
WHERE email = 'your-test-email@example.com';
```

#### ❌ If you see: `[LOGIN] Password mismatch for email: xxx`
**Problem**: Password doesn't match
**Solutions**:
1. **You likely entered a different password than what you saved**
2. The password in database should be a bcrypt hash starting with `$2b$10$...`
3. You can **reset the password** with this SQL:

```sql
-- Generate new password hash for 'test123'
-- First, generate hash using bcrypt (use online tool or node script)
-- Hash for 'test123': $2b$10$rOZhZxjFGECm3EoK.KzH4.nKZf4f3d9uIUe1JdzJTfpZqmKqQjW2G

UPDATE users 
SET password_hash = '$2b$10$rOZhZxjFGECm3EoK.KzH4.nKZf4f3d9uIUe1JdzJTfpZqmKqQjW2G'
WHERE email = 'your-test-email@example.com';
```

Or use this Node.js script to generate a hash:
```javascript
const bcrypt = require('bcrypt');
const password = 'test123';
const hash = bcrypt.hashSync(password, 10);
console.log('Password hash:', hash);
```

#### ✅ If login succeeds but you see wrong company logo/banner:
**Problem**: Multitenancy issue
**Solution**: Make sure you're logged into the right company. Each user has a `company_id` that determines which company's data they see.

### Step 3: Manual Password Reset (Recommended)

If password mismatch is the issue, here's the safest way to reset it:

1. **Stop the backend server**

2. **Run this script** in your backend directory:

Create file `reset-password.js`:
```javascript
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const resetPassword = async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false }
  });

  // CHANGE THESE VALUES
  const email = 'kitchen@test.com';  // ← Change to your user's email
  const newPassword = 'test123';      // ← Change to desired password

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, email]
    );
    console.log(`✅ Password reset successful for ${email}`);
    console.log(`   New password: ${newPassword}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetPassword();
```

3. **Run it**:
```bash
cd backend
node reset-password.js
```

4. **Try logging in** with the new password

## Common Issues & Solutions

### Issue: "Invalid email or password" even with correct credentials
**Causes**:
1. Email has extra spaces: `" test@example.com"` vs `"test@example.com"`
2. Password has invisible characters
3. Database connection is to wrong database

**Fix**:
```sql
-- Check for spaces in email
SELECT id, email, CONCAT('[', email, ']') as email_with_brackets 
FROM users 
WHERE email LIKE '%test@example.com%';

-- If spaces found, clean them:
UPDATE users SET email = TRIM(email) WHERE email LIKE '% %';
```

### Issue: Login works but wrong permissions/company shown
**Cause**: User's `company_id` or `role_id` is wrong

**Fix**:
```sql
-- Check user's company and role
SELECT u.id, u.email, u.role, u.role_id, u.company_id,
       r.name as role_name, r.permissions,
       c.name as company_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.email = 'test@example.com';

-- Fix if needed:
UPDATE users 
SET company_id = 1, role_id = 2  -- Use correct IDs
WHERE email = 'test@example.com';
```

## Test Checklist

Before reporting a bug, verify:

- [ ] User exists in database (check with SQL)
- [ ] Email is EXACTLY correct (no spaces, correct case)
- [ ] Password hash in database starts with `$2b$10$`
- [ ] User has valid `company_id` (not NULL)
- [ ] If role-based user: `role_id` points to existing role
- [ ] Role has valid `permissions` JSON
- [ ] Backend server is running and connected to correct database
- [ ] No CORS errors in browser console
- [ ] Checked backend logs for debug messages

## Quick Verification Query

Run this to see all your test users:
```sql
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  r.name as role_name,
  r.permissions,
  c.name as company_name,
  LEFT(u.password_hash, 20) as password_preview
FROM users u
LEFT JOIN roles r ON u.role_id = r.id  
LEFT JOIN companies c ON u.company_id = c.id
WHERE u.role != 'customer'
ORDER BY u.created_at DESC;
```

This shows:
- All non-customer users
- Their assigned roles and permissions
- Which company they belong to
- First 20 chars of password hash (to verify it's hashed)

## Still Not Working?

If none of the above helps, share:
1. Backend console logs (the [LOGIN] messages)
2. The SQL query result from "Quick Verification Query"
3. Exact email and password you're trying
4. Any browser console errors
