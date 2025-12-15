# Branch & Role Management Implementation Guide

## Overview
This guide outlines how to implement comprehensive branch management and role management features in the RedSorm Admin Dashboard.

---

## Feature 1: Branch Management in Dashboard

### Location: Add to DashboardPage.js or create BranchManagementSection component

### UI Requirements:

#### 1. Branch Overview Cards
```
┌─────────────────────────────────────────────┐
│  Branch Management                    [+]    │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Main     │  │ Downtown │  │ Airport  │ │
│  │ 🟢 Active│  │ 🟢 Active│  │ 🔴 Closed│ │
│  │ 45 Staff │  │ 32 Staff │  │ 12 Staff │ │
│  │ [Edit]   │  │ [Edit]   │  │ [Edit]   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────┘
```

#### 2. Features to Include:
- **View all branches** in a responsive grid
- **Add new branch** with modal form:
  - Branch name
  - Address
  - Phone number
  - Manager name
  - Operating hours
  - Active/Inactive status
  
- **Edit branch** details
- **Delete branch** (with confirmation)
- **Branch statistics**:
  - Total orders
  - Revenue
  - Staff count
  - Active status

#### 3. Branch Details Modal
When clicking on a branch card:
- Show detailed information
- Display branch-specific menu items
- Show branch staff list
- Display branch analytics
- Quick actions (QR codes, settings)

### Implementation Steps:

1. **Create Component:**
```javascript
// components/BranchManagementSection.js
import React, { useState, useEffect } from 'react';

const BranchManagementSection = () => {
  const [branches, setBranches] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Fetch branches from API
  useEffect(() => {
    fetchBranches();
  }, []);
  
  const fetchBranches = async () => {
    // API call to get branches
  };
  
  return (
    <div className="branch-management-section">
      {/* Branch cards grid */}
      {/* Add branch button */}
      {/* Edit/Delete modals */}
    </div>
  );
};
```

2. **Add to DashboardPage.js:**
```javascript
import BranchManagementSection from '../components/BranchManagementSection';

// Inside dashboard, add new section
<section className="branch-section py-20">
  <div className="container mx-auto px-4">
    <h2>Branch Management</h2>
    <BranchManagementSection />
  </div>
</section>
```

3. **Backend API Endpoints Needed:**
- `GET /api/branches` - List all branches
- `POST /api/branches` - Create new branch
- `PUT /api/branches/:id` - Update branch
- `DELETE /api/branches/:id` - Delete branch
- `GET /api/branches/:id/stats` - Get branch statistics

---

## Feature 2: Role Management Dashboard

### Location: Create RoleManagementSection component

### UI Requirements:

#### 1. Role Overview
```
┌─────────────────────────────────────────────┐
│  Role & Permission Management         [+]    │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │ Admin      ✓ All Permissions         │  │
│  │ Manager    ✓ Menu ✓ Orders ✓ Staff  │  │
│  │ Chef       ✓ Kitchen ✓ Orders        │  │
│  │ Waiter     ✓ Orders ✓ Tables         │  │
│  │ [Edit] [Delete] [View Users]         │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### 2. Features to Include:

**A. Role List:**
- Display all roles in cards or table format
- Show permission count for each role
- User count per role
- Quick actions (Edit, Delete, View Users)

**B. Create/Edit Role Modal:**
```
┌─────────────────────────────────────────┐
│  Create New Role                    [×]  │
├─────────────────────────────────────────┤
│  Role Name: [________________]          │
│                                         │
│  Permissions:                           │
│  ☑ Menu Management                     │
│    ☑ View Menu                         │
│    ☑ Edit Menu                         │
│    ☑ Delete Menu Items                 │
│                                         │
│  ☑ Order Management                    │
│    ☑ View Orders                       │
│    ☑ Edit Orders                       │
│    ☑ Cancel Orders                     │
│                                         │
│  ☑ Kitchen Access                      │
│  ☑ Analytics View                      │
│  ☑ Staff Management                    │
│  ☐ Settings/Admin                      │
│                                         │
│  [Cancel]  [Save Role]                 │
└─────────────────────────────────────────┘
```

**C. Permission Matrix:**
Display a table showing all roles and their permissions:

| Permission       | Admin | Manager | Chef | Waiter |
|-----------------|-------|---------|------|--------|
| Menu Management | ✓     | ✓       | -    | -      |
| Orders          | ✓     | ✓       | ✓    | ✓      |
| Kitchen         | ✓     | ✓       | ✓    | -      |
| Analytics       | ✓     | ✓       | -    | -      |
| Staff           | ✓     | ✓       | -    | -      |
| Settings        | ✓     | -       | -    | -      |

**D. User Assignment:**
- List users assigned to each role
- Drag-and-drop or modal to reassign users
- Bulk actions for role assignment

### Implementation Steps:

1. **Create Component:**
```javascript
// components/RoleManagementSection.js
import React, { useState, useEffect } from 'react';

