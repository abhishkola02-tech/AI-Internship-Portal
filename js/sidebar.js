// js/sidebar.js
// Handles common sidebar injection, user authentication state guarding, and responsive sidebar toggles.

import { onAuthStateChanged, signOut, getUserProfile } from './firebase.js';

// Setup common page head elements (like Google Fonts and FontAwesome)
function setupCommonAssets() {
    // Inject FontAwesome for icons if not already present
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fa);
    }
    
    // Inject Google Font (Inter & Outfit) if not already present
    if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const font1 = document.createElement('link');
        font1.rel = 'preconnect';
        font1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(font1);

        const font2 = document.createElement('link');
        font2.rel = 'preconnect';
        font2.href = 'https://fonts.gstatic.com';
        font2.crossOrigin = 'anonymous';
        document.head.appendChild(font2);

        const font3 = document.createElement('link');
        font3.rel = 'stylesheet';
        font3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(font3);
    }

    // Inject sidebar CSS
    if (!document.querySelector('link[href*="sidebar.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'css/sidebar.css';
        document.head.appendChild(cssLink);
    }
}

function getCleanDisplayName(user, userProfile) {
    if (userProfile && userProfile.name && userProfile.name.trim() !== "" && userProfile.name !== "Google User" && userProfile.name !== "Guest Tester") {
        return userProfile.name;
    }
    if (user && user.displayName && user.displayName.trim() !== "" && user.displayName !== "Google User" && user.displayName !== "Guest Tester") {
        return user.displayName;
    }
    if (user && user.email) {
        const emailPrefix = user.email.split('@')[0];
        return emailPrefix.split(/[\._\-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return "Student";
}

// Generate the sidebar structure
function renderSidebar(container, user, userProfile) {
    const currentPath = window.location.pathname;
    const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'dashboard.html';

    const displayName = getCleanDisplayName(user, userProfile);
    const userBranch = userProfile?.branch || "Student";

    container.innerHTML = `
        <!-- Mobile Sidebar Toggle -->
        <button class="mobile-toggle" id="mobile-sidebar-toggle">
            <i class="fa-solid fa-bars"></i>
        </button>

        <aside class="app-sidebar" id="app-sidebar">
            <div class="sidebar-header">
                <div class="brand">
                    <i class="fa-solid fa-graduation-cap brand-icon"></i>
                    <span>PortalAI</span>
                </div>
                <button class="close-sidebar-btn" id="close-sidebar-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <nav class="sidebar-nav">
                <ul>
                    <li>
                        <a href="dashboard.html" class="${pageName === 'dashboard.html' ? 'active' : ''}">
                            <i class="fa-solid fa-chart-simple nav-icon"></i>
                            <span>Dashboard</span>
                        </a>
                    </li>
                    <li>
                        <a href="profile.html" class="${pageName === 'profile.html' ? 'active' : ''}">
                            <i class="fa-solid fa-user-gear nav-icon"></i>
                            <span>Complete Profile</span>
                        </a>
                    </li>
                    <li>
                        <a href="upload-resume.html" class="${pageName === 'upload-resume.html' ? 'active' : ''}">
                            <i class="fa-solid fa-file-arrow-up nav-icon"></i>
                            <span>Upload Resume</span>
                        </a>
                    </li>
                    <li>
                        <a href="recommendation.html" class="${pageName === 'recommendation.html' ? 'active' : ''}">
                            <i class="fa-solid fa-wand-magic-sparkles nav-icon"></i>
                            <span>AI Recommendation System</span>
                        </a>
                    </li>
                    <li>
                        <a href="internships.html" class="${pageName === 'internships.html' || pageName === 'internship-details.html' || pageName === 'apply.html' ? 'active' : ''}">
                            <i class="fa-solid fa-briefcase nav-icon"></i>
                            <span>Internships Finder</span>
                        </a>
                    </li>
                    <li>
                        <a href="chat.html" class="${pageName === 'chat.html' ? 'active' : ''}">
                            <i class="fa-solid fa-message nav-icon"></i>
                            <span>AI Career Chat</span>
                        </a>
                    </li>
                </ul>
            </nav>

            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">
                        ${displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-details">
                        <span class="user-name">${displayName}</span>
                        <span class="user-role">${userBranch}</span>
                    </div>
                </div>
                <button class="logout-btn" id="sidebar-logout-btn" title="Logout">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    <span>Logout</span>
                </button>
            </div>
        </aside>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    // Hook events
    const sidebar = document.getElementById('app-sidebar');
    const toggle = document.getElementById('mobile-sidebar-toggle');
    const closeBtn = document.getElementById('close-sidebar-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const logoutBtn = document.getElementById('sidebar-logout-btn');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('visible');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }

    if (overlay && sidebar) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to log out?")) {
                try {
                    await signOut();
                    window.location.href = "index.html";
                } catch (err) {
                    console.error("Logout failed:", err);
                    alert("Logout failed: " + err.message);
                }
            }
        });
    }
}

// Check Auth & Inject Sidebar
function initSidebar() {
    setupCommonAssets();

    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) {
        return;
    }

    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (!currentUser) {
            console.log("No active user session found, redirecting to index.html");
            window.location.href = "index.html";
        } else {
            try {
                const profile = await getUserProfile(currentUser.uid);
                renderSidebar(sidebarContainer, currentUser, profile);
            } catch (err) {
                console.error("Error loading user profile for sidebar:", err);
                renderSidebar(sidebarContainer, currentUser, null);
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}
