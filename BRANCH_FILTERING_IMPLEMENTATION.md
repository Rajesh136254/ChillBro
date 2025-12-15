# Branch Filtering Implementation - Complete Guide

## What's Been Done ✅

1. ✅ BranchContext created (`src/contexts/BranchContext.js`)
2. ✅ BranchSelector component created (`src/components/BranchSelector.jsx`)

## What Needs to Be Done

### Phase 1: Integrate BranchContext into App

**File**: `dineflowreact/src/index.js` or `App.js`

Wrap the app with BranchProvider:

```javascript
import { BranchProvider } from './contexts/BranchContext';

// Wrap your app:
<BranchProvider>
  <AuthProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </AuthProvider>
</BranchProvider>
```

### Phase 2: Add Branch Selector to Each Page

Add to AdminPage.js, Analytics, Kitchen, etc.:

```javascript
import BranchSelector from '../components/BranchSelector';
import { useBranch } from '../contexts/BranchContext';

// Inside component:
const { selectedBranch } = useBranch();

// In JSX (top of the page):
<BranchSelector API_URL={API_URL} />
```

### Phase 3: Update API Calls to Include Branch Filter

#### AdminPage - Load Menu Example:
```javascript
const loadMenu = useCallback(async () => {
  setIsMenuLoading(true);
  try {
    // Add branch_id to query if selected
    const url = selectedBranch 
      ? `${API_URL}/api/menu?branch_id=${selectedBranch}`
      : `${API_URL}/api/menu`;
      
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    // ... rest of code
  }
}, [API_URL, token, selectedBranch]); // Add selectedBranch to dependencies
```

Apply same pattern to:
- `loadTables()`
- `loadOrders()`
- `loadIngredients()`
- Analytics queries

### Phase 4: Update Backend Endpoints

**File**: `backend/server.js`

#### Example - Menu Endpoint:
```javascript
app.get('/api/menu', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { branch_id } = req.query; //GET branch filter from query

    let query = 'SELECT * FROM menu_items WHERE company_id = ?';
    let params = [company_id];

    // Add branch filter if provided
    if (branch_id && branch_id !== 'null') {
      query += ' AND (branch_id = ? OR branch_id IS NULL)';
      params.push(branch_id);
    }

    query += ' ORDER BY category, name';

    const [items] = await pool.execute(query, params);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

Apply same pattern to:
- `/api/tables`
- `/api/orders`
-`/api/ingredients`
- Analytics endpoints

## Summary of Changes Needed

| Component | File | Action |
|-----------|------|--------|
| App Wrapper | `src/index.js` | Add `<BranchProvider>` |
| AdminPage | `src/pages/AdminPage.js` | Import useBranch, add BranchSelector, update all API calls |
| Analytics | `src/pages/AnalyticsPage.js` | Same as AdminPage |
| Kitchen | `src/pages/Kitchen.js` | Same as AdminPage |
| Ingredients | `src/pages/Ingredients.js` | Same as AdminPage |
| Backend Menu | `backend/server.js` | Add branch_id query filtering |
| Backend Tables | `backend/server.js` | Add branch_id query filtering |
| Backend Orders | `backend/server.js` | Add branch_id query filtering |
| Backend Ingredients | `backend/server.js` | Add branch_id query filtering |

## How It Works

1. User selects a branch from dropdown
2. `selectedBranch` is stored in BranchContext
3. All pages access `selectedBranch` via `useBranch()` hook
4. API calls include `?branch_id=X` when branch is selected
5. Backend filters data WHERE branch_id = X OR branch_id IS NULL
6. User sees only that branch's data + shared items

## Testing

1. Create 2-3 branches in admin panel
2. Add menu items, assign some to Branch A, some to Branch B, some to ALL
3. Select "Branch A" from dropdown
4. Verify only Branch A items show (+ shared items)
5. Select "All Branches"
6. Verify all items show

This provides a complete multi-branch filtering system!
