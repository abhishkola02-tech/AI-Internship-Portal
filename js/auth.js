// js/auth.js
// Handles user login, sign up, Google Sign-In, form validations, password visibility toggles, and state redirects.

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    saveUserProfile, 
    updateUserProfile,
    signInWithGoogle,
    isMock 
} from './firebase.js';

// Alert Display Helper
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alert-box');
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = alertBox.querySelector('.alert-icon');
    
    if (!alertBox || !alertMsg) return;
    
    // Set text
    alertMsg.textContent = message;
    
    // Set style
    alertBox.className = `alert-box ${type}`;
    
    // Set icon
    if (alertIcon) {
        alertIcon.className = 'alert-icon fa-solid';
        if (type === 'success') {
            alertIcon.classList.add('fa-circle-check');
        } else {
            alertIcon.classList.add('fa-circle-exclamation');
        }
    }
    
    // Reveal
    alertBox.classList.remove('hidden');
    
    // Auto-scroll to top of card to make it visible
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
    const alertBox = document.getElementById('alert-box');
    if (alertBox) {
        alertBox.classList.add('hidden');
    }
}

// Translate Firebase auth error messages into user-friendly ones
function getFriendlyErrorMessage(error) {
    console.error("Auth error caught:", error);
    const errorCode = error.code || error.message || "";
    
    if (errorCode.includes('user-not-found')) {
        return "No account exists with this email address. Please register.";
    }
    if (errorCode.includes('wrong-password') || errorCode.includes('invalid-credential')) {
        return "Incorrect email or password. Please try again.";
    }
    if (errorCode.includes('email-already-in-use')) {
        return "This email address is already registered. Please login.";
    }
    if (errorCode.includes('invalid-email')) {
        return "The email address is formatted incorrectly.";
    }
    if (errorCode.includes('weak-password')) {
        return "The password is too weak. It must contain at least 6 characters.";
    }
    if (errorCode.includes('network-request-failed')) {
        return "Network connection error. Check your internet connectivity.";
    }
    if (errorCode.includes('popup-closed-by-user')) {
        return "Google Sign-In was cancelled. Please try again.";
    }
    if (errorCode.includes('popup-blocked')) {
        return "Pop-up was blocked by your browser. Please allow pop-ups for this site.";
    }
    if (errorCode.includes('unauthorized-domain')) {
        const domain = window.location.hostname || 'this domain';
        return `Domain unauthorized: "${domain}" is not added to Firebase Authorized Domains. Add "${domain}" in Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    
    return error.message || "An unexpected error occurred. Please try again.";
}

// Set loading state on button
function setLoading(buttonId, isLoading, defaultText = "Submit", defaultIcon = "fa-arrow-right") {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> <span>Loading...</span>`;
    } else {
        btn.disabled = false;
        btn.innerHTML = `<span>${defaultText}</span> <i class="fa-solid ${defaultIcon}"></i>`;
    }
}

// Bind password hide/show buttons
function setupPasswordToggles() {
    // Single password field (Login)
    const passToggle = document.getElementById('password-toggle');
    const passInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggle-icon');
    
    if (passToggle && passInput && toggleIcon) {
        passToggle.addEventListener('click', () => {
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';
            toggleIcon.className = isPassword ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        });
    }

    // Confirm password field (Register)
    const confToggle = document.getElementById('confirm-password-toggle');
    const confInput = document.getElementById('confirmPassword');
    const confIcon = document.getElementById('confirm-toggle-icon');
    
    if (confToggle && confInput && confIcon) {
        confToggle.addEventListener('click', () => {
            const isPassword = confInput.type === 'password';
            confInput.type = isPassword ? 'text' : 'password';
            confIcon.className = isPassword ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        });
    }
}

