// js/firebase.js
// Firebase v11 Modular SDK Initialization & Mock Sandbox Fallback
// Includes seamless automatic fallback if Cloud Firestore / Storage throws permission-denied errors

const firebaseConfig = {
  apiKey: "AIzaSyBeqYM7RYpuFNkK47P6xtpfELrpzve7B4Y",
  authDomain: "ai-intership-e0e64.firebaseapp.com",
  projectId: "ai-intership-e0e64",
  storageBucket: "ai-intership-e0e64.firebasestorage.app",
  messagingSenderId: "623643901643",
  appId: "1:623643901643:web:1aee7ab56fd4137d07e54e",
  measurementId: "G-M477M8BMW6"
};

// Check if mock mode is explicitly forced or missing keys
const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("YOUR_API_KEY");

let app, auth, db, storage;
let firebaseLib = {};

// Helper: Ensure localStorage tables exist
function initLocalStorage() {
    if (!localStorage.getItem("mock_users")) localStorage.setItem("mock_users", JSON.stringify({}));
    if (!localStorage.getItem("mock_applications")) localStorage.setItem("mock_applications", JSON.stringify([]));
    if (!localStorage.getItem("mock_saved")) localStorage.setItem("mock_saved", JSON.stringify([]));
    if (!localStorage.getItem("mock_resume_analysis")) localStorage.setItem("mock_resume_analysis", JSON.stringify({}));
}

initLocalStorage();

// Local Storage Mock Operations (Always available as fallback)
const mockOps = {
    getUserProfile: async (uid) => {
        const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
        return users[uid] || null;
    },
    
    saveUserProfile: async (uid, profileData) => {
        const users = JSON.parse(localStorage.getItem("mock_users") || "{}");
        if (!users[uid]) users[uid] = {};
        users[uid] = { ...users[uid], ...profileData, uid };
        
        try {
            localStorage.setItem("mock_users", JSON.stringify(users));
        } catch (quotaErr) {
            console.warn("localStorage quota reached, sanitizing resumeUrl for local storage:", quotaErr);
            const safeProfile = { ...users[uid] };
            if (safeProfile.resumeUrl && safeProfile.resumeUrl.length > 50000) {
                safeProfile.resumeUrl = "blob:local_resume_pdf";
            }
            users[uid] = safeProfile;
            try {
                localStorage.setItem("mock_users", JSON.stringify(users));
            } catch (e) {
                console.error("Failed to save user profile to localStorage:", e);
            }
        }
        return users[uid];
    },
    
    saveApplication: async (appData) => {
        const apps = JSON.parse(localStorage.getItem("mock_applications") || "[]");
        const id = "app_" + Math.random().toString(36).substring(2, 11);
        const newApp = { id, ...appData, appliedAt: new Date().toISOString() };
        apps.push(newApp);
        localStorage.setItem("mock_applications", JSON.stringify(apps));
        return { id };
    },
    
    getUserApplications: async (uid) => {
        const apps = JSON.parse(localStorage.getItem("mock_applications") || "[]");
        return apps.filter(app => app.userId === uid);
    },
    
    saveSavedInternship: async (saveData) => {
        const saved = JSON.parse(localStorage.getItem("mock_saved") || "[]");
        const id = "saved_" + Math.random().toString(36).substring(2, 11);
        saved.push({ id, ...saveData, savedAt: new Date().toISOString() });
        localStorage.setItem("mock_saved", JSON.stringify(saved));
        return { id };
    },
    
    getUserSavedInternships: async (uid) => {
        const saved = JSON.parse(localStorage.getItem("mock_saved") || "[]");
        return saved.filter(item => item.userId === uid);
    },
    
    uploadResume: async (uid, file, progressCallback) => {
        return new Promise((resolve) => { 
            let progress = 0;
            const interval = setInterval(() => {
                progress += 25;
                if (progressCallback) progressCallback(progress);
                
                if (progress >= 100) {
                    clearInterval(interval);
                    try {
                        const blobUrl = URL.createObjectURL(file);
                        resolve(blobUrl);
                    } catch (e) {
                        const reader = new FileReader();
                        reader.onload = (evt) => resolve(evt.target.result);
                        reader.readAsDataURL(file);
                    }
                }
            }, 100);
        });
    },
    
    getResumeAnalysis: async (uid) => {
        const analysis = JSON.parse(localStorage.getItem("mock_resume_analysis") || "{}");
        return analysis[uid] || null;
    },
    
    saveResumeAnalysis: async (uid, analysisData) => {
        const analysis = JSON.parse(localStorage.getItem("mock_resume_analysis") || "{}");
        analysis[uid] = { ...analysis[uid], ...analysisData, uid };
        try {
            localStorage.setItem("mock_resume_analysis", JSON.stringify(analysis));
        } catch (e) {
            console.warn("Failed to save resume analysis to localStorage:", e);
        }
        return analysis[uid];
    }
};