const permissions = [
  { id: 'menu', name: 'Menu Management', subPermissions: ['view', 'edit', 'delete'] },
  { id: 'orders', name: 'Order Management', subPermissions: ['view', 'edit', 'cancel'] },
  { id: 'kitchen', name: 'Kitchen Access', subPermissions: [] },
  { id: 'analytics', name: 'Analytics View', subPermissions: [] },
  { id: 'staff', name: 'Staff Management', subPermissions: ['view', 'edit', 'delete'] },
  { id: 'settings', name: 'Settings/Admin', subPermissions: [] },
];

const RoleManagementSection = () => {
  const [roles, setRoles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  
  return (
    <div className="role-management-section">
      {/* Role cards */}
      {/* Permission matrix */}
      {/* Create/Edit modal */}
    </div>
  );
};
```

2. **Add to DashboardPage.js:**
```javascript
import RoleManagementSection from '../components/RoleManagementSection';

<section className="role-section py-20">
  <div className="container mx-auto px-4">
    <h2>Role & Permission Management</h2>
    <RoleManagementSection />
  </div>
</section>
```

3. **Backend API Endpoints Needed:**
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role permissions
- `DELETE /api/roles/:id` - Delete role
- `GET /api/roles/:id/users` - Get users with this role
- `POST /api/users/:id/assign-role` - Assign role to user

---

## Design Guidelines

### Colors:
- **Branch Cards:** Purple gradient (`from-purple-500 to-purple-600`)
- **Role Cards:** Orange gradient (`from-orange-500 to-orange-600`)
- **Status Indicators:**
  - Active/Enabled: Green (`bg-green-500`)
  - Inactive/Disabled: Red (`bg-red-500`)
  - Pending: Yellow (`bg-yellow-500`)

### Icons:
- Branch: `fa-store` or `fa-building`
- Role: `fa-user-shield` or `fa-id-badge`
- Permission: `fa-check-circle` (enabled), `fa-times-circle` (disabled)
- Add: `fa-plus`
- Edit: `fa-edit`
- Delete: `fa-trash`

### Layout:
- Use responsive grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Card styling: `bg-white rounded-2xl shadow-lg p-6`
- Modals: Full-screen on mobile, centered on desktop

---

## User Flow Examples

### Adding a New Branch:
1. Click "+ Add Branch" button
2. Modal opens with form
3. Fill in branch details
4. Click "Create Branch"
5. Success toast notification
6. Branch appears in grid
7. Generate QR codes for new branch

### Creating a New Role:
1. Click "+ Create Role" button
2. Modal opens with permission checkboxes
3. Enter role name
4. Select permissions (tree view)
5. Click "Save Role"
6. Success notification
7. Role appears in list
8. Can now assign users to this role

### Editing Permissions:
1. Click "Edit" on a role card
2. Modal shows current permissions checked
3. Toggle permissions on/off
4. Click "Update"
5. Confirmation: "X users will be affected"
6. Save changes
7. Users immediately see updated access

---

## Security Considerations

1. **Who Can Manage?**
   - Only users with "admin" or "settings" permission
   - Can't delete own role
   - Can't remove own admin access

2. **Validation:**
   - At least one admin role must exist
   - Can't delete role if users are assigned (must reassign first)
   - Branch deletion requires moving/deleting associated data

3. **Audit Trail:**
   - Log all role changes
   - Log all branch creations/deletions
   - Track who made changes and when

---

## Testing Checklist

### Branch Management:
- [ ] Create new branch
- [ ] Edit existing branch
- [ ] Delete branch (with data)
- [ ] Toggle branch active/inactive
- [ ] View branch statistics
- [ ] Generate branch QR codes
- [ ] Filter branches by status

### Role Management:
- [ ] Create new role
- [ ] Edit role permissions
- [ ] Delete unused role
- [ ] Assign users to role
- [ ] Remove users from role
- [ ] Bulk assign roles
- [ ] View permission matrix
- [ ] Test permissions in action

---

## Priority Implementation Order

1. **Phase 1 (Essential):**
   - Branch listing and viewing
   - Basic role listing
   - Permission viewing

2. **Phase 2 (Core Features):**
   - Create/edit branches
   - Create/edit roles
   - Assign permissions

3. **Phase 3 (Advanced):**
   - Branch statistics
   - Permission matrix view
   - Bulk user assignment
   - Audit logs

4. **Phase 4 (Polish):**
   - Advanced filters
   - Export capabilities
   - Drag-and-drop UI
   - Visual permission builder

---

## Next Steps

1. Create `/components/BranchManagementSection.js`
2. Create `/components/RoleManagementSection.js`
3. Add sections to `DashboardPage.js`
4. Implement backend API endpoints
5. Test with real data
6. Add to navigation menu
7. Document for users

---

**Note:** These features integrate with existing Branch and Role functionality already present in the app (BranchesPage.js, role filtering in HomePage.js). This implementation adds the UI management layer on top of the existing backend.
