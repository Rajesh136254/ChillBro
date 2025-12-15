# Testing Role-Based Access + Subdomain Multitenancy

## Issue Fixed
1. ✅ **URL Duplication** - No more `ma1.ma1.localhost:3000`
2. ✅ **Permission Debugging** - Added logging to see what's happening

## How to Test

### Step 1: Create Company & Super Admin
```
1. Go to: http://localhost:3000/signup
2. Email: ma1@gmail.com
3. Password: test123
4. Sign up → Redirected to: http://ma1.localhost:3000/homepage
5. You should see ALL features (you're super admin with no role_id)
```

### Step 2: Create a Role with Limited Permissions
```
1. On ma1.localhost:3000/homepage
2. Click "Admin Dashboard" card
3. Go to "Roles" tab
4. Click "Add New Role"
5. Name: "Kitchen Manager"
6. Enable ONLY these permissions:
   ✅ Kitchen Display
   ✅ Ingredients Management
   ❌ All others (leave unchecked)
7. Save
```

### Step 3: Create a User with That Role
```
1. Still in Admin page, go to "Users" tab
2. Click "Add New User"
3. Full Name: "Kitchen Staff"
4. Email: "kitchen@ma1.com"
5. Password: "test123"
6. Phone: (leave blank)
7. Role: Select "Kitchen Manager" from dropdown
8. Click Save
```

### Step 4: Logout and Login as New User
```
1. Click logout (top right)
2. You'll be redirected to signup page
3. Click "Login" tab
4. Email: kitchen@ma1.com
5. Password: test123
6. Click "Log In"
```

### Step 5: Check What Happens
**Open Browser Console (F12) and look for logs starting with `[FILTER]`**

You should see:
```
[FILTER] Checking: customer | User: kitchen@ma1.com | Role: staff | Has role_id: true | Permissions: {kitchen: true, ingredients: true}
[FILTER] Permissions check for customer : {kitchen: true, ingredients: true}
```

This will tell us:
- ✅ If permissions are being loaded
- ✅ If filtering logic is working
- ❌ If something is wrong

## Expected Behavior

### After Login as kitchen@ma1.com:
1. **Should redirect to**: `http://ma1.localhost:3000/homepage` (NOT ma1.ma1...)
2. **Should ONLY see these cards**:
   - ✅ Kitchen Display
   - ✅ Ingredients Management
3. **Should NOT see**:
   - ❌ Customer Experience
   - ❌ Admin Dashboard
   - ❌ Analytics & Reports
   - ❌ Staff Portal

## Debugging

### If User Sees ALL Features:

**Check browser console logs**. You should see one of these problems:

#### Problem 1: No permissions loaded
```
[FILTER] Checking: admin | User: kitchen@ma1.com | Role: staff | Has role_id: true | Permissions: null
```
**Solution**: Permissions not fetched during login. Check:
- Backend logs: Does `[LOGIN]` show permissions being loaded?
- Is `role_id` correctly set in database?

#### Problem 2: User has role='admin' and no role_id
```
[FILTER] ✅ Super Admin - showing all
```
**Solution**: User was created with wrong role. Check database:
```sql
SELECT id, email, role, role_id FROM users WHERE email = 'kitchen@ma1.com';
-- role should be 'staff', not 'admin'
-- role_id should be the ID of "Kitchen Manager" role
```

#### Problem 3: Permissions empty
```
[FILTER] Checking: admin | User: kitchen@ma1.com | Role: staff | Has role_id: true | Permissions: {}
```
**Solution**: Role has no permissions. Check database:
```sql
SELECT id, name, permissions FROM roles WHERE id = (
  SELECT role_id FROM users WHERE email = 'kitchen@ma1.com'
);
-- permissions should be: {"kitchen": true, "ingredients": true}
```

### If URL Still Duplicating:

**Check console logs**. You should see:
```
[LOGIN] Already on correct subdomain, navigating to /homepage
```

If you instead see:
```
[LOGIN] Redirecting admin to: http://ma1.localhost:3000/homepage?token=xxx
```

Then it means you're logging in from the WRONG subdomain. Make sure:
- You're on `http://ma1.localhost:3000/signup` (with subdomain)
- NOT on `http://localhost:3000/signup` (without subdomain)

## Quick Verification Queries

### Check User Setup:
```sql
SELECT 
  u.id,
  u.email,
  u.role,
  u.role_id,
  r.name as role_name,
  r.permissions
FROM users u
LEFT JOIN roles r ON u.role_id = r.id  
WHERE u.email = 'kitchen@ma1.com';
```

Expected result:
- `role`: `'staff'` (or any non-admin value)
- `role_id`: `2` (or whatever ID the Kitchen Manager role has)
- `role_name`: `'Kitchen Manager'`
- `permissions`: `{"kitchen": true, "ingredients": true}`

### Check Role Permissions:
```sql
SELECT id, name, permissions, company_id 
FROM roles 
WHERE name = 'Kitchen Manager';
```

Expected result:
- `permissions`: `{"kitchen": true, "ingredients": true}` (as JSON)

## Still Not Working?

If permissions still don't work after checking all above:

1. **Share browser console logs** - All `[FILTER]` messages
2. **Share backend logs** - All `[LOGIN]` messages  
3. **Share SQL query results** - User and role data

This will help identify exactly where the issue is!
