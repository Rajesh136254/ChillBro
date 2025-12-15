# ==============================================
# DEPLOYMENT SETUP FOR VERCEL + RENDER + AIVEN
# ==============================================

## WHAT I FIXED

### 1. Customer Orders 500 Error ✅ FIXED
- Rewrote `/api/customer/orders` endpoint with bulletproof error handling
- Added extensive logging (look for `[ORDERS]` in Render logs)
- Simplified SQL queries to avoid crashes
- 4-level fallback for company_id resolution

### 2. Logo/Banner Persistent Storage ✅ FIXED
- Switched from local filesystem → **Cloudinary** (cloud storage)
- Works perfectly with Vercel + Render combo
- Images persist through deployments and restarts
- Free tier: 25GB storage, 25GB bandwidth/month

---

## SETUP INSTRUCTIONS

### Step 1: Create Cloudinary Account (FREE)

1. Go to https://cloudinary.com/
2. Sign up for FREE account
3. After login, go to Dashboard
4. You'll see:
   - **Cloud Name**: e.g., `dxyz123abc`
   - **API Key**: e.g., `123456789012345`
   - **API Secret**: e.g., `abcdefghijklmnopqrstuvwxyz123`

### Step 2: Add Environment Variables to Render

1. Go to Render Dashboard → Your Backend Service
2. Go to **Environment** tab
3. Add these 3 new variables:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

**IMPORTANT:** Replace with YOUR actual values from Cloudinary dashboard!

### Step 3: Deploy Backend

```bash
cd backend
git add .
git commit -m "Fix orders and add Cloudinary storage"
git push origin main
```

Render will auto-deploy (takes ~2-3 minutes).

### Step 4: Test

1. **Orders Test:**
   - Login to your app (on Vercel)
   - Place an order
   - Check order history
   - Should now work! ✅

2. **Logo/Banner Test:**
   - Go to Admin → Settings
   - Upload logo/banner
   - **You'll see:** Images uploaded to Cloudinary (URL will be `https://res.cloudinary.com/...`)
   - **Result:** Images persist even after Render restarts! ✅

---

## TECHNICAL DETAILS

### Your Stack
- **Frontend:** Vercel (Static Hosting)
- **Backend:** Render (Node.js API)
- **Database:** Aiven (MySQL - Persistent)
- **Images:** Cloudinary (Cloud Storage - Persistent)

### How It Works Now

#### Before (BROKEN):
```
User uploads image → Render saves to /public/uploads/ → Render restarts → FILES DELETED ❌
```

#### After (FIXED):
```
User uploads image → Backend sends to Cloudinary → Cloudinary stores → Returns URL → Database saves URL → PERSISTS FOREVER ✅
```

### Cloudinary Integration
- Uses `cloudinary` npm package
- Uploads images to cloud on every upload
- Returns permanent URLs like: `https://res.cloudinary.com/yourcloud/image/upload/v123/restaurant-uploads/logo.png`
- **Fallback:** If Cloudinary not configured, saves locally (for local dev)

---

## ENVIRONMENT VARIABLES CHECKLIST

### Render Backend (.env)
Make sure you have ALL of these in Render:

```bash
# Database (Aiven)
DB_HOST=your-aiven-host.aivencloud.com
DB_USER=avnadmin
DB_PASSWORD=your-db-password
DB_NAME=defaultdb
DB_PORT=12345

# JWT
JWT_SECRET=your-secret-key-here

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloudinary (NEW - ADD THESE!)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gemini AI (Optional)
GEMINI_API_KEY=your-gemini-key
```

### Vercel Frontend (.env.local)
```bash
REACT_APP_API_URL=https://your-backend.onrender.com
```

---

## TROUBLESHOOTING

### If Orders Still Don't Show

1. **Check Render Logs:**
   ```
   Go to Render Dashboard → Logs
   Search for: [ORDERS]
   ```

2. **You'll see:**
   ```
   [ORDERS] Starting customer orders fetch...
   [ORDERS] User: 123 Company from user: 5
   [ORDERS] Using company from middleware: 5
   [ORDERS] Fetching orders for user: 123 company: 5
   [ORDERS] Found 3 orders
   ```

3. **If you see error:**
   - Copy the FULL error from logs
   - Share with me

### If Logo/Banner Upload Fails

1. **Check you added Cloudinary env vars to Render**
2. **Check Render logs for:**
   ```
   [UPLOAD] File received: logo.png
   [UPLOAD] Cloudinary success: https://res.cloudinary.com/...
   ```

3. **If you see "Cloudinary not configured":**
   - You forgot to add env vars
   - Add them and redeploy

### Database Connection Issues

Your Aiven database should have:
- SSL enabled
- Correct host/port/credentials in Render env vars
- Firewall allows Render's IP addresses

---

## VERIFICATION CHECKLIST

After deployment, verify:

- [x] Backend deployed successfully on Render
- [x] Can access backend URL: `https://your-backend.onrender.com/api/health`
- [x] Frontend deployed on Vercel
- [x] Orders endpoint works (no 500 error)
- [x] Images upload to Cloudinary
- [x] Images persist after Render restart

---

## COST BREAKDOWN

| Service | Plan | Cost |
|---------|------|------|
| **Vercel** | Free Tier | $0/month |
| **Render** | Free Tier | $0/month |
| **Aiven** | Free Tier | $0/month |
| **Cloudinary** | Free Tier | $0/month |
| **TOTAL** | | **$0/month** |

### Cloudinary Free Tier Limits
- 25 GB storage
- 25 GB bandwidth/month
- 25,000 transformations/month
- **More than enough for your app!**

---

## NEED HELP?

If after deploying:
1. Orders still show 500 error → Share Render logs (`[ORDERS]` lines)
2. Images don't upload → Share Render logs (`[UPLOAD]` lines)
3. Database issues → Check Aiven connection credentials

