// js/internship-details.js
// Handles reading URL params, fetching specific job details from cache, intersecting skills, and toggle bookmarks.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    saveSavedInternship, 
    getUserSavedInternships,
    isMock
} from './firebase.js';

// DOM elements
const detailsGridWrapper = document.getElementById('details-grid-wrapper');
const alertBox = document.getElementById('alert-box');

// States
let userId = null;
let currentProfile = null;
let currentJob = null;
let savedInternshipsList = [];

// Alert helper
function showAlert(message, type = 'error') {
    if (!alertBox) return;
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = alertBox.querySelector('.alert-icon');
    
    if (alertMsg) alertMsg.textContent = message;
    alertBox.className = `alert-box ${type}`;
    
    if (alertIcon) {
        alertIcon.className = 'alert-icon fa-solid';
        if (type === 'success') {
            alertIcon.classList.add('fa-circle-check');
        } else {
            alertIcon.classList.add('fa-circle-exclamation');
        }
    }
    alertBox.classList.remove('hidden');
}

function hideAlert() {
    if (alertBox) alertBox.classList.add('hidden');
}

// Fetch job from cache by ID
function findJobById(jobId) {
    const jobs = JSON.parse(localStorage.getItem('cached_jobs') || "[]");
    return jobs.find(j => j.id === jobId) || null;
}

// Check and verify bookmark existence
function checkIsBookmarked(jobId) {
    return savedInternshipsList.some(item => item.internshipId === jobId);
}

// Calculate recommendation score
function calculateMatchScore(requiredSkills) {
    if (!currentProfile || !Array.isArray(currentProfile.skills) || currentProfile.skills.length === 0) return 0;
    
    const userSkills = currentProfile.skills.map(s => s.toLowerCase().trim());
    const matched = requiredSkills.filter(skill => userSkills.includes(skill.toLowerCase().trim()));
    
    return requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 0;
}

// Dynamic rendering of details cards
async function renderJobDetails() {
    if (!detailsGridWrapper) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    
    if (!jobId) {
        detailsGridWrapper.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--error-color);"></i>
                <span>No internship ID specified. Please return to Finder.</span>
            </div>
        `;
        return;
    }
    
    currentJob = findJobById(jobId);
    
    if (!currentJob) {
        detailsGridWrapper.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--error-color);"></i>
                <span>Internship not found in the current cache.</span>
            </div>
        `;
        return;
    }
    
    try {
        // Fetch saved bookmarks
        if (userId) {
            savedInternshipsList = await getUserSavedInternships(userId);
        }
        
        const isSaved = checkIsBookmarked(jobId);
        const score = calculateMatchScore(currentJob.skillsRequired);
        
        // Split matched vs missing skills
        const reqSkills = currentJob.skillsRequired || [];
        const userSkills = (currentProfile?.skills || []).map(s => s.toLowerCase().trim());
        
        const matchedSkills = [];
        const missingSkills = [];
        
        reqSkills.forEach(s => {
            if (userSkills.includes(s.toLowerCase().trim())) {
                matchedSkills.push(s);
            } else {
                missingSkills.push(s);
            }
        });
        
        const matchedStr = matchedSkills.length > 0 ? matchedSkills.join(', ') : 'None';
        const missingStr = missingSkills.length > 0 ? missingSkills.join(', ') : 'None';
        
        // Define rating score badge
        let badgeClass = "low";
        let labelText = "Low Match";
        if (score >= 75) {
            badgeClass = "high";
            labelText = "Highly Recommended";
        } else if (score >= 50) {
            badgeClass = "medium";
            labelText = "Recommended";
        }
        
        let matchScoreCardHtml = '';
        if (currentProfile && Array.isArray(currentProfile.skills) && currentProfile.skills.length > 0) {
            matchScoreCardHtml = `
                <div class="match-score-card">
                    <h3>AI Matching Evaluation</h3>
                    <div class="match-percentage-badge">
                        <div class="score ${badgeClass}">${score}%</div>
                        <span class="label ${badgeClass}">${labelText}</span>
                    </div>
                    
                    <div class="skills-list-block">
                        <div class="skill-list-row">
                            <strong>Matched Skills:</strong>
                            <span class="matched">${matchedStr}</span>
                        </div>
                        <div class="skill-list-row">
                            <strong>Missing Skills:</strong>
                            <span class="missing">${missingStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        detailsGridWrapper.innerHTML = `
            <!-- Left: Main Detail Information -->
            <article class="job-detail-main-card">
                <div class="job-detail-header">
                    <h2>${currentJob.title}</h2>
                    <div class="company-row">${currentJob.company}</div>
                    
                    <div class="meta-badges-row">
                        <div class="meta-badge-item">
                            <i class="fa-solid fa-location-dot"></i>
                            <span>${currentJob.location}</span>
                        </div>
                        <div class="meta-badge-item">
                            <i class="fa-solid fa-wallet"></i>
                            <span>${currentJob.salary}</span>
                        </div>
                        <div class="meta-badge-item">
                            <i class="fa-solid fa-clock"></i>
                            <span>${currentJob.duration || '12 Weeks'}</span>
                        </div>
                    </div>
                </div>
                
                <section class="detail-text-section">
                    <h3><i class="fa-solid fa-align-left"></i> Job Description</h3>
                    <p>${currentJob.description}</p>
                </section>
                
                <section class="detail-text-section">
                    <h3><i class="fa-solid fa-clipboard-check"></i> Eligibility Criteria</h3>
                    <p>${currentJob.eligibility || 'Pursuing a Bachelor\'s degree in Engineering, Computer Science, or similar. Programming competency required.'}</p>
                </section>
            </article>
            
            <!-- Right: Match Evaluation & Action Buttons -->
            <aside class="details-sidebar-panel">
                <!-- AI matching -->
                ${matchScoreCardHtml}
                
                <!-- Action triggers -->
                <div class="action-card">
                    <div class="sidebar-actions-wrapper">
                        <a href="apply.html?id=${currentJob.id}" class="btn-sidebar-trigger apply">
                            <i class="fa-solid fa-paper-plane"></i>
                            <span>Apply for Internship</span>
                        </a>
                        <button class="btn-sidebar-trigger bookmark ${isSaved ? 'active' : ''}" id="btn-details-bookmark">
                            <i class="fa-${isSaved ? 'solid' : 'regular'} fa-bookmark"></i>
                            <span id="bookmark-btn-text">${isSaved ? 'Bookmarked' : 'Save for Later'}</span>
                        </button>
                    </div>
                </div>
            </aside>
        `;
        
        // Bind bookmark click handler
        const bookmarkBtn = document.getElementById('btn-details-bookmark');
        if (bookmarkBtn) {
            bookmarkBtn.addEventListener('click', toggleDetailsBookmark);
        }
        
    } catch (e) {
        console.error("Rendering details error:", e);
        detailsGridWrapper.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-circle-exclamation" style="color: var(--error-color);"></i>
                <span>Failed to compile internship details.</span>
            </div>
        `;
    }
}

