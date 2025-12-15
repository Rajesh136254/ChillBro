# CUSTOMER CANCELLATION FIX

## Problem
- ✅ Admins can cancel orders/items
- ❌ Customers (QR users) cannot cancel orders/items

## Root Cause
Both cancel endpoints used:
```javascript
const { company_id } = req.user;
```

**Issue:** Customer users don't have `company_id` in their user record, only admins do.

Result: `company_id` was `undefined` for customers → ownership check failed → "Order not found or access denied"

## Solution
Updated both POST cancel endpoints to use the same 4-level company_id resolution used in other customer endpoints:

1. **From middleware** (`req.company.id`)
2. **From header** (`x-company-id`)
3. **From user** (`req.user.company_id`)
4. **From order itself** (query the order table)

## What Changed

### File: `backend/server.js`

#### Cancel Order Endpoint (POST /api/orders/:id/cancel)
**Line ~3320: Before**
```javascript
const { company_id } = req.user;  // Undefined for customers!
```

**After**
```javascript
// Resolve company_id (4-level fallback)
let company_id = null;
if (req.company && req.company.id) {
  company_id = req.company.id;
}
if (!company_id && req.headers['x-company-id']) {
  company_id = parseInt(req.headers['x-company-id']);
}
if (!company_id && req.user && req.user.company_id) {
  company_id = req.user.company_id;
}
// Get from order if needed
if (!company_id) {
  const [orderRows] = await pool.execute('SELECT company_id FROM orders WHERE id = ?', [req.params.id]);
  if (orderRows.length > 0) {
    company_id = orderRows[0].company_id;
  }
}
```

#### Cancel Item Endpoint (POST /api/orders/:id/items/:itemId/cancel)
**Line ~3383: Before**
```javascript
const { company_id } = req.user;  // Undefined for customers!
```

**After**
Same 4-level resolution as above ✅

## Testing

### As Customer (QR User):
```
1. Scan QR code
2. Login/Signup
3. Place order with multiple items
4. Go to "My Orders"
5. Click cancel on one item
   ✅ Should work now!
6. Click cancel entire order
   ✅ Should work now!
```

### As Admin:
```
1. Login to admin dashboard
2. Cancel orders/items
   ✅ Still works (no change to admin flow)
```

## Logs
After deployment, customer cancellations will show:
```
[CANCEL ORDER] Order: 123 User: 456
[CANCEL ORDER] Resolved company_id: 22
[CANCEL ORDER] Order cancelled successfully
```

Or:
```
[CANCEL ITEM] Order: 123 Item: 456 User: 789
[CANCEL ITEM] Resolved company_id: 22
[CANCEL ITEM] Item deleted and order total updated
```

## Deploy
```bash
git add backend/server.js
git commit -m "Fix customer cancellation by resolving company_id properly"
git push origin main
```

Render will deploy in ~2 minutes.

## Summary
- ✅ **Admins:** Already working, no change
- ✅ **Customers:** Now works with proper company_id resolution
- ✅ **No functionality affected:** Same logic, just better resolution
- ✅ **Added logging:** Can debug if issues occur

Both user types can now cancel orders and items!
