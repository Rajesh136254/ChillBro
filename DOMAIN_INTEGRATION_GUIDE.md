# Complete Domain Integration Guide for redsorm.in
# Multi-tenancy Setup with Vercel (Frontend) + Render (Backend) + Aiven (Database)

## Overview
Main Domain:     redsorm.in → Landing/Dashboard Page
Client Sites:    {company}.redsorm.in → Client-specific restaurant pages  
API:             api.redsorm.in → Backend API
Database:        Aiven PostgreSQL (already configured)

---

## STEP 1: CONFIGURE VERCEL (Frontend)

### 1.1 Add Domains to Vercel Project

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your frontend project (dineflowreact)
3. Navigate to: **Settings** → **Domains**

4. Add these THREE domains:
   
   **Domain 1: Main Domain**
   - Click "Add Domain"
   - Enter: `redsorm.in`
   - Click "Add"
   
   **Domain 2: WWW Subdomain**
   - Click "Add Domain"  
   - Enter: `www.redsorm.in`
   - Click "Add"
   
   **Domain 3: Wildcard Subdomain (For all client sites)**
   - Click "Add Domain"
   - Enter: `*.redsorm.in`
   - Click "Add"

5. **IMPORTANT**: Note down the DNS records Vercel shows. You'll need:
   - An A record pointing to Vercel's IP (e.g., 76.76.21.21)
   - CNAME records for wildcard and www

---

## STEP 2: CONFIGURE HOSTINGER DNS

### 2.1 Access DNS Settings

1. Login to Hostinger: https://www.hostinger.com
2. Go to: **Domains** → Select `redsorm.in`
3. Click: **Manage** → **DNS/Name Servers**

### 2.2 Delete Existing Records

**IMPORTANT**: Delete these if they exist:
- Any A records for @ (root)
- Any CNAME records for @ or www
- Any default parking page records

### 2.3 Add New DNS Records

Add the following records EXACTLY as shown:

**Record 1: Main Domain A Record**
```
Type: A
Name: @ (or leave blank)
Value: 76.76.21.21
TTL: 3600
```
Note: Use the EXACT IP address Vercel provided (may be different)

**Record 2: WWW Subdomain**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com.
TTL: 3600
```
Note: Don't forget the trailing dot (.)

**Record 3: Wildcard for Client Subdomains**
```
Type: CNAME  
Name: *
Value: cname.vercel-dns.com.
TTL: 3600
```

**Record 4: API Subdomain (Points to Render)**
```
Type: CNAME
Name: api
Value: [your-render-app-name].onrender.com.
TTL: 3600
```
Replace [your-render-app-name] with your actual Render service name
Example: If your Render URL is `dineflowbackend.onrender.com`, use that

### 2.4 Save and Wait

- Click **Save Changes**
- DNS propagation: 1-48 hours (usually 1-2 hours)
- Test with: https://dnschecker.org/#A/redsorm.in

---

## STEP 3: CONFIGURE RENDER (Backend)

### 3.1 Add Custom Domain

1. Go to Render Dashboard: https://dashboard.render.com
2. Select your backend service
3. Go to: **Settings** → **Custom Domain**
4. Click: **Add Custom Domain**
5. Enter: `api.redsorm.in`
6. Click: **Save**

### 3.2 Wait for SSL Certificate

- Render will verify the CNAME record from Hostinger
- SSL certificate will be automatically issued (5-10 minutes)
- Status will show "Verified" when ready

---

## STEP 4: UPDATE BACKEND CODE

You need to update the CORS configuration to allow your new domain.

### 4.1 Update CORS Allowed Origins

Location: `backend/server.js` (around line 53)

**Add these lines to the allowedOrigins array:**
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://dineflowfrontend.vercel.app',
  'https://dineflowbackend.onrender.com',
  'https://dineflowfrontend-6wmy.vercel.app',
  'https://endofhunger.work.gd',
  'http://endofhunger.work.gd',
  // ADD THESE NEW LINES:
  'https://redsorm.in',
  'https://www.redsorm.in',
  'http://redsorm.in',
  'http://www.redsorm.in'
];
```

### 4.2 Update CORS Regex for Wildcard Subdomains

Location: `backend/server.js` (around line 121)

**Add new regex pattern:**
```javascript
// Existing code...
const customDomainRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?endofhunger\.work\.gd$/;
if (customDomainRegex.test(origin)) {
  return callback(null, true);
}

// ADD THIS NEW REGEX for redsorm.in:
const redsormRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?redsorm\.in$/;
if (redsormRegex.test(origin)) {
  return callback(null, true);
}

console.log('CORS blocked origin:', origin);
callback(new Error('Not allowed by CORS'));
```

### 4.3 Update Socket.IO CORS (if using real-time features)

Location: `backend/server.js` (around line 85)

**Add similar regex:**
```javascript
const customDomainRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?endofhunger\.work\.gd$/;
if (customDomainRegex.test(origin)) return callback(null, true);

// ADD THIS:
const redsormRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?redsorm\.in$/;
if (redsormRegex.test(origin)) return callback(null, true);

callback(new Error('Not allowed by CORS'));
```

