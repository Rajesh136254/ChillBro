# Login Issue Resolution Guide

## Problem
Users created via Admin Panel (Users tab) cannot login via SignupPage.js showing "Invalid email or password"

## Root Cause Analysis
The issue is most likely **NOT** a multitenancy problem. The system is working correctly. The most common causes are:

1. **Password mismatch** - You might have typed a different password than you remember
2. **Email typo** - Small differences in email address
3. **User doesn't exist** - User wasn't saved properly in database

## Quick Fix Steps

### Step 1: Check if user exists
```bash
cd backend
node check-users.js
```

This will show all your admin/staff users and their details.

### Step 2: Check backend logs
When you try to login, watch the backend terminal. You should see:
```
[LOGIN] Attempt for email: test@example.com
[LOGIN] User found: { id: 5, email: 'test@example.com', role: 'staff', company_id: 1, has_role_id: true }
[LOGIN] Password matched for email: test@example.com
```

**If you see "User not found"**: The email you're entering doesn't match any user in database
**If you see "Password mismatch"**: The password you're entering doesn't match the stored hash

### Step 3: Reset password if needed
```bash
cd backend
node reset-password.js
```

Follow the prompts to:
1. Select the user by email
2. Set a new password
3. Try logging in with the new password

## How Password Hashing Works

When you create a user via Admin Panel:
1. You enter password: `"mypassword123"`
2. Backend hashes it: `"$2b$10$rOZhZxjFGECm3EoK.KzH4.nKZf4f3d9uIUe1JdzJTfpZqmKqQjW2G"`
3. Hash is stored in database

When you login:
1. You enter password: `"mypassword123"`
2. Backend compares it with stored hash using bcrypt
3. If match → Login successful
4. If no match → "Invalid email or password"

**Important**: You must use the EXACT same password you entered when creating the user.

## Multitenancy Explanation

Your system IS using multitenancy correctly:

1. **User Creation**:
   - Admin creates user via Admin Panel
   - User gets assigned the same `company_id` as the admin who created them
   - User gets assigned a `role_id` if a role is selected

2. **Login Process**:
   - User enters email and password
   - Backend finds user by email (works across all companies)
   - Backend verifies password
   - Returns user data WITH their `company_id` and permissions
   - Frontend uses this `company_id` to show correct company logo/banner

3. **After Login**:
   - User sees their own company's branding (based on `company_id` in their profile)
   - User sees only features they have permission for (based on `role_id` and permissions)

**This is working correctly!** The login issue is most likely just a password mismatch.

## Testing the Full Flow

Here's how to test everything end-to-end:

### 1. Create a Test Role
```
1. Login as super admin (existing admin user)
2. Go to HomePage → Admin → Roles tab
3. Create role "Test Kitchen Manager"
4. Enable: Kitchen Display + Ingredients Management
5. Save
```

### 2. Create a Test User
```
1. Go to Users tab
2. Click "Add New User"
3. Full Name: "Test Kitchen User"
4. Email: "kitchen@test.local"  ← Use a simple email
5. Password: "test12345"  ← Use a simple password
6. Phone: (leave blank or enter anything)
7. Role: Select "Test Kitchen Manager"
8. Save
```

### 3. Verify User Created
```bash
cd backend
node check-users.js
```

You should see your new user listed with:
- Email: kitchen@test.local
- Role Name: Test Kitchen Manager
- Company ID: (same as your admin's company_id)
- Password Hash: $2b$10$... (something like this)

### 4. Try Logging In
```
1. Logout from super admin
2. Go to SignupPage (or click Login)
3. Email: kitchen@test.local
4. Password: test12345
5. Click "Log In"
```

### 5. Check Backend Logs
You should see:
```
[LOGIN] Attempt for email: kitchen@test.local
[LOGIN] User found: { id: X, email: 'kitchen@test.local', role: 'staff', company_id: 1, has_role_id: true }
[LOGIN] Password matched for email: kitchen@test.local
[LOGIN] Permissions loaded for role_id: 2, { kitchen: true, ingredients: true }
```

### 6. After Successful Login
- You should be redirected to /homepage
- You should see ONLY "Kitchen Display" and "Ingredients Management" cards
- You should see your company's logo and banner (not some default)
- Header should show your company name

## Common Mistakes

### ❌ Mistake 1: Using different password
**Created with**: "Password123" (capital P)
**Logging in with**: "password123" (lowercase p)
**Result**: Password mismatch

**Fix**: Use EXACT same password, case-sensitive

### ❌ Mistake 2: Email with spaces
**Created**: " test@example.com" (space before)
**Logging in**: "test@example.com" (no space)
**Result**: User not found

**Fix**: Run SQL to clean emails:
```sql
UPDATE users SET email = TRIM(email);
```

### ❌ Mistake 3: Wrong database
**Created user in**: Local MySQL database
**Backend connecting to**: Remote Aiven database
**Result**: User not found

**Fix**: Check `.env` file, ensure DB_HOST/DB_NAME are correct

## Still Having Issues?

If login still fails after trying all the above:

1. **Share backend logs** - Copy the `[LOGIN]` messages from terminal
2. **Share user data** - Run `node check-users.js` and share output
3. **Share exact credentials** - What email and password are you using?
4. **Check database connection** - Is backend connected to the right database?

Run this SQL query and share the result:
```sql
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.role_id,
  u.company_id,
  c.name as company_name,
  r.name as role_name,
  LEFT(u.password_hash, 20) as password_preview
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'YOUR_TEST_EMAIL_HERE';
```

## Success Checklist

✅ User exists in database (verified with `check-users.js`)
✅ Backend logs show "User found" message
✅ Backend logs show "Password matched" message  
✅ User has valid company_id
✅ User has role_id linked to valid role
✅ Role has permissions JSON
✅ Login redirects to /homepage
✅ Only permitted features are shown
✅ Correct company logo/banner displayed

If all checkboxes are ticked, the system is working perfectly! 🎉