if (!isMockMode) {
    try {
        // Dynamically import Firebase libraries
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
        const { 
            getAuth, 
            signInWithEmailAndPassword, 
            createUserWithEmailAndPassword, 
            signOut, 
            onAuthStateChanged,
            updateProfile,
            GoogleAuthProvider,
            signInWithPopup
        } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js");
        const { 
            getFirestore, 
            doc, 
            setDoc, 
            getDoc, 
            collection, 
            addDoc, 
            getDocs, 
            query, 
            where, 
            updateDoc 
        } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
        const { 
            getStorage, 
            ref, 
            uploadBytesResumable, 
            getDownloadURL
        } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js");

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);

        // Google Auth Provider
        const googleProvider = new GoogleAuthProvider();

        // Bind standard Firebase SDK functions to expose them with seamless local fallback
        firebaseLib = {
            isMock: false,
            auth,
            db,
            storage,
            signInWithEmailAndPassword: (email, password) => signInWithEmailAndPassword(auth, email, password),
            createUserWithEmailAndPassword: (email, password) => createUserWithEmailAndPassword(auth, email, password),
            signOut: () => signOut(auth),
            onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
            updateUserProfile: (user, data) => updateProfile(user, data),
            
            // Google Sign-In
            signInWithGoogle: async () => {
                const result = await signInWithPopup(auth, googleProvider);
                return result;
            },
            
            // Firestore Operations with fallback
            getUserProfile: async (uid) => {
                try {
                    const docRef = doc(db, "users", uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        await mockOps.saveUserProfile(uid, data);
                        return data;
                    }
                    return await mockOps.getUserProfile(uid);
                } catch (err) {
                    console.warn("Firestore getUserProfile permission/network error, using local fallback:", err.message);
                    return await mockOps.getUserProfile(uid);
                }
            },
            
            saveUserProfile: async (uid, profileData) => {
                await mockOps.saveUserProfile(uid, profileData);
                try {
                    const docRef = doc(db, "users", uid);
                    return await setDoc(docRef, profileData, { merge: true });
                } catch (err) {
                    console.warn("Firestore saveUserProfile permission/network error, saved locally:", err.message);
                    return profileData;
                }
            },
            
            saveApplication: async (appData) => {
                const localRes = await mockOps.saveApplication(appData);
                try {
                    const colRef = collection(db, "applications");
                    const firestoreRes = await addDoc(colRef, appData);
                    return firestoreRes;
                } catch (err) {
                    console.warn("Firestore saveApplication permission/network error, saved locally:", err.message);
                    return localRes;
                }
            },
            
            getUserApplications: async (uid) => {
                try {
                    const colRef = collection(db, "applications");
                    const q = query(colRef, where("userId", "==", uid));
                    const querySnapshot = await getDocs(q);
                    let apps = [];
                    querySnapshot.forEach((doc) => {
                        apps.push({ id: doc.id, ...doc.data() });
                    });
                    if (apps.length > 0) return apps;
                    return await mockOps.getUserApplications(uid);
                } catch (err) {
                    console.warn("Firestore getUserApplications permission/network error, using local fallback:", err.message);
                    return await mockOps.getUserApplications(uid);
                }
            },
            
            saveSavedInternship: async (saveData) => {
                const localRes = await mockOps.saveSavedInternship(saveData);
                try {
                    const colRef = collection(db, "savedInternships");
                    const firestoreRes = await addDoc(colRef, saveData);
                    return firestoreRes;
                } catch (err) {
                    console.warn("Firestore saveSavedInternship permission/network error, saved locally:", err.message);
                    return localRes;
                }
            },
            
            getUserSavedInternships: async (uid) => {
                try {
                    const colRef = collection(db, "savedInternships");
                    const q = query(colRef, where("userId", "==", uid));
                    const querySnapshot = await getDocs(q);
                    let saved = [];
                    querySnapshot.forEach((doc) => {
                        saved.push({ id: doc.id, ...doc.data() });
                    });
                    if (saved.length > 0) return saved;
                    return await mockOps.getUserSavedInternships(uid);
                } catch (err) {
                    console.warn("Firestore getUserSavedInternships permission/network error, using local fallback:", err.message);
                    return await mockOps.getUserSavedInternships(uid);
                }
            },
            
            // Resume Analysis Operations with fallback
            getResumeAnalysis: async (uid) => {
                try {
                    const docRef = doc(db, "resumeAnalysis", uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        await mockOps.saveResumeAnalysis(uid, data);
                        return data;
                    }
                    return await mockOps.getResumeAnalysis(uid);
                } catch (err) {
                    console.warn("Firestore getResumeAnalysis permission/network error, using local fallback:", err.message);
                    return await mockOps.getResumeAnalysis(uid);
                }
            },
            
            saveResumeAnalysis: async (uid, analysisData) => {
                await mockOps.saveResumeAnalysis(uid, analysisData);
                try {
                    const docRef = doc(db, "resumeAnalysis", uid);
                    return await setDoc(docRef, analysisData, { merge: true });
                } catch (err) {
                    console.warn("Firestore saveResumeAnalysis permission/network error, saved locally:", err.message);
                    return analysisData;
                }
            },

            // File Upload Operations with fallback
            uploadResume: (uid, file, progressCallback) => {
                return new Promise(async (resolve, reject) => {
                    try {
                        const storageRef = ref(storage, `resumes/${uid}_${file.name}`);
                        const metadata = { contentType: file.type || 'application/pdf' };
                        const uploadTask = uploadBytesResumable(storageRef, file, metadata);
                        
                        uploadTask.on('state_changed', 
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                if (progressCallback) progressCallback(progress);
                            }, 
                            async (error) => {
                                console.warn("Firebase Storage upload permission/network error, using local Base64 storage:", error.message);
                                const fallbackUrl = await mockOps.uploadResume(uid, file, progressCallback);
                                resolve(fallbackUrl);
                            }, 
                            () => {
                                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                                    resolve(downloadURL);
                                }).catch(async (err) => {
                                    console.warn("GetDownloadURL failed, using local Base64 fallback:", err.message);
                                    const fallbackUrl = await mockOps.uploadResume(uid, file, progressCallback);
                                    resolve(fallbackUrl);
                                });
                            }
                        );
                    } catch (err) {
                        console.warn("Upload resume exception, using local Base64 fallback:", err.message);
                        const fallbackUrl = await mockOps.uploadResume(uid, file, progressCallback);
                        resolve(fallbackUrl);
                    }
                });
            }
        };
        console.log("✅ Firebase initialized successfully in PRODUCTION mode (with resilient local fallbacks).");
    } catch (e) {
        console.error("Firebase production init failed, falling back to mock mode:", e);
        setupMockMode();
    }
} else {
    setupMockMode();
}

