# SIMPLE INTEGRATION GUIDE - DO THIS MANUALLY

## I've created the forgot password component files for you!

✅ Created: `src/components/ForgotPasswordModal.js`
✅ Created: `src/components/ForgotPasswordModal.css`

Now you just need to add **3 small pieces of code** to each signup page.

---

## FOR SIGNUPPAGE.JS (Admin Signup)

### Change 1: Add Import (Line 3)
**Find this (line 1-3):**
```javascript
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import './SignupPage.css';
```

**Change to:**
```javascript
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import './SignupPage.css';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
```

### Change 2: Add State (Line 22)
**Find this (line 21-22):**
```javascript
  const formRef = useRef(null);
  const [authError, setAuthError] = useState("");
```

**Change to:**
```javascript
  const formRef = useRef(null);
  const [authError, setAuthError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
```

### Change 3: Add Forgot Password Link (After Line 506)
**Find this section (around line 495-515):**
```javascript
                  </button>
                </form>

                <div className="signup-form-footer">
                  {mode === "signup" ? (
                    <>Already have an account? <span onClick={() => setMode("login")}>Login</span></>
                  ) : (
                    <>Need an account? <span onClick={() => setMode("signup")}>Sign Up</span></>
                  )}
                </div>
```

**Change to:**
```javascript
                  </button>
                </form>

                {/* Forgot Password Link */}
                {mode === "login" && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#667eea',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: '0.875rem'
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <div className="signup-form-footer">
                  {mode === "signup" ? (
                    <>Already have an account? <span onClick={() => setMode("login")}>Login</span></>
                  ) : (
                    <>Need an account? <span onClick={() => setMode("signup")}>Sign Up</span></>
                  )}
                </div>
```

### Change 4: Add Modal Component (Before Last closing div, around line 519)
**Find this (very end of file):**
```javascript
          </div>
        )}
      </div>
    </div>
  );
}
```

**Change to:**
```javascript
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
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

## FOR USERSIGNUPPAGE.JS (Customer Signup)

### Change 1: Add Import (Line 5)
**Find this (lines 2-5):**
```javascript
import React, { useState, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
```

**Change to:**
```javascript
import React, { useState, useContext } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
```

### Change 2: Add State and API_URL (Line 19)
**Find this (lines 14-19):**
```javascript
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tableNumber = searchParams.get('table') || '1';
    const { t, language, changeLanguage } = useLanguage();
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
```

**Change to:**
```javascript
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tableNumber = searchParams.get('table') || '1';
    const { t, language, changeLanguage } = useLanguage();
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const API_URL = process.env.REACT_APP_API_URL || 'https://dineflowbackend.onrender.com';
```

### Change 3: Add Forgot Password Link (After Line 203)
**Find this (lines 201-204):**
```javascript
                            </button>
                        </div>
                    </form>
                </div>
```

**Change to:**
```javascript
                            </button>
                        </div>
                    </form>

                    {/* Forgot Password Link */}
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

### Change 4: Add Modal Component (Before Last closing div, around line 206)
**Find this (very end of file):**
```javascript
            </div>
        </div>
    );
};

export default UserSignupPage;
```

**Change to:**
```javascript
            </div>

            {/* Forgot Password Modal */}
            <ForgotPasswordModal
                isOpen={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
                API_URL={API_URL}
            />
        </div>
    );
};

export default UserSignupPage;
```

---

## THAT'S IT!

After making these changes:
1. Save both files
2. The app will automatically reload
3. Go to the signup page and switch to "Login" mode
4. You'll see "Forgot Password?" link
5. Click it to test the modal

The backend already has the forgot password API working - it will log the reset token to the console!
