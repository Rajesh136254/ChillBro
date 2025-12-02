# Forgot Password Implementation Guide

## ✅ What's Been Created

I've created a reusable **Forgot Password Modal** component that integrates with your backend API.

### Files Created:
1. `src/components/ForgotPasswordModal.js` - Modal component
2. `src/components/ForgotPasswordModal.css` - Styling

## 🔧 How to Integrate

### For `SignupPage.js` (Admin Signup)

#### Step 1: Import the Component
Add at the top of `src/pages/SignupPage.js` (around line 3):

```javascript
import ForgotPasswordModal from '../components/ForgotPasswordModal';
```

#### Step 2: Add State for Modal
Add this state with the other useState declarations (around line 22):

```javascript
const [showForgotPassword, setShowForgotPassword] = useState(false);
```

#### Step 3: Add Forgot Password Link in Login Form
Find the login submit button section (around line 506), and ADD this BEFORE the form footer (around line 509):

```javascript
                </form>

                {/* Add Forgot Password Link - ADD THIS */}
                {mode === "login" && (
                  <div className="signup-forgot-password-link">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <div className="signup-form-footer">
```

#### Step 4: Add Modal Component
At the very end, just before the closing `</div>` tags (around line 520), add:

```javascript
        )}
      </div>

      {/* Forgot Password Modal - ADD THIS */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        API_URL={API_URL}
      />
    </div>
  );
}
```

---

### For `UserSignupPage.js` (Customer Signup)

#### Step 1: Import the Component
Add at the top of `src/pages/UserSignupPage.js` (around line 5):

```javascript
import ForgotPasswordModal from'../components/ForgotPasswordModal';
```

#### Step 2: Add State and API URL
Add these with the other useState declarations (around line 19):

```javascript
const [showForgotPassword, setShowForgotPassword] = useState(false);
const API_URL = process.env.REACT_APP_API_URL || 'https://dineflowbackend.onrender.com';
```

#### Step 3: Add Forgot Password Link
Find the submit button (around line 201), and ADD this AFTER the closing `</form>` tag:

```javascript
                    </form>

                    {/* Forgot Password Link - ADD THIS */}
                    <div className="text-center mt-4">
                        <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                        >
                            Forgot your password?
                        </button>
                    </div>
                </div>
```

#### Step 4: Add Modal Component
At the very bottom, just before the final closing `</div>` (around line 206), add:

```javascript
            </div>

            {/* Forgot Password Modal - ADD THIS */}
            <ForgotPasswordModal
                isOpen={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                API_URL={API_URL}
            />
        </div>
    );
};
```

---

## 🎨 Additional CSS (Optional Enhancement)

If you want to add the CSS import to ForgotPasswordModal.js, add this at the top:

```javascript
import './ForgotPasswordModal.css';
```

Or you can add the modal CSS to your existing SignupPage.css file.

---

## 📋 Complete Integration Checklist

### ✅ SignupPage.js
- [ ] Import ForgotPasswordModal component
- [ ] Add `showForgotPassword` state
- [ ] Add "Forgot Password?" link in login mode
- [ ] Add `<ForgotPasswordModal />` component at the end

###✅ UserSignupPage.js
- [ ] Import ForgotPasswordModal component
- [ ] Add `showForgotPassword` state and `API_URL` constant
- [ ] Add "Forgot your password?" link after form
- [ ] Add `<ForgotPasswordModal />` component at the end

---

## 🧪 How to Test

1. **Start your frontend**: `npm start` in dineflowreact folder
2. **Navigate to signup page**
3. **Switch to Login mode** (in SignupPage.js)
4. **Click "Forgot Password?"** link
5. **Enter an email** that exists in your database
6. **Click "Send Reset Link"**
7. **Check backend console** for the reset token (since email service isn't configured yet)

### Expected Behavior:
- Modal opens smoothly with animation
- Email validation works
- Success message shows after sending
- Modal closes automatically after 3 seconds
- Backend logs the reset token to console

---

## 🔑 Backend Integration

TThe backend already has these endpoints implemented:
- ✅ `POST /api/auth/forgot-password` - Generates reset token
- ✅ `POST /api/auth/reset-password` - Resets password with token

### Current State:
- Reset token is **logged to console** (for development)
- Token expires in **1 hour**
- Stored in database in `reset_token` and `reset_token_expires` fields

### For Production:
You'll need to integrate an email service (SendGrid, AWS SES, etc.) to actually send the reset link via email instead of console logging.

---

## 🎯 Quick Copy-Paste Sections

### SignupPage.js - Import Section
```javascript
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import './SignupPage.css';
import ForgotPasswordModal from '../components/ForgotPasswordModal';  // ADD THIS LINE
```

### SignupPage.js - State Section (add after line 22)
```javascript
const [authError, setAuthError] = useState("");
const [showForgotPassword, setShowForgotPassword] = useState(false);  // ADD THIS LINE
```

That's it! The modal component is fully self-contained and handles all the forgot password logic.

---

## Need Help?

If you encounter any issues:
1. Check browser console for errors
2. Verify API_URL is correct
3. Ensure backend is running
4. Check that the ForgotPasswordModal files are in the correct location

The implementation is designed to be non-intrusive and won't affect any existing functionality!
