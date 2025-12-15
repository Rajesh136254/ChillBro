# QR Code Branch Integration Summary

I have updated the system to ensure that QR codes include branch information, and that scanning them correctly redirects users to the specific branch context after authentication.

## 1. QR Code Generation (Admin Dashboard)
- **File**: `src/pages/AdminPage.js`
- **Change**: Updated `generateQRCode` function to include `branch_id` in the generated URL.
- **Result**: QR Code URL format is now: `domain/customer.html?table=X&companyId=Y&branch_id=Z`

## 2. Customer Page Context Handling
- **File**: `src/pages/CustomerPage.js`
- **Change**: Added logic to detect `branch_id` from the URL Query Parameters.
- **Result**: When a user lands on the page with `branch_id`, the `BranchContext` is automatically updated to that branch, filtering the menu and orders strictly for that location.

## 3. Persistent Authentication Flow
- **Files**: `src/pages/CustomerPage.js`, `src/pages/CustomerAuthPage.js`
- **Change**: Updated redirection logic to preserve `branch_id` when forcing a user to Login/Signup.
- **Result**:
    1. User scans QR -> Redirects to Login/Signup (URL Params Preserved).
    2. User Authenticates -> Redirects back to `customer.html` (URL Params Preserved).
    3. User sees specific branch menu.

## Verification
1. Go to Admin -> Tables -> Click "QR" for a table assigned to a branch.
2. Scan the code (or copy the URL).
3. Ensure the URL contains `branch_id`.
4. Open the URL incognito. You should be redirected to Login, then back to Customer Page, and the correct Branch should be selected in the UI.
