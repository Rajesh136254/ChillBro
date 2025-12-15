# Branches UI Implementation for AdminPage.js

## State Variables to Add (after line 28)

```javascript
// Branch Management State
const [branchesList, setBranchesList] = useState([]);
const [isBranchesLoading, setIsBranchesLoading] = useState(false);
const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
const [currentBranch, setCurrentBranch] = useState({ 
  name: '', 
  address: '', 
  phone: '', 
  manager_name: '', 
  is_active: true 
});
```

## Load Branches Function (add after loadUsers function around line 439)

```javascript
const loadBranches = useCallback(async () => {
  setIsBranchesLoading(true);
  try {
    const res = await fetch(`${API_URL}/api/branches`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    if (json.success) setBranchesList(json.data);
  } catch (err) {
    showToast('Failed to load branches', 'error');
  } finally {
    setIsBranchesLoading(false);
  }
}, [API_URL, token]);
```

## Save Branch Function

```javascript
const saveBranch = async (e) => {
  e.preventDefault();
  try {
    const method = currentBranch.id ? 'PUT' : 'POST';
    const url = currentBranch.id 
      ? `${API_URL}/api/branches/${currentBranch.id}` 
      : `${API_URL}/api/branches`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(currentBranch)
    });

    const json = await res.json();
    if (json.success) {
      showToast('Branch saved successfully');
      setIsBranchModalOpen(false);
      loadBranches();
    } else {
      showToast(json.message || 'Failed to save branch', 'error');
    }
  } catch (err) {
    showToast('Error saving branch', 'error');
  }
};
```

## Delete Branch Function

```javascript
const deleteBranch = async (id) => {
  openConfirm('Are you sure you want to delete this branch?', async () => {
    try {
      const res = await fetch(`${API_URL}/api/branches/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        showToast('Branch deleted');
        loadBranches();
      } else {
        showToast(json.message || 'Failed to delete branch', 'error');
      }
    } catch (err) {
      showToast('Error deleting branch', 'error');
    }
  });
};
```

## Update useEffect to load branches (update the one around line 202)

```javascript
if (activeTab === 'branches' && token) loadBranches();
```

## Branches Tab UI (add in the JSX render section)

This goes where the other tabs are rendered. Look for where Users tab content is displayed.

```javascript
{activeTab === 'branches' && (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Branch Management</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your restaurant branches</p>
      </div>
      <button
        onClick={() => {
          setCurrentBranch({ name: '', address: '', phone: '', manager_name: '', is_active: true });
          setIsBranchModalOpen(true);
        }}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2"
      >
        <i className="fas fa-plus"></i>
        <span>Add Branch</span>
      </button>
    </div>

    {/* Branches Grid */}
    {isBranchesLoading ? (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <p className="mt-4 text-gray-600">Loading branches...</p>
      </div>
    ) : branchesList.length === 0 ? (
      <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl">
        <i className="fas fa-store-slash text-6xl text-purple-300 mb-4"></i>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Branches Yet</h3>
        <p className="text-gray-600 mb-6">Create your first branch to get started</p>
        <button
          onClick={() => {
            setCurrentBranch({ name: '', address: '', phone: '', manager_name: '', is_active: true });
            setIsBranchModalOpen(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg"
        >
          <i className="fas fa-plus mr-2"></i>
          Add Your First Branch
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branchesList.map((branch) => (
          <div
            key={branch.id}
            className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 transform hover:-translate-y-1"
          >
            {/* Branch Header with Gradient */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{branch.name}</h3>
                    {branch.manager_name && (
                      <p className="text-sm text-purple-100 flex items-center">
                        <i className="fas fa-user-tie mr-2"></i>
                        {branch.manager_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      branch.is_active 
                        ? 'bg-green-400 text-green-900' 
                        : 'bg-gray-400 text-gray-900'
                    }`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Branch Details */}
            <div className="p-6 space-y-3">
              {branch.address && (
                <div className="flex items-start space-x-3 text-gray-600">
                  <i className="fas fa-map-marker-alt text-purple-500 mt-1"></i>
                  <span className="flex-1 text-sm">{branch.address}</span>
                </div>
              )}
              {branch.phone && (
                <div className="flex items-center space-x-3 text-gray-600">
                  <i className="fas fa-phone text-purple-500"></i>
                  <span className="text-sm">{branch.phone}</span>
                </div>
              )}

              {/* Stats */}
              {branch.stats && (
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{branch.stats.menu_items}</div>
                    <div className="text-xs text-gray-500">Menu Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{branch.stats.orders}</div>
                    <div className="text-xs text-gray-500">Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600">{branch.stats.ingredients}</div>
                    <div className="text-xs text-gray-500">Ingredients</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex space-x-3">
              <button
                onClick={() => {
                  setCurrentBranch(branch);
                  setIsBranchModalOpen(true);
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <i className="fas fa-edit mr-2"></i>
                Edit
              </button>
              <button
                onClick={() => deleteBranch(branch.id)}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-2 rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <i className="fas fa-trash mr-2"></i>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

## Branch Modal (add with other modals)

```javascript
{isBranchModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
      {/* Modal Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold">
            {currentBranch.id ? 'Edit Branch' : 'Add New Branch'}
          </h3>
          <button
            onClick={() => setIsBranchModalOpen(false)}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <form onSubmit={saveBranch} className="p-6 space-y-6">
        {/* Branch Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Branch Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentBranch.name}
            onChange={(e) => setCurrentBranch({ ...currentBranch, name: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 outline-none"
            placeholder="e.g., Downtown Branch, Airport Branch"
            required
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Address
          </label>
          <textarea
            value={currentBranch.address || ''}
            onChange={(e) => setCurrentBranch({ ...currentBranch, address: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 outline-none resize-none"
            placeholder="Full address of the branch"
            rows="3"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={currentBranch.phone || ''}
            onChange={(e) => setCurrentBranch({ ...currentBranch, phone: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 outline-none"
            placeholder="+1-555-0100"
          />
        </div>

        {/* Manager Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Manager Name
          </label>
          <input
            type="text"
            value={currentBranch.manager_name || ''}
            onChange={(e) => setCurrentBranch({ ...currentBranch, manager_name: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 outline-none"
            placeholder="Branch manager's name"
          />
        </div>

        {/* Active Status */}
        <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-xl">
          <input
            type="checkbox"
            id="branch-active"
            checked={currentBranch.is_active}
            onChange={(e) => setCurrentBranch({ ...currentBranch, is_active: e.target.checked })}
            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
          />
          <label htmlFor="branch-active" className="text-sm font-medium text-gray-700 cursor-pointer">
            Branch is Active
          </label>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setIsBranchModalOpen(false)}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {currentBranch.id ? 'Update Branch' : 'Create Branch'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

## Tab Button (add after ingredients tab button around line 1200)

```javascript
<button
  onClick={() => setActiveTab('branches')}
  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
    activeTab === 'branches'
      ? 'bg-purple-600 text-white shadow-lg'
      : 'bg-white text-gray-700 hover:bg-gray-100'
  }`}
>
  <i className="fas fa-code-branch mr-2"></i>
  Branches
</button>
```

---

This provides a complete, world-class branches management UI with:
- Beautiful gradient cards
- Statistics display
- Modern modals
- Smooth animations
- Mobile responsive
- Empty states
- Loading states
- Success/error handling