### 4.4 Deploy Backend Changes

1. Commit your changes:
   ```bash
   git add backend/server.js
   git commit -m "Add redsorm.in domain to CORS"
   git push
   ```

2. Render will auto-deploy (or manually deploy from Render dashboard)

---

## STEP 5: UPDATE FRONTEND ENVIRONMENT VARIABLES

### 5.1 Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project
2. Go to: **Settings** → **Environment Variables**

3. Find or add: `REACT_APP_API_URL` (or similar)
4. Set value to: `https://api.redsorm.in`

5. Click **Save**
6. **Redeploy** your application for changes to take effect

### 5.2 Update Local .env File (for testing)

Location: `dineflowreact/.env`

```env
REACT_APP_API_URL=https://api.redsorm.in
```

---

## STEP 6: TESTING THE SETUP

### 6.1 Test DNS Propagation

Use DNS checker tools:
- https://dnschecker.org/#A/redsorm.in
- https://dnschecker.org/#CNAME/www.redsorm.in
- https://dnschecker.org/#CNAME/api.redsorm.in

All should show correct values globally.

### 6.2 Test Main Domain

1. Visit: `https://redsorm.in`
2. Should load your landing/dashboard page
3. Check browser console for errors

### 6.3 Test API Domain

1. Visit: `https://api.redsorm.in/api/health`
2. Should return: `{"status":"ok",...}`

### 6.4 Test Client Subdomain

1. Create a test company in your database with slug: `test`
2. Visit: `https://test.redsorm.in`
3. Should load that company's customer page

### 6.5 Test CORS

1. Open browser DevTools → Network tab
2. Navigate to `https://redsorm.in`
3. Check API calls - should NOT see CORS errors
4. If you see CORS errors, verify:
   - Backend CORS regex includes redsorm.in
   - API domain is `api.redsorm.in`
   - Backend is deployed with latest code

---

## STEP 7: CLIENT ONBOARDING PROCESS

### 7.1 How to Add New Clients

When a new restaurant signs up:

1. **Create Company Record** (via signup or admin panel):
   ```sql
   INSERT INTO companies (name, slug, domain, email, ...)
   VALUES ('Pizza Palace', 'pizzapalace', 'pizzapalace.redsorm.in', ...);
   ```

2. **Their subdomain is automatically available**:
   - URL: `https://pizzapalace.redsorm.in`
   - No additional DNS setup needed (wildcard handles it!)

3. **Company data is isolated**:
   - All menu items, tables, orders filtered by `company_id`
   - Your existing multitenancy code handles this

---

## TROUBLESHOOTING

### Issue: DNS not propagating
**Solution**: 
- Wait 24-48 hours
- Clear browser cache
- Use incognito mode
- Check https://dnschecker.org

### Issue: SSL certificate error
**Solution**:
- Wait for Vercel/Render to issue certificate (up to 10 mins)
- Verify DNS records are correct
- Check Vercel/Render dashboard for status

### Issue: CORS errors
**Solution**:
- Verify backend CORS regex includes `redsorm.in`
- Check API URL is `api.redsorm.in`
- Verify backend deployment is latest version
- Check browser console for exact error

### Issue: Subdomain not working
**Solution**:
- Verify wildcard CNAME is set: `*.redsorm.in → cname.vercel-dns.com.`
- Check company slug in database matches subdomain
- Verify resolveCompany middleware is working
- Check browser console for errors

### Issue: Main domain works but subdomains don't
**Solution**:
- Verify Vercel has `*.redsorm.in` domain added
- Check wildcard CNAME record in Hostinger
- Wait for DNS propagation

---

## FINAL CHECKLIST

✅ Domain purchased from Hostinger
✅ Vercel project configured with 3 domains
✅ Hostinger DNS has 4 records (A, www, *, api)
✅ Render custom domain added
✅ Backend CORS updated with redsorm.in
✅ Backend deployed to Render
✅ Frontend env vars updated
✅ Frontend redeployed to Vercel
✅ DNS propagation complete
✅ SSL certificates issued
✅ Main domain loads
✅ API domain responds
✅ Test subdomain works
✅ No CORS errors

---

## SECURITY NOTES

1. **Always use HTTPS** in production
2. **JWT tokens** should be secure and expire appropriately
3. **Database credentials** should be in environment variables only
4. **CORS** should only allow your domains (not `*`)
5. **SSL certificates** are auto-renewed by Vercel/Render

---

## COST BREAKDOWN (Approx)

- Domain (redsorm.in): ₹800-1200/year (Hostinger)
- Vercel: Free for hobby, $20/month for Pro (if needed)
- Render: Free tier or $7/month for paid
- Aiven: Based on your current plan

Total: ~₹1000-2000/year minimum

---

## NEXT STEPS AFTER SETUP

1. **Add custom branding** for each client subdomain
2. **Email notifications** with proper sender domain
3. **Analytics** to track usage per subdomain
4. **Backup strategy** for database
5. **Monitoring** for uptime and errors

---

Generated: 2025-12-15
Your multitenancy system with redsorm.in is ready! 🚀