// Toggle bookmark state from details page
async function toggleDetailsBookmark() {
    const bookmarkBtn = document.getElementById('btn-details-bookmark');
    const bookmarkText = document.getElementById('bookmark-btn-text');
    if (!bookmarkBtn) return;
    
    bookmarkBtn.disabled = true;
    hideAlert();
    
    try {
        const isSaved = bookmarkBtn.classList.contains('active');
        
        if (isSaved) {
            // Remove bookmark
            await removeSavedInternshipRef(currentJob.id);
            bookmarkBtn.classList.remove('active');
            bookmarkBtn.querySelector('i').className = 'fa-regular fa-bookmark';
            if (bookmarkText) bookmarkText.textContent = "Save for Later";
            showAlert("Removed from Saved Internships.", "success");
        } else {
            // Add bookmark
            const saveData = {
                userId,
                internshipId: currentJob.id,
                title: currentJob.title,
                companyName: currentJob.company
            };
            await saveSavedInternship(saveData);
            bookmarkBtn.classList.add('active');
            bookmarkBtn.querySelector('i').className = 'fa-solid fa-bookmark';
            if (bookmarkText) bookmarkText.textContent = "Bookmarked";
            showAlert("Saved to Bookmarks!", "success");
        }
        
        // Refresh local cache list
        savedInternshipsList = await getUserSavedInternships(userId);
    } catch (err) {
        console.error("Failed to toggle details bookmark:", err);
        showAlert("Failed to toggle bookmark: " + err.message);
    } finally {
        bookmarkBtn.disabled = false;
    }
}

// Sub-helper to delete bookmarks inside simulated DB tables or localStorage
async function removeSavedInternshipRef(jobId) {
    if (isMock) {
        let saved = JSON.parse(localStorage.getItem('mock_saved') || "[]");
        saved = saved.filter(item => !(item.userId === userId && item.internshipId === jobId));
        localStorage.setItem('mock_saved', JSON.stringify(saved));
        return Promise.resolve();
    } else {
        try {
            const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
            const db = getFirestore();
            const q = query(collection(db, "savedInternships"), where("userId", "==", userId), where("internshipId", "==", jobId));
            const querySnapshot = await getDocs(q);
            const promises = [];
            querySnapshot.forEach((document) => {
                promises.push(deleteDoc(doc(db, "savedInternships", document.id)));
            });
            await Promise.all(promises);
        } catch (e) {
            console.error("Firestore unbookmark failed:", e);
        }
    }
}

// Initializer function
function initInternshipDetailsPage() {
    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            
            // Get profile details
            currentProfile = await getUserProfile(userId);
            
            // Render details
            renderJobDetails();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInternshipDetailsPage);
} else {
    initInternshipDetailsPage();
}