// GOOGLE SIGN-IN FLOW
async function handleGoogleSignIn() {
    hideAlert();
    const googleBtn = document.getElementById('btn-google');
    
    if (googleBtn) {
        googleBtn.disabled = true;
        googleBtn.innerHTML = `<span class="spinner"></span> <span>Signing in...</span>`;
    }
    
    try {
        const result = await signInWithGoogle();
        const user = result.user;
        
        const emailName = user.email ? user.email.split('@')[0].split(/[\._\-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') : "Student";
        const initialProfile = {
            uid: user.uid,
            name: (user.displayName && user.displayName !== "Google User") ? user.displayName : emailName,
            email: user.email || "",
            phone: user.phoneNumber || "",
            branch: "",
            cgpa: "",
            skills: [],
            interests: "",
            certifications: "",
            resumeUrl: "",
            githubUrl: "",
            linkedinUrl: "",
            createdAt: new Date().toISOString()
        };
        
        localStorage.setItem("mock_current_user", JSON.stringify({
            uid: user.uid,
            email: user.email || "",
            displayName: initialProfile.name
        }));
        
        await saveUserProfile(user.uid, initialProfile);
        
        showAlert("Signed in with Google! Redirecting...", "success");
        
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1200);
    } catch (err) {
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="google-icon"> <span>Continue with Google</span>`;
        }
        showAlert(getFriendlyErrorMessage(err), "error");
    }
}

// LOGIN FLOW
async function handleLogin() {
    hideAlert();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAlert("Please fill in both Email and Password fields.");
        return;
    }
    
    setLoading('btn-login', true, 'Log In');
    
    try {
        const userCredential = await signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        localStorage.setItem("mock_current_user", JSON.stringify({
            uid: user.uid,
            email: user.email || email,
            displayName: user.displayName || email.split('@')[0]
        }));
        
        showAlert("Login successful! Redirecting...", "success");
        console.log("Logged in user:", user);
        
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1200);
    } catch (err) {
        setLoading('btn-login', false, 'Log In', 'fa-arrow-right');
        showAlert(getFriendlyErrorMessage(err), "error");
    }
}

// REGISTER FLOW
async function handleRegister() {
    hideAlert();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Client-side validations
    if (!name || !email || !phone || !password || !confirmPassword) {
        showAlert("All registration fields are required.");
        return;
    }
    
    if (password.length < 6) {
        showAlert("Password must be at least 6 characters long.");
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert("Passwords do not match. Please verify.");
        return;
    }
    
    setLoading('btn-register', true, 'Register');
    
    try {
        // 1. Create firebase auth user account
        const userCredential = await createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // 2. Set profile display name
        await updateUserProfile(user, { displayName: name });
        
        localStorage.setItem("mock_current_user", JSON.stringify({
            uid: user.uid,
            email: email,
            displayName: name
        }));
        
        // 3. Store initial profile info inside Firestore DB
        const initialProfile = {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone,
            branch: "",
            cgpa: "",
            skills: [],
            interests: "",
            certifications: "",
            resumeUrl: "",
            githubUrl: "",
            linkedinUrl: "",
            createdAt: new Date().toISOString()
        };
        
        await saveUserProfile(user.uid, initialProfile);
        
        showAlert("Account created successfully! Loading your dashboard...", "success");
        console.log("Registered new user and saved in DB:", user);
        
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);
    } catch (err) {
        setLoading('btn-register', false, 'Register', 'fa-user-plus');
        showAlert(getFriendlyErrorMessage(err), "error");
    }
}

// DOM WIRING — must handle the case where DOMContentLoaded already fired
// (this happens because firebase.js has a top-level await that delays this module)
function initAuthPage() {
    console.log("✅ auth.js: Initializing page handlers...");
    setupPasswordToggles();
    
    // Bind login form if present
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
        console.log("✅ Login form handler attached.");
    }
    
    // Bind register form if present
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRegister();
        });
        console.log("✅ Register form handler attached.");
    }

    // Google Sign-In Button
    const googleBtn = document.getElementById('btn-google');
    if (googleBtn) {
        googleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleGoogleSignIn();
        });
        console.log("✅ Google Sign-In handler attached.");
    }
}

// If the DOM is still loading, wait. Otherwise, run immediately.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    // DOM already loaded — run init right now
    initAuthPage();
}

