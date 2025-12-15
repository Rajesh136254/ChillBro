# TWO ISSUES TO FIX

## Issue 1: Table Dropdown Not Showing Tables ✅ FOUND THE PROBLEM

### Current Behavior:
- Only scanned table number shows
- Dropdown appears but is empty (no table list)

### Root Cause:
**Tables are NEVER loaded!**

Looking at `CustomerPage.js`:
- Line 119: `const [tables, setTables] = useState([]);` ← Variable exists
- Line 751-755: Dropdown exists and maps `tables.map(...)` 
- **Problem:** `setTables()` is NEVER called - the array stays empty!

### Solution:
Need to add a function to load tables from API and call it on component mount.

### Code to Add:
```javascript
// Add this function around line 250 (near other load functions)
const loadTables = useCallback(async () => {
  try {
    const response = await fetch(`${API_URL}/api/tables`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (data.success) {
      setTables(data.data || []);
    }
  } catch (error) {
    console.error('Error loading tables:', error);
  }
}, [token]);

// Then call it in the useEffect that loads data:
// Around line 610, add loadTables to the calls:
useEffect(() => {
  if (token) {
    console.log('[CustomerPage] Token available, loading data...');
    loadTables();          // ← ADD THIS
    loadMenu();
    loadCategories();
    loadCustomerOrders();
    // ... rest of code
  }
}, [token, loadTables, loadMenu, loadCategories, loadCustomerOrders]);
```

---

## Issue 2: Emails Not Working on Render ⚠️ GMAIL SECURITY ISSUE

### Current Behavior:
- ✅ Emails work locally
- ❌ Emails don't work on Render

### From Render Logs:
```
[EMAIL ERROR] Transporter verification failed: Error: Connection timeout
code: 'ETIMEDOUT',
command: 'CONN'
```

### Root Causes:

#### Cause 1: Gmail blocks Render's IP addresses
Gmail has strict security that blocks:
- Unknown IP addresses
- Datacenter IPs (like Render's servers)
- Apps without 2FA/App Passwords

#### Cause 2: Environment Variables Not Set Correctly on Render
Even if set, they might not be:
- The correct App Password (not regular password)
- Formatted correctly (no extra spaces)

### Solutions (Pick One):

#### Option A: Use Gmail App Password (RECOMMENDED)
1. **Generate App Password:**
   ```
   1. Go to Google Account → Security
   2. Enable 2-Factor Authentication (if not already)
   3. Go to "App passwords"
   4. Generate new app password for "Mail"
   5. Copy the 16-character password
   ```

2. **Update Render Environment Variables:**
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx  (the 16-char app password)
   ```

3. **Enable Less Secure Apps (if app password doesn't work):**
   - Go to: https://myaccount.google.com/lesssecureapps
   - Turn ON "Allow less secure apps"
   - ⚠️ Not recommended for security

#### Option B: Use SendGrid (Better for Production)
SendGrid is designed for transactional emails and works reliably:

1. **Sign up:** https://sendgrid.com/ (Free tier: 100 emails/day)
2. **Get API Key**
3. **Update backend code:**
```javascript
// Replace nodemailer transporter with:
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Sending becomes:
const msg = {
  to: 'user@example.com',
  from: 'noreply@yourdomain.com',
  subject: 'Hello',
  html: '<p>Email content</p>'
};
await sgMail.send(msg);
```

4. **Add to Render:**
```
SENDGRID_API_KEY=your_api_key_here
```

#### Option C: Use Ethereal Email (Testing Only)
For testing on Render (not real emails):
```javascript
const testAccount = await nodemailer.createTestAccount();
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: testAccount.user,
    pass: testAccount.pass
  }
});
```

---

## Recommended Actions

### For Table Dropdown (Quick Fix):
I'll add the code to load and display tables.

### For Email (Needs Your Action):

**FASTEST:** Use Gmail App Password
1. Generate app password from Google
2. Update `EMAIL_PASS` in Render with the 16-char password
3. Redeploy

**BEST:** Switch to SendGrid
1. Sign up for SendGrid
2. Get API key
3. I'll update the code to use SendGrid
4. Add API key to Render env vars

**Which email solution do you prefer?**
- A: Gmail App Password (quick, uses your current Gmail)
- B: SendGrid (professional, reliable, free tier)
- C: Keep Gmail but debug more (might not work on Render)

Let me know and I'll implement the fixes!
