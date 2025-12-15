# Quick Integration - Add Branches Tab

## STEP 1: Add Import (Line 5)

Open `AdminPage.js` and find line 4-5 that says:
```javascript
import Support TicketModal from '../components/SupportTicketModal';
```

Add this line RIGHT AFTER it:
```javascript
import BranchesTab from '../components/BranchesTab';
```

---

## STEP 2: Add 'branches' to tabs array (Line 1234)

Find line 1234 which looks like:
```javascript
{['menu', 'tables', 'groups', 'staff', 'users', 'roles'].map(tab => (
```

Change it to:
```javascript
{['menu', 'tables', 'groups', 'staff', 'users', 'roles', 'branches'].map(tab => (
```

Just add `, 'branches'` before the closing bracket!

---

## STEP 3: Add Branches Tab Content

Find around line 1670-1700 where you see the `roles` tab content ending.

Look for something like:
```javascript
      )
    }
```

Right AFTER one of the closing sections (after roles tab ends), add this:

```javascript
{
  activeTab === 'branches' && (
    <div className="max-w-7xl mx-auto fade">
      <BranchesTab token={token} API_URL={API_URL} />
    </div>
  )
}
```

---

## Quick Find Method:

**For Step 2**: Press `Ctrl+F` and search for `['menu', 'tables', 'groups'` - add ', 'branches'' to that array

**For Step 3**: Press `Ctrl+F` and search for `activeTab === 'roles'` - add the branches tab content after that section

---

## Exact Copy-Paste for Step 3:

Search for this pattern in AdminPage.js:
```
activeTab === 'roles'
```

After that entire section ends, add:

```javascript
{
  activeTab === 'branches' && (
    <div className="max-w-7xl mx-auto fade">
      <BranchesTab token={token} API_URL={API_URL} />
    </div>
  )
}
```

That's it! Save the file and the Branches tab will appear!
