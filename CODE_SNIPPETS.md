# Ready-to-Use Code Snippets

## SNIPPET 1: Add to imports (after line 9 in server.js)

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
```

## SNIPPET 2: Add subdomain middleware (after pool creation, around line 102)

```javascript
// Subdomain Multi-Tenancy Middleware  
const { subdomainMiddleware } = require('./lib/subdomain-middleware');
app.use(subdomainMiddleware(pool));
```

## SNIPPET 3: Replace entire /api/auth/register endpoint

```javascript
app.post('/api/auth/register', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, email, password, company_name } = req.body;

    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) { 
      await conn.rollback(); 
      return res.status(400).json({ message: 'User already exists' }); 
    }

    // Generate unique slug for the company
    const { generateUniqueSlug, getSubdomainUrl } = require('./lib/slug-utils');
    const companyBaseName = company_name || `${name}'s Company`;
    const slug = await generateUniqueSlug(conn, companyBaseName);
    
    // Create company with slug
    const [compRes] = await conn.execute(
      'INSERT INTO companies (name, slug) VALUES (?, ?)', 
      [companyBaseName, slug]
    );
    const companyId = compRes.insertId;

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (name, email, password, company_id, role) VALUES (?, ?, ?, ?, ?)', 
      [name, email, hashedPassword, companyId, 'admin']
    );
    const userId = userRes.insertId;

    await conn.execute(
      'INSERT INTO table_groups (name, company_id) VALUES (?, ?)', 
      ['Non AC', companyId]
    );

    await conn.commit();

    // Get the subdomain URL
    const baseDomain = process.env.BASE_DOMAIN || 'vercel.app';
    const subdomainUrl = getSubdomainUrl(slug, baseDomain);

    const token = jwt.sign(
      { userId, email, role: 'admin', companyId, companySlug: slug }, 
      process.env.JWT_SECRET || 'your_jwt_secret', 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      token, 
      user: { id: userId, name, email, role: 'admin', companyId }, 
      company: { id: companyId, name: companyBaseName, slug, subdomainUrl, baseDomain } 
    });
  } catch (e) { 
    await conn.rollback(); 
    console.error('Registration error:', e);
    res.status(500).json({ error: e.message }); 
  } finally { 
    conn.release(); 
  }
});
```

## SNIPPET 4: Replace entire /api/auth/login endpoint

```javascript
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Join companies table to get slug
    const [users] = await pool.execute(
      `SELECT u.*, c.slug as company_slug, c.name as company_name 
       FROM users u 
       LEFT JOIN companies c ON u.company_id = c.id 
       WHERE u.email = ?`, 
      [email]
    );
    
    if (users.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    const user = users[0];
    
    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role, 
          companyId: user.company_id, 
          companySlug: user.company_slug 
        }, 
        process.env.JWT_SECRET || 'your_jwt_secret', 
        { expiresIn: '24h' }
      );
      
      const baseDomain = process.env.BASE_DOMAIN || 'vercel.app';
      const { getSubdomainUrl } = require('./lib/slug-utils');
      const subdomainUrl = user.company_slug ? getSubdomainUrl(user.company_slug, baseDomain) : null;
      
      res.json({ 
        success: true, 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role, 
          companyId: user.company_id,
          companySlug: user.company_slug 
        },
        company: user.company_slug ? { 
          id: user.company_id,
          name: user.company_name,
          slug: user.company_slug, 
          subdomainUrl, 
          baseDomain 
        } : null
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (e) { 
    console.error('Login error:', e);
    res.status(500).json({ error: e.message }); 
  }
});
```

## SNIPPET 5: Add to backend/.env

```bash
BASE_DOMAIN=vercel.app
JWT_SECRET=change_this_to_a_random_string_in_production
```

---

## Quick Implementation Steps:

1. Open `backend/server.js`
2. Add SNIPPET 1 after line 9 (after dotenv config)
3. Add SNIPPET 2 after pool creation (around line 102)
4. Find and replace the `/api/auth/register` endpoint with SNIPPET 3
5. Find and replace the `/api/auth/login` endpoint with SNIPPET 4
6. Add SNIPPET 5 to `backend/.env`
7. Restart server
8. Test with registration endpoint

---

## Verification

After making changes, your server.js should have:
- `jwt` and `crypto` imported at the top
- Subdomain middleware registered after pool creation
- Updated registration that returns company slug and subdomain URL
- Updated login that returns company information
- BASE_DOMAIN in environment variables

Test with:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123","company_name":"Test Company"}'
```

You should see `company.slug` and `company.subdomainUrl` in the response!
