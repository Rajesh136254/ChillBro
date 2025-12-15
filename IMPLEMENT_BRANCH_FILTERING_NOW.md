# QUICK IMPLEMENTATION -Branch Filtering

## I've created the needed components. Now make these 3 simple changes:

### 1. Update App.js (ADD 3 LINES)

**Line 15** - Add import:
```javascript
import { BranchProvider } from './contexts/BranchContext';
```

**Line 52** - Wrap with BranchProvider (add 1 line):
```javascript
    <LanguageProvider>
      <AuthProvider>
        <BranchProvider>  {/* ADD THIS */}
          <DebugInfo />
```

**Line 81** - Close BranchProvider (add 1 line):
```javascript
        </Router>
      </BranchProvider>  {/* ADD THIS */}
    </AuthProvider>
  </LanguageProvider>
```

---

### 2. Update AdminPage.js (ADD 2 ITEMS)

**Top of file (~line 6)** - Add imports:
```javascript
import BranchSelector from '../components/BranchSelector';
import { useBranch } from '../contexts/BranchContext';
```

**Inside component** (~line 85, after const { token, logout...}):
```javascript
const { selectedBranch } = useBranch();
```

**In JSX** (after the header, ~line 1240, right before the tabs):
```javascript
{/* Branch Selector */}
<div className="max-w-7xl mx-auto mb-6">
  <BranchSelector API_URL={API_URL} />
</div>
```

---

### 3. Update Backend Menu Endpoint (server.js)

Find the GET `/api/menu` endpoint and change it to:

```javascript
app.get('/api/menu', authenticateToken, async (req, res) => {
  try {
    const { company_id } = req.user;
    const { branch_id } = req.query; // ADD THIS

    let query = 'SELECT * FROM menu_items WHERE company_id = ?';
    let params = [company_id];

    // ADD THIS BLOCK
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

---

## That's It!

After these changes:
- Branch selector will appear on AdminPage
- Selecting a branch filters the menu
- Can extend same pattern to orders, ingredients, analytics

The components are ready, just need these 3 integrations!
