// js/dashboard.js
// Handles student metrics collection, profile calculations, and recent applications fetching.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    getUserApplications,
    getResumeAnalysis,
    isMock
} from './firebase.js';

// DOM Elements
const studentNameEl = document.getElementById('student-name');
const headerDateEl = document.getElementById('header-date');
const profilePercentEl = document.getElementById('profile-percent');
const profileProgressFillEl = document.getElementById('profile-progress-fill');
const profileStatusDescEl = document.getElementById('profile-status-desc');
const resumeStatusBadgeEl = document.getElementById('resume-status-badge');
const resumeFilenameDescEl = document.getElementById('resume-filename-desc');
const extractedSkillsCountEl = document.getElementById('extracted-skills-count');
const averageMatchScoreEl = document.getElementById('average-match-score');
const matchScoreBadgeEl = document.getElementById('match-score-badge');
const applicationsListBodyEl = document.getElementById('applications-list-body');
const sandboxWarningEl = document.getElementById('sandbox-warning');

// Initialize Date Header
function initDateHeader() {
    if (!headerDateEl) return;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    headerDateEl.textContent = today.toLocaleDateString('en-US', options);
}

// Calculate Profile Completeness
function calculateProfileCompleteness(profile) {
    if (!profile) return 0;
    
    // 11 Core fields to evaluate completeness
    const fields = [
        'name',
        'email',
        'phone',
        'branch',
        'cgpa',
        'interests',
        'certifications',
        'resumeUrl',
        'githubUrl',
        'linkedinUrl'
    ];
    
    let completedCount = 0;
    
    // Check text fields
    fields.forEach(field => {
        if (profile[field] && String(profile[field]).trim() !== "") {
            completedCount++;
        }
    });
    
    // Check skills array
    const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
    if (hasSkills) {
        completedCount++;
    }
    
    const totalFields = fields.length + 1; // 10 text fields + 1 skills array = 11 total
    return Math.round((completedCount / totalFields) * 100);
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

// Load Student Dashboard data
async function loadDashboardData(user) {
    try {
        // 1. Fetch user profile from DB
        const profile = await getUserProfile(user.uid);
        
        // Update Student name
        const displayName = getCleanDisplayName(user, profile);
        if (studentNameEl) studentNameEl.textContent = displayName;

        if (profile) {
            
            // Calculate and display completeness
            const percent = calculateProfileCompleteness(profile);
            profilePercentEl.textContent = `${percent}%`;
            profileProgressFillEl.style.width = `${percent}%`;
            
            if (percent === 100) {
                profileStatusDescEl.textContent = "Profile is fully complete!";
            } else if (percent >= 60) {
                profileStatusDescEl.textContent = "Profile looks good! Complete the rest.";
            } else {
                profileStatusDescEl.textContent = "Click to add remaining details.";
            }
            
            // Update Resume status
            if (profile.resumeUrl && profile.resumeUrl.trim() !== "") {
                resumeStatusBadgeEl.textContent = "Uploaded";
                resumeStatusBadgeEl.className = "status-badge green";
                
                // Use stored filename from PDF schema, fall back to URL parsing
                let filename = profile.resumeFileName || "Uploaded_Resume.pdf";
                if (filename === "Uploaded_Resume.pdf" && !profile.resumeFileName) {
                    try {
                        const decodedUrl = decodeURIComponent(profile.resumeUrl);
                        if (!decodedUrl.startsWith('data:')) {
                            const parts = decodedUrl.split('/');
                            const namePart = parts[parts.length - 1].split('?')[0];
                            if (namePart.includes('_')) {
                                filename = namePart.split('_').slice(1).join('_');
                            } else if (namePart) {
                                filename = namePart;
                            }
                        }
                    } catch (e) {
                        console.log("Error decoding filename, using placeholder.");
                    }
                }
                resumeFilenameDescEl.textContent = filename.length > 28 ? filename.substring(0, 25) + '...' : filename;
                // Make it a clickable link to view the PDF if element supports it
                if (resumeFilenameDescEl.tagName === 'A') {
                    resumeFilenameDescEl.href = profile.resumeUrl;
                    resumeFilenameDescEl.target = '_blank';
                }
            } else {
                resumeStatusBadgeEl.textContent = "Missing";
                resumeStatusBadgeEl.className = "status-badge red";
                resumeFilenameDescEl.textContent = "No PDF resume uploaded yet";
            }
            
            // Update Skills Extracted Count
            const hasResume = profile.resumeUrl && profile.resumeUrl.trim() !== "";
            const analysis = hasResume ? await getResumeAnalysis(user.uid) : null;
            const skillsCount = (hasResume && analysis?.technicalSkills?.length) || (Array.isArray(profile.skills) ? profile.skills.length : 0);
            extractedSkillsCountEl.textContent = skillsCount;
            
            // Update average matching score dynamically if skills exist and user has resume
            if (hasResume && analysis?.profileScore) {
                const profileScore = analysis.profileScore;
                averageMatchScoreEl.textContent = `${profileScore}%`;
                matchScoreBadgeEl.textContent = "AI Resume Score";
                matchScoreBadgeEl.className = "metric-note status-badge green";
            } else {
                averageMatchScoreEl.textContent = "--";
                matchScoreBadgeEl.textContent = "Upload resume to match";
                matchScoreBadgeEl.className = "metric-note";
            }
        } else {
            // First login fallback
            studentNameEl.textContent = user.displayName || user.email.split('@')[0];
            profilePercentEl.textContent = "0%";
            profileProgressFillEl.style.width = "0%";
            profileStatusDescEl.textContent = "Click to set up your profile.";
            resumeStatusBadgeEl.textContent = "Missing";
            resumeStatusBadgeEl.className = "status-badge red";
            resumeFilenameDescEl.textContent = "No resume file uploaded yet";
            extractedSkillsCountEl.textContent = "0";
            averageMatchScoreEl.textContent = "--";
            matchScoreBadgeEl.textContent = "Add skills to match";
        }
        
        // 2. Fetch and render Applications
        const applications = await getUserApplications(user.uid);
        renderApplications(applications);
        
    } catch (error) {
        console.error("Error loading dashboard content:", error);
    }
}

// Render applications table
function renderApplications(applications) {
    if (!applicationsListBodyEl) return;
    
    if (!applications || applications.length === 0) {
        applicationsListBodyEl.innerHTML = `
            <tr>
                <td colspan="4" class="table-empty">
                    <i class="fa-regular fa-folder-open empty-icon"></i>
                    <p>You haven't applied to any internships yet.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort applications by applied date descending
    const sortedApps = [...applications].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    
    applicationsListBodyEl.innerHTML = sortedApps.map(app => {
        const date = new Date(app.appliedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let badgeClass = "status-badge";
        const status = app.status || "Applied";
        
        if (status === "Applied" || status === "Submitted") {
            badgeClass += " blue";
        } else if (status === "Under Review") {
            badgeClass += " amber";
        } else if (status === "Shortlisted" || status === "Approved") {
            badgeClass += " green";
        } else {
            badgeClass += " red";
        }
        
        return `
            <tr>
                <td style="font-weight: 600;">${app.companyName}</td>
                <td>${app.title}</td>
                <td>${date}</td>
                <td>
                    <span class="${badgeClass}">${status}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Check Sandbox warning box
function initSandboxCheck() {
    if (!sandboxWarningEl) return;
    if (isMock) {
        sandboxWarningEl.classList.remove('hidden');
    } else {
        sandboxWarningEl.style.display = 'none';
    }
}

// Initialize on load
function initDashboardPage() {
    initDateHeader();
    initSandboxCheck();
    
    onAuthStateChanged((user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            loadDashboardData(currentUser);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardPage);
} else {
    initDashboardPage();
}
