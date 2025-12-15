# Branch Management Implementation Plan

## Overview
Implementing multi-branch restaurant management where each company can have multiple branches, and data/reports can be filtered by branch.

## Database Schema Changes

### 1. Create `branches` Table
```sql
CREATE TABLE branches (
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
);
```

### 2. Add `branch_id` to Existing Tables
```sql
-- Menu Items
ALTER TABLE menu_items ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE menu_items ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- Tables  
ALTER TABLE tables ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE tables ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- Orders
ALTER TABLE orders ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE orders ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- Ingredients
ALTER TABLE ingredients ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE ingredients ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- Staff (if exists)
ALTER TABLE staff ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE staff ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- Users (assign staff to specific branch)
ALTER TABLE users ADD COLUMN branch_id INT DEFAULT NULL;
ALTER TABLE users ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
```

## Implementation Steps

### Phase 1: Backend Setup

#### Step 1: Database Migration
- Create `backend/migrations/add_branches.js`
- Safely add branches table and branch_id columns
- Handle existing data (set NULL for branch_id initially)

#### Step 2: Branch API Endpoints
```
GET    /api/branches              - Get all branches for company
POST   /api/branches              - Create new branch
PUT    /api/branches/:id          - Update branch
DELETE /api/branches/:id          - Delete branch
GET    /api/branches/:id          - Get single branch details
```

#### Step 3: Update Existing Endpoints
Add optional `branch_id` query parameter to:
- `/api/menu` - Filter menu by branch
- `/api/tables` - Filter tables by branch
- `/api/orders` - Filter orders by branch
- `/api/ingredients` - Filter ingredients by branch
- `/api/analytics/*` - Filter analytics by branch

### Phase 2: Frontend - Admin Page

#### Step 1: Add Branches Section in AdminPage
- Add "Branches" tab after "Ingredients" tab
- Similar UI to Users/Roles management
- List of branches with Add/Edit/Delete

#### Step 2: Branch Selector Component
Create `BranchSelector.jsx`:
```javascript
// Dropdown to select:
// - "All Branches" (shows combined data)
// - Individual branch names
```

#### Step 3: Add Branch Selection to Each Section
- Menu Management → Filter by branch
- Tables Management → Filter by branch
- Orders → Filter by branch
- Ingredients → Filter by branch

### Phase 3: Analytics/Reports

#### Step 1: Branch Filter in Analytics
- Add branch dropdown at top of analytics page
- When branch selected → filter all charts/stats
- "All Branches" → show aggregated data

#### Step 2: Branch Comparison View
- Side-by-side branch performance
- Top performing branch
- Branch-wise revenue chart

## UI/UX Flow

### Branch Management (AdminPage → Branches Tab)

```
+--------------------------------+
| Branches                [+ Add]|
+--------------------------------+
| Name        | Address | Active |
|-------------|---------|--------|
| Main Branch | 123 St  | ✓      |
| Downtown    | 456 Ave | ✓      |
| Airport     | 789 Rd  | ✓      |
+--------------------------------+
```

### Branch Selector (Global Component)

```
+---------------------------+
| Branch: [All Branches ▼]  |
+---------------------------+
Dropdown options:
- All Branches
- Main Branch
- Downtown
- Airport
```

### Analytics with Branch Filter

```
+------------------------------+
| Analytics                     |
| Branch: [Downtown ▼]         |
+------------------------------+
| Revenue: $5,234              |
| Orders: 145                  |
| Top Items: ...               |
+------------------------------+
```

## How Branch Data Works

### Scenario 1: No Branch Selected (Backward Compatible)
- If `branch_id` is NULL → Item belongs to ALL branches
- Legacy data without branch_id → visible everywhere
- Ensures existing data still works

### Scenario 2: Branch Selected
- Only show items/tables/orders with matching `branch_id`
- OR items with `branch_id = NULL` (shared items)

### Scenario 3: Creating New Data
- User selects active branch from dropdown
- New menu item → saved with `branch_id = selected_branch`
- Can mark items as "shared across all branches"

## Backend Logic Examples

### Menu Query with Branch Filter
```javascript
// If branch_id provided
SELECT * FROM menu_items 
WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL)
ORDER BY category, name;

// If no branch (show all)
SELECT * FROM menu_items 
WHERE company_id = ?
ORDER BY category, name;
```

### Analytics Query with Branch Filter
```javascript
// Revenue by branch
SELECT 
  b.name as branch_name,
  SUM(o.total_amount) as revenue,
  COUNT(o.id) as order_count
FROM orders o
LEFT JOIN branches b ON o.branch_id = b.id
WHERE o.company_id = ? AND o.created_at >= ?
GROUP BY o.branch_id, b.name;
```

## Permission System Integration

### Branch-Level Permissions
Users can be assigned to specific branches:
- User with `branch_id = 1` → Only sees Branch 1 data
- User with `branch_id = NULL` → Sees all branches (admin)

### Role + Branch Combination
- Kitchen Manager at Downtown → `role_id = 2, branch_id = 3`
- Can only access kitchen features at Downtown branch

## Migration Strategy

### For Existing Data
1. All existing data has `branch_id = NULL`
2. Create a "Main Branch" automatically for each company
3. (Optional) Bulk assign existing data to "Main Branch"
4. Going forward, new data requires branch selection

## Files to Create/Modify

### Backend
- `backend/migrations/add_branches.js` (NEW)
- `backend/database.sql` (UPDATE - add branches table)
- `backend/server.js` (UPDATE - add branch endpoints)

### Frontend
- `dineflowreact/src/components/BranchSelector.jsx` (NEW)
- `dineflowreact/src/pages/AdminPage.js` (UPDATE - add branches tab)
- `dineflowreact/src/pages/AnalyticsPage.js` (UPDATE - add branch filter)
- Update all data fetching to include optional branch filter

## Testing Checklist

- [ ] Create multiple branches for a company
- [ ] Add menu items to specific branches
- [ ] Verify branch filtering works in each section
- [ ] Test "All Branches" view shows combined data
- [ ] Verify analytics aggregates correctly by branch
- [ ] Ensure existing data without branch_id still works
- [ ] Test branch deletion (should set items to NULL, not delete them)
- [ ] Verify permissions: branch-specific users only see their branch

## Next Steps

1. Create database migration script
2. Add branches API endpoints
3. Create Branches management UI in AdminPage
4. Add BranchSelector component
5. Update each module to support branch filtering
6. Add branch analytics and reporting

This will give you a complete multi-branch restaurant management system!
