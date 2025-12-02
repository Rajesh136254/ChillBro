# Multi-Tenant Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REGISTRATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

1. User Signs Up
   ↓
   POST /api/auth/register
   {
     "name": "John Doe",
     "company_name": "Johns Pizza",
     "email": "john@example.com",  
     "password": "secret123"
   }
   ↓
2. Server Generates Slug
   "Johns Pizza" → "johns-pizza"
   ↓
3. Creates Company Record
   companies: {
     id: 1,
     name: "Johns Pizza",
     slug: "johns-pizza",
     domain: null
   }
   ↓
4. Creates Admin User
   users: {
     id: 1,
     name: "John Doe",
     email: "john@example.com",
     company_id: 1,
     role: "admin"
   }
   ↓
5. Returns Subdomain Info
   {
     "success": true,
     "token": "jwt...",
     "user": {...},
     "company": {
       "slug": "johns-pizza",
       "subdomainUrl": "https://johns-pizza.vercel.app"
     }
   }


┌─────────────────────────────────────────────────────────────────┐
│                    SUBDOMAIN ACCESS FLOW                         │
└─────────────────────────────────────────────────────────────────┘

User accesses: https://johns-pizza.vercel.app
   ↓
1. Browser sends request to Vercel
   Host: johns-pizza.vercel.app
   ↓
2. Subdomain Middleware extracts "johns-pizza"
   extractSubdomain("johns-pizza.vercel.app") → "johns-pizza"
   ↓
3. Database lookup
   SELECT * FROM companies WHERE slug = 'johns-pizza'
   ↓
4. Sets request context
   req.companyId = 1
   req.companySlug = "johns-pizza"
   req.companyName = "Johns Pizza"
   ↓
5. All subsequent queries filter by company_id
   SELECT * FROM menu_items WHERE company_id = 1
   SELECT * FROM orders WHERE company_id = 1
   SELECT * FROM tables WHERE company_id = 1


┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE ISOLATION                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   COMPANIES      │
├──────────────────┤
│ id │ slug        │
├────┼─────────────┤
│ 1  │ johns-pizza │
│ 2  │ marias-cafe │
│ 3  │ roys-bistro │
└────┴─────────────┘
       ↓ company_id (foreign key)
       ↓
┌──────────────────────────────┐
│      MENU_ITEMS              │
├──────────────────────────────┤
│ id │ name      │ company_id  │
├────┼───────────┼─────────────┤
│ 1  │ Margherita│ 1           │ ← Johns Pizza
│ 2  │ Pepperoni │ 1           │ ← Johns Pizza
│ 3  │ Espresso  │ 2           │ ← Marias Cafe
│ 4  │ Steak     │ 3           │ ← Roys Bistro
└────┴───────────┴─────────────┘

Each company only sees their own data!
Johns Pizza cannot access Marias Cafe's menu items.


┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

                    ┌────────────────┐
                    │   DNS/Vercel   │
                    │  *.vercel.app  │
                    └────────┬───────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ↓                   ↓                   ↓
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  johns-pizza   │  │  marias-cafe   │  │  roys-bistro   │
│  .vercel.app   │  │  .vercel.app   │  │  .vercel.app   │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ↓
                  ┌──────────────────────┐
                  │   Backend API        │
                  │  dineflowbackend     │
                  │  .onrender.com       │
                  └──────────┬───────────┘
                             │
                             ↓
                     ┌───────────────┐
                     │   MySQL DB    │
                     │  Single DB    │
                     │  with company │
                     │  isolation    │
                     └───────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY MODEL                                │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Subdomain Extraction
   - Middleware automatically determines company from URL
   - No user input required

Layer 2: Database Queries
   - ALL queries include: WHERE company_id = ?
   - Impossible to access other company's data

Layer 3: Authentication
   - JWT token includes companyId
   - Token validated on every request
   - User can only belong to ONE company

Layer 4: Authorization
   - Role-based access (admin, staff, customer)
   - Scoped within company

Data Flow Example:
   User → Subdomain → Company Lookup → Set companyId → Query Filter
   johns-pizza.vercel.app → company_id=1 → SQL WHERE company_id=1


┌─────────────────────────────────────────────────────────────────┐
│                    FUTURE: CUSTOM DOMAINS                        │
└─────────────────────────────────────────────────────────────────┘

Current:  johns-pizza.vercel.app
Future:   orders.johnspizza.com

Steps:
1. Customer purchases domain: johnspizza.com
2. Sets up wildcard DNS: *.johnspizza.com → Vercel
3. Updates company record: domain = 'johnspizza.com'
4. Users access: orders.johnspizza.com
5. Middleware extracts subdomain: "orders"
      (But looks up by custom domain, not slug)


┌─────────────────────────────────────────────────────────────────┐
│                    FALLBACK MECHANISM                            │
└─────────────────────────────────────────────────────────────────┘

IF no subdomain detected:
   ↓
Check query params: ?companyId=1
   ↓
Check headers: X-Company-Id: 1
   ↓
Check body: { companyId: 1 }
   ↓
Default: null (for backwards compatibility)

This ensures the system works:
- With subdomains (primary method)
- Without subdomains (testing, development)
- With direct API calls (admin tools, testing)
```

## Key Benefits

✅ **Single Database**: Easier to manage, backup, scale
✅ **Strong Isolation**: SQL-level filtering prevents data leaks
✅ **Easy Scaling**: Add new tenants without infrastructure changes
✅ **Cost Effective**: Shared resources across all tenants
✅ **Professional**: Each company gets their own branded URL
✅ **Flexible**: Support for custom domains in future

## Implementation Details

- **Slug Generation**: Automatic, URL-safe, guaranteed unique
- **Middleware**: Runs on every request, transparent to endpoints
- **Backwards Compatible**: Existing code continues to work
- **No Breaking Changes**: Additive implementation only
- **Test Friendly**: Dev environment works without DNS setup