function setupMockMode() {
    console.warn("⚠️ Running AI Internship Recommendation Portal in MOCK STORAGE MODE.");
    
    let currentUser = JSON.parse(localStorage.getItem("mock_current_user") || "null");
    
    if (!currentUser) {
        const defaultUid = "mock_tester_123";
        currentUser = { uid: defaultUid, email: "tester@example.com", displayName: "Guest Tester" };
        localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
        
        const users = JSON.parse(localStorage.getItem("mock_users"));
        if (!users[defaultUid]) {
            users[defaultUid] = { ...currentUser, password: "password", createdAt: new Date().toISOString() };
            localStorage.setItem("mock_users", JSON.stringify(users));
        }
    }
    const authCallbacks = [];

    const triggerAuthChange = (user) => {
        authCallbacks.forEach(cb => cb(user));
    };

    firebaseLib = {
        isMock: true,
        auth: { currentUser },
        db: {},
        storage: {},
        
        signInWithEmailAndPassword: async (email, password) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem("mock_users"));
                    const matchedUid = Object.keys(users).find(uid => users[uid].email === email);
                    
                    if (!matchedUid) {
                        reject(new Error("Firebase: Error (auth/user-not-found)."));
                        return;
                    }
                    if (users[matchedUid].password !== password) {
                        reject(new Error("Firebase: Error (auth/wrong-password)."));
                        return;
                    }
                    
                    currentUser = { uid: matchedUid, email, displayName: users[matchedUid].name };
                    localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
                    firebaseLib.auth.currentUser = currentUser;
                    triggerAuthChange(currentUser);
                    resolve({ user: currentUser });
                }, 800);
            });
        },
        
        createUserWithEmailAndPassword: async (email, password) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const users = JSON.parse(localStorage.getItem("mock_users"));
                    const emailExists = Object.values(users).some(u => u.email === email);
                    
                    if (emailExists) {
                        reject(new Error("Firebase: Error (auth/email-already-in-use)."));
                        return;
                    }
                    
                    const uid = "mock_" + Math.random().toString(36).substring(2, 11);
                    users[uid] = { 
                        uid, 
                        email, 
                        password, 
                        name: email.split('@')[0], 
                        createdAt: new Date().toISOString() 
                    };
                    localStorage.setItem("mock_users", JSON.stringify(users));
                    
                    currentUser = { uid, email, displayName: users[uid].name };
                    localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
                    firebaseLib.auth.currentUser = currentUser;
                    triggerAuthChange(currentUser);
                    resolve({ user: currentUser });
                }, 800);
            });
        },
        
        signInWithGoogle: async () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    const uid = "mock_google_" + Math.random().toString(36).substring(2, 11);
                    const mockEmail = "googleuser_" + Date.now() + "@gmail.com";
                    const mockName = "Google User";
                    
                    const users = JSON.parse(localStorage.getItem("mock_users"));
                    users[uid] = {
                        uid,
                        email: mockEmail,
                        name: mockName,
                        createdAt: new Date().toISOString()
                    };
                    localStorage.setItem("mock_users", JSON.stringify(users));
                    
                    currentUser = { uid, email: mockEmail, displayName: mockName };
                    localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
                    firebaseLib.auth.currentUser = currentUser;
                    triggerAuthChange(currentUser);
                    resolve({ user: currentUser });
                }, 800);
            });
        },
        
        signOut: async () => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    currentUser = null;
                    localStorage.removeItem("mock_current_user");
                    firebaseLib.auth.currentUser = null;
                    triggerAuthChange(null);
                    resolve();
                }, 400);
            });
        },
        
        onAuthStateChanged: (callback) => {
            authCallbacks.push(callback);
            callback(currentUser);
            return () => {
                const index = authCallbacks.indexOf(callback);
                if (index > -1) authCallbacks.splice(index, 1);
            };
        },
        
        updateUserProfile: async (user, data) => {
            const users = JSON.parse(localStorage.getItem("mock_users"));
            if (users[user.uid]) {
                users[user.uid].name = data.displayName || users[user.uid].name;
                localStorage.setItem("mock_users", JSON.stringify(users));
            }
            if (currentUser && currentUser.uid === user.uid) {
                currentUser.displayName = data.displayName || currentUser.displayName;
                localStorage.setItem("mock_current_user", JSON.stringify(currentUser));
            }
        },

        getUserProfile: mockOps.getUserProfile,
        saveUserProfile: mockOps.saveUserProfile,
        saveApplication: mockOps.saveApplication,
        getUserApplications: mockOps.getUserApplications,
        saveSavedInternship: mockOps.saveSavedInternship,
        getUserSavedInternships: mockOps.getUserSavedInternships,
        uploadResume: mockOps.uploadResume,
        getResumeAnalysis: mockOps.getResumeAnalysis,
        saveResumeAnalysis: mockOps.saveResumeAnalysis
    };
}

export const {
    isMock,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateUserProfile,
    signInWithGoogle,
    getUserProfile,
    saveUserProfile,
    saveApplication,
    getUserApplications,
    saveSavedInternship,
    getUserSavedInternships,
    uploadResume,
    saveResumeAnalysis,
    getResumeAnalysis
} = firebaseLib;
