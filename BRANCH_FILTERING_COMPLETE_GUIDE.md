# COMPLETE BRANCH FILTERING IMPLEMENTATION

## ✅ DONE - Files Created
1. ✅ `src/contexts/BranchContext.js` - Branch state management
2. ✅ `src/components/BranchSelector.jsx` - Dropdown component
3. ✅ `src/App.js` - Updated with BranchProvider

## 🔄 STEP-BY-STEP REMAINING INTEGRATION

### AdminPage.js Changes

#### 1. Add Imports (After line 5)
```javascript
import BranchSelector from '../components/BranchSelector';
import { useBranch } from '../contexts/BranchContext';
```

#### 2. Use the Hook (Around line 95, after other hooks)
```javascript
const { selectedBranch } = useBranch();
```

#### 3. Add BranchSelector to JSX (After line 1240, before tabs)
```javascript
{/* Branch Selector */}
<div className="max-w-7xl mx-auto">
  <BranchSelector API_URL={API_URL} />
</div>
```

#### 4. Update loadMenu Function (Add selectedBranch to dependencies and query)

**Find the loadMenu function** and change it to:
```javascript
const loadMenu = useCallback(async () => {
  setIsMenuLoading(true);
  try {
    // Build URL with optional branch filter
    let url = `${API_URL}/api/menu`;
    if (selectedBranch) {
      url += `?branch_id=${selectedBranch}`;
    }
    
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    const json = await res.json();
    if (json.success) {
      const validItems = (json.data || []).filter(item =>
        item.name !== '[Category Placeholder]' &&
        item.category !== 'add-new'
      );
      setMenuItems(validItems);
    }
  } catch (err) {
    showToast('Failed to load menu', 'error');
  } finally {
    setIsMenuLoading(false);
  }
}, [API_URL, token, logout, selectedBranch]); // ADD selectedBranch here
```

---

### Backend server.js Changes

#### Find GET /api/menu endpoint and update it:

**Search for**: The menu GET endpoint (look for where it queries menu_items)

**Replace with**:
```javascript
app.get('/api/menu', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching menu items...');
    const { company_id } = req.user;
    const { branch_id } = req.query; // ADD THIS LINE

    // Build query with optional branch filter
    let query = 'SELECT * FROM menu_items WHERE company_id = ?';
    let params = [company_id];

    // ADD THIS BLOCK
    if (branch_id && branch_id !== 'null' && branch_id !== 'undefined') {
      query += ' AND (branch_id = ? OR branch_id IS NULL)';
      params.push(parseInt(branch_id));
    }

    query += ' ORDER BY category, name';
    
    console.log('Executing menu query:', query, params);
    const [items] = await pool.execute(query, params);
    console.log(`Found ${items.length} menu items for company ${company_id}${branch_id ? ` and branch ${branch_id}` : ''}`);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
```

---

## TEST IT

1. Restart backend if needed
2. Go to Admin Panel
3. You should see Branch Selector dropdown at top
4. Create 2 branches: "Branch A" and "Branch B"
5. Add menu items:
   - Some without branch (shared)
   - Some for Branch A
   - Some for Branch B
6. Select "Branch A" from dropdown
7. Only Branch A items + shared items should show!

---

## EXTEND TO OTHER PAGES (Optional - Same Pattern)

### For Ingredients, Orders, Analytics:
1. Add BranchSelector component to page
2. Import and use `useBranch()` hook
3. Update API call URLs to include `?branch_id=${selectedBranch}`
4. Update backend endpoints to filter by branch_id

The system is designed modular - each page can independently support branch filtering!

---

## STATUS

✅ Framework Complete (Context, Selector, Provider)
🔄 AdminPage Integration (3 simple changes)
🔄 Backend Menu Endpoint (1 change)
⏳ Extend to other pages (when needed)

**All the hard work is done! Just need these final integrations!**
