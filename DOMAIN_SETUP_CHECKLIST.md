# QUICK SETUP CHECKLIST FOR REDSORM.IN

## ✅ IMMEDIATE ACTIONS (Do these first)

### 1. VERCEL - Add Domains (5 minutes)
- [ ] Go to https://vercel.com → Your Project → Settings → Domains
- [ ] Add: `redsorm.in`
- [ ] Add: `www.redsorm.in`  
- [ ] Add: `*.redsorm.in`
- [ ] **Copy the DNS records Vercel shows you** (you'll need these!)

### 2. HOSTINGER - Configure DNS (10 minutes)
- [ ] Login to https://www.hostinger.com
- [ ] Domains → redsorm.in → Manage → DNS/Nameservers
- [ ] **Delete existing A and CNAME records**
- [ ] Add **A Record**: 
  - Name: `@`
  - Value: `76.76.21.21` (use Vercel's IP)
- [ ] Add **CNAME**: 
  - Name: `www`
  - Value: `cname.vercel-dns.com.`
- [ ] Add **CNAME**:
  - Name: `*`
  - Value: `cname.vercel-dns.com.`
- [ ] Add **CNAME**:
  - Name: `api`
  - Value: `[your-render-app].onrender.com.`
- [ ] **SAVE**

### 3. RENDER - Add Custom Domain (5 minutes)
- [ ] Go to https://dashboard.render.com
- [ ] Select your backend service
- [ ] Settings → Custom Domain → Add Custom Domain
- [ ] Enter: `api.redsorm.in`
- [ ] Save (SSL will auto-configure)

### 4. BACKEND CODE - Update CORS (2 minutes)
✅ **ALREADY DONE!** The code has been updated.
- [ ] Commit and push changes:
  ```bash
  cd backend
  git add server.js
  git commit -m "Add redsorm.in to CORS"
  git push
  ```
- [ ] Render will auto-deploy

### 5. FRONTEND ENV - Update API URL (5 minutes)
- [ ] Vercel Dashboard → Settings → Environment Variables
- [ ] Find `REACT_APP_API_URL`
- [ ] Set to: `https://api.redsorm.in`
- [ ] **Redeploy frontend**

---

## ⏰ WAIT (1-24 hours)
- DNS propagation: Usually 1-2 hours, max 48 hours
- Check status: https://dnschecker.org/#A/redsorm.in

---

## 🧪 TESTING (After DNS propagates)

### Test Main Domain
```bash
# Should load your app
https://redsorm.in
https://www.redsorm.in
```

### Test API
```bash
# Should return {"status":"ok",...}
https://api.redsorm.in/api/health
```

### Test Client Subdomain
```bash
# Create a test company with slug "test"
# Then visit:
https://test.redsorm.in
```

---

## 📋 DNS RECORDS SUMMARY

| Type  | Name | Value                      | TTL  |
|-------|------|----------------------------|------|
| A     | @    | 76.76.21.21               | 3600 |
| CNAME | www  | cname.vercel-dns.com.     | 3600 |
| CNAME | *    | cname.vercel-dns.com.     | 3600 |
| CNAME | api  | [your-app].onrender.com.  | 3600 |

---

## 🔧 TROUBLESHOOTING

**"Site can't be reached"**
→ DNS not propagated yet, wait longer

**CORS errors**
→ Backend not deployed with new code, check Render

**SSL certificate error**
→ Wait 10 minutes for auto-issue

**Subdomain not working**
→ Check company.slug in database matches URL

---

## 📞 SUPPORT

For detailed guide, see: `DOMAIN_INTEGRATION_GUIDE.md`

**Common Issues:**
- DNS: Usually fixed by waiting
- CORS: Check backend deployment
- SSL: Auto-fixes in 10 minutes

---

SETUP TIME: ~30 minutes + DNS waiting
DIFFICULTY: Medium
COST: ~₹1000/year
