# Testing Guide: RBAC and Logo/Banner Fix

## Quick Test Steps

### ✅ Test 1: Role-Based Access Control on HomePage

#### Setup:
1. Make sure you have at least one company with logo and banner configured
2. Have a super admin user (existing admin without role_id)

#### Steps:
1. **Login as Super Admin**:
   ```
   - Open http://localhost:3000/homepage
   - Login with existing admin credentials
   - You should see ALL features on the homepage (Admin, Kitchen, Customer, Analytics, Ingredients, Staff)
   ```

2. **Create a New Role**:
   ```
   - Click on "Admin" from the homepage
   - Go to "Roles" tab
   - Click "Add New Role"
   - Name: "Kitchen Manager"
   - Enable permissions: "Kitchen Display" and "Ingredients"
   - Save
   ```

3. **Create a Test User with Role**:
   ```
   - Go to "Users" tab
   - Click "Add New User"
   - Full Name: "Kitchen Test User"
   - Email: "kitchen@test.com"
   - Password: "test123"
   - Phone: (optional)
   - Role: Select "Kitchen Manager" from dropdown
   - Save
   ```

4. **Logout and Login as Test User**:
   ```
   - Logout from super admin
   - Login with: kitchen@test.com / test123
   - Go to homepage
   - You should ONLY see: "Kitchen Display" and "Ingredients Management" cards
   - Other features (Admin, Analytics, Customer, Staff) should be HIDDEN
   ```

### ✅ Test 2: Dynamic Logo/Banner (Different Companies)

#### Setup:
You need to have 2+ companies in your database with different logos/banners.

#### Create Test Companies (if needed):
```sql
-- Insert Company A
INSERT INTO companies (name, slug, logo_url, banner_url) 
VALUES ('Restaurant A', 'restaurant-a', '[base64_logo_A]', '[base64_banner_A]');

-- Insert Company B  
INSERT INTO companies (name, slug, logo_url, banner_url)
VALUES ('Restaurant B', 'restaurant-b', '[base64_logo_B]', '[base64_banner_B]');
```

#### Create Admin Users for Each Company:
```sql
-- Admin for Company A (assuming company_id=1)
INSERT INTO users (full_name, email, password_hash, role, company_id)
VALUES ('Admin A', 'admin-a@test.com', '$2b$10$[hashed_password]', 'admin', 1);

-- Admin for Company B (assuming company_id=2)
INSERT INTO users (full_name, email, password_hash, role, company_id)
VALUES ('Admin B', 'admin-b@test.com', '$2b$10$[hashed_password]', 'admin', 2);
```

#### Test Steps:
1. **Test Company A Admin**:
   ```
   - Login as admin-a@test.com
   - Go to http://localhost:3000/homepage
   - Header should show: Restaurant A's name, logo, and banner
   ```

2. **Test Company B Admin**:
   ```
   - Logout
   - Login as admin-b@test.com
   - Go to http://localhost:3000/homepage
   - Header should show: Restaurant B's name, logo, and banner
   ```

3. **Verify**:
   ```
   - Each admin should see THEIR company's branding
   - No more "same default logo for everyone" issue
   ```

## Expected Results

### ✅ What You Should See:

#### For Role-Based Access:
- **Super Admin (no role_id)**: Sees ALL feature cards
- **Kitchen Manager role user**: Sees ONLY Kitchen and Ingredients cards
- **Custom role user**: Sees ONLY the features they have permission for
- **Customer user**: Sees ONLY Customer Experience card

#### For Logo/Banner:
- **Before Fix**: All admins saw the same logo/banner (most recent company)
- **After Fix**: Each admin sees their own company's logo/banner based on their company_id

### ❌ What Should NOT Happen:
- Features should NOT appear for users without permission
- Users should NOT see other companies' logos/banners
- No console errors about missing permissions

## Troubleshooting

### Issue: All admins still see same logo
**Solution**: 
- Clear browser cache and localStorage
- Check that admins have different `company_id` values in database
- Verify each company has `logo_url` and `banner_url` set

### Issue: User with role sees no features
**Solution**:
- Check user's `role_id` is set correctly
- Check the role's permissions JSON is not empty
- Verify permissions object has at least one `true` value

### Issue: Super admin not seeing all features
**Solution**:
- Check that user's `role_id` is `NULL` (not set)
- Check user's `role` field is 'admin'
- This combination = super admin with full access

## Database Queries for Testing

### Check User's Role and Permissions:
```sql
SELECT u.id, u.full_name, u.email, u.role, u.role_id, u.company_id,
       r.name as role_name, r.permissions
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'kitchen@test.com';
```

### Check All Roles:
```sql
SELECT id, name, permissions, company_id 
FROM roles;
```

### Check Company Settings:
```sql
SELECT id, name, slug, 
       LENGTH(logo_url) as logo_size, 
       LENGTH(banner_url) as banner_size 
FROM companies;
```

## Success Criteria

✅ **Role-Based Access Working** if:
1. Super admins see all features
2. Role-based users only see permitted features
3. No console errors
4. Smooth login/logout experience

✅ **Logo/Banner Fix Working** if:
1. Each company's admin sees their own branding
2. No "default" fallback for all users
3. Logo and banner load correctly on HomePage header
4. Changes persist after page refresh

## Next Steps After Testing

If tests pass:
- ✅ Role-based access is working
- ✅ Logo/banner issue is fixed
- ✅ No existing functionality broken

If tests fail:
- Check browser console for errors
- Check network tab for API responses
- Review database data integrity
- Verify token contains correct company_id
