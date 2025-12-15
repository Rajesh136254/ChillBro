# Role-Based Access Control & Dynamic Logo/Banner Implementation

## Date: 2025-12-12

## Changes Made

### 1. **Backend Changes** (`backend/server.js`)

#### A. Added Permissions Support to Authentication
- **Login Endpoint** (`/api/auth/login`):
  - Now fetches user's `role_id` along with other user data
  - Retrieves role permissions from `roles` table when `role_id` exists
  - Returns permissions in login response: `data: { ...userWithoutPassword, token, permissions }`
  
- **User Info Endpoint** (`/api/auth/me`):
  - Also fetches `role_id` and corresponding permissions
  - Returns updated user data with permissions: `user: { ...user, permissions }`
  - This ensures permissions are available after page refresh

#### B. Fixed Logo/Banner Issue - Company Resolution
- **Modified `resolveCompany` Middleware**:
  - **REMOVED** automatic fallback that was selecting "most recent company with logo and banner"
  - This fallback was causing all admins on localhost to see the same company's logo/banner
  - Now returns `null` company when no slug/subdomain is detected
  - Authenticated users should use `/api/company/profile` which uses their token's `company_id`

### 2. **Frontend Changes**

#### A. AuthContext Updates (`dineflowreact/src/contexts/AuthContext.js`)
- **Login Function**:
  - Now stores permissions in userData: `permissions: data.data.permissions || null`
  - Saves complete userData (including permissions) to localStorage and state
  
- **Session Restore** (`/api/auth/me` call):
  - Fetches and stores permissions when restoring user session
  - Ensures permissions persist across page refreshes

#### B. HomePage Updates (`dineflowreact/src/pages/HomePage.js`)
- **Company Info Fetching**:
  - **For logged-in users**: Uses `/api/company/profile` with authentication token
  - **For public/guest users**: Uses `/api/company/public` (no token)
  - This ensures each admin sees their OWN company's logo and banner based on their `company_id`

- **Role-Based Navigation** (Already Implemented):
  - `filterItems` function already checks user permissions
  - Shows/hides navigation items and feature cards based on role permissions
  - **Super Admin** (role='admin' with no role_id): Full access to all features
  - **Role-based Users** (with role_id and permissions): Access only to permitted features
  - **Customers**: Access only to customer features

## How It Works

### Role-Based Access Control:
1. When a user with a `role_id` logs in, backend fetches their role's permissions (JSON object)
2. Permissions structure example:
   ```json
   {
     "admin": true,
     "kitchen": true,
     "ingredients": false,
     "analytics": false,
     ...
   }
   ```
3. Frontend stores these permissions in `currentUser.permissions`
4. HomePage's `filterItems()` function checks permissions:
   - If permission exists and is `true` → show feature
   - If permission missing or `false` → hide feature

### Logo/Banner Fix:
**Before:**
- All admins on localhost → `/api/company/public` → `resolveCompany` middleware → fallback to **same company**
- Result: Everyone saw the same logo/banner

**After:**
- Logged-in admin → `/api/company/profile` (with token) → uses `req.user.company_id` from token
- Result: Each admin sees **their own company's** logo/banner

## Database Schema Reference

### Tables Involved:
```sql
-- roles table
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  permissions JSON,  -- Store permissions like {"admin": true, "kitchen": false, ...}
  company_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- users table (has both role string and role_id)
ALTER TABLE users ADD COLUMN role_id INT;
ALTER TABLE users ADD CONSTRAINT fk_users_role 
  FOREIGN KEY (role_id) REFERENCES roles(id);
```

### Permission Keys:
- `admin` - Admin Dashboard access
- `kitchen` - Kitchen Display access
- `orders` - Orders Management
- `menu` - Menu Management
- `tables` - Table Management
- `staff` - Staff Management
- `analytics` - Analytics page
- `ingredients` - Ingredients Management
- `settings` - Company Settings
- `users` - User Management
- `roles` - Role Management
- `customer` - Customer Experience page

## Testing

### Test Role-Based Access:
1. **Create a test role**:
   - Login as super admin (existing admin user without role_id)
   - Go to HomePage → Roles section
   - Create role "Kitchen Manager" with permissions: `kitchen=true, ingredients=true`

2. **Create a test user**:
   - Go to Users section
   - Add user with the "Kitchen Manager" role
   - Logout and login as new user

3. **Verify**:
   - New user should ONLY see "Kitchen" and "Ingredients" features on HomePage
   - Other features should be hidden

### Test Logo/Banner:
1. **Setup multiple companies**:
   - Create 2+ companies in database with different logos/banners
   - Create admin users for each company

2. **Test**:
   - Login as Admin from Company A → should see Company A's logo/banner
   - Logout, login as Admin from Company B → should see Company B's logo/banner
   
## Notes

- **Backwards Compatibility**: Existing admins without `role_id` still have full access (super admin)
- **No Breaking Changes**: All existing functionality preserved
- **Customer Users**: Not affected, they only see customer page as before
- **Public Access**: Unauthenticated users on `/api/company/public` will see `null` company (no default fallback)

## Future Enhancements

- Add backend middleware to enforce API endpoint permissions (not just frontend hiding)
- Add more granular permissions (e.g., "can_edit_menu", "can_delete_orders")
- Add permission presets/templates for common roles
