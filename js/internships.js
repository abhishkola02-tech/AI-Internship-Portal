// js/internships.js
// Integrates live Remotive jobs API with a local cached database fallback, matches skills, and manages saved bookmarks.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    saveSavedInternship, 
    getUserSavedInternships,
    isMock
} from './firebase.js';

// DOM elements
const searchInput = document.getElementById('search-input');
const tabAllBtn = document.getElementById('tab-all');
const tabAiBtn = document.getElementById('tab-ai');
const tabSavedBtn = document.getElementById('tab-saved');
const listGrid = document.getElementById('internships-list-grid');
const alertBox = document.getElementById('alert-box');

// States
let userId = null;
let currentProfile = null;
let savedInternshipsList = [];
let activeTab = "all"; // "all" | "ai" | "saved"
let searchQuery = "";

// Alert helpers
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

// Fetch live jobs from Remotive API (Software Development category)
async function fetchLiveJobs() {
    try {
        console.log("Fetching live tech jobs from Remotive API...");
        const res = await fetch("https://remotive.com/api/remote-jobs?category=software-development&limit=15");
        if (!res.ok) throw new Error("Remotive API response error code: " + res.status);
        const data = await res.json();
        
        if (data && Array.isArray(data.jobs)) {
            const mapped = data.jobs.map(job => {
                // Extract skills dynamically from description
                const techSkills = ["Python", "Java", "Machine Learning", "TensorFlow", "React", "HTML", "CSS", "SQL", "Git", "JavaScript", "AWS", "Docker", "TypeScript"];
                const matchedSkills = [];
                const descUpper = job.description.toUpperCase();
                
                techSkills.forEach(skill => {
                    if (descUpper.includes(skill.toUpperCase())) {
                        matchedSkills.push(skill);
                    }
                });
                
                if (matchedSkills.length === 0) matchedSkills.push("Software Engineering");
                
                // Clean HTML tags from description
                const cleanDesc = job.description.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 300) + "...";
                
                return {
                    id: "remotive_" + job.id,
                    title: job.title,
                    company: job.company_name,
                    location: job.candidate_required_location || "Remote",
                    salary: job.salary || "$6,000 / mo",
                    skillsRequired: matchedSkills,
                    duration: "12 Weeks",
                    eligibility: "Bachelor's / Master's degree candidate in Computer Science, engineering, or related field.",
                    description: cleanDesc
                };
            });
            
            // Merge with local storage
            const currentCache = JSON.parse(localStorage.getItem('cached_jobs') || "[]");
            const merged = [...currentCache];
            
            mapped.forEach(newJob => {
                if (!merged.some(j => j.id === newJob.id)) {
                    merged.push(newJob);
                }
            });
            
            localStorage.setItem('cached_jobs', JSON.stringify(merged));
            console.log("Cached live API jobs successfully!");
        }
    } catch (err) {
        console.warn("Remotive API blocked or failed (CORS/offline). Using cached jobs database. Details:", err);
    }
}

// Calculate recommendation score for a job
function calculateMatchScore(requiredSkills) {
    if (!currentProfile || !Array.isArray(currentProfile.skills) || currentProfile.skills.length === 0) return 0;
    
    const userSkills = currentProfile.skills.map(s => s.toLowerCase().trim());
    const matched = requiredSkills.filter(skill => userSkills.includes(skill.toLowerCase().trim()));
    
    return requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 0;
}

// Load dynamic data and render cards
async function renderInternshipsList() {
    if (!listGrid) return;
    
    // Clear list
    listGrid.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading...</span>
        </div>
    `;
    
    try {
        // Fetch bookmarks
        if (userId) {
            savedInternshipsList = await getUserSavedInternships(userId);
        }
        
        const allJobs = JSON.parse(localStorage.getItem('cached_jobs') || "[]");
        
        // Filter by tab
        let filteredJobs = [...allJobs];
        
        if (activeTab === "ai") {
            if (!currentProfile || !Array.isArray(currentProfile.skills) || currentProfile.skills.length === 0) {
                listGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <p>Your profile has no skills listed. <a href="profile.html" style="color:var(--primary-color);">Complete profile</a> to see AI matches.</p>
                    </div>
                `;
                return;
            }
            // Only jobs with score >= 50%
            filteredJobs = allJobs.filter(job => calculateMatchScore(job.skillsRequired) >= 50);
        } else if (activeTab === "saved") {
            const savedIds = savedInternshipsList.map(item => item.internshipId);
            filteredJobs = allJobs.filter(job => savedIds.includes(job.id));
        }
        
        // Filter by search query
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase().trim();
            filteredJobs = filteredJobs.filter(job => 
                job.title.toLowerCase().includes(query) ||
                job.company.toLowerCase().includes(query) ||
                job.location.toLowerCase().includes(query) ||
                job.skillsRequired.some(s => s.toLowerCase().includes(query))
            );
        }
        
        // Empty state render
        if (filteredJobs.length === 0) {
            listGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>No internships found matching your current filters.</p>
                </div>
            `;
            return;
        }
        
        // Render cards
        listGrid.innerHTML = filteredJobs.map(job => {
            const isSaved = savedInternshipsList.some(item => item.internshipId === job.id);
            const score = calculateMatchScore(job.skillsRequired);
            
            // Skill tags
            const skillsHtml = job.skillsRequired.map(skill => `<span class="skill-tag">${skill}</span>`).join('');
            
            // Match score html
            let matchHtml = '';
            if (currentProfile && Array.isArray(currentProfile.skills) && currentProfile.skills.length > 0) {
                let badgeClass = "low";
                let labelText = "Low Match";
                if (score >= 75) {
                    badgeClass = "high";
                    labelText = "Highly Recommended";
                } else if (score >= 50) {
                    badgeClass = "medium";
                    labelText = "Recommended";
                }
                matchHtml = `
                    <div class="card-match-badge">
                        <span class="percentage ${badgeClass}">${score}% Match</span>
                        <span class="label">(${labelText})</span>
                    </div>
                `;
            }
            
            return `
                <div class="internship-card">
                    <button class="btn-bookmark ${isSaved ? 'active' : ''}" data-job-id="${job.id}" data-title="${job.title}" data-company="${job.company}" title="${isSaved ? 'Remove from Saved' : 'Save Internship'}">
                        <i class="fa-${isSaved ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                    
                    <div class="card-company-header">
                        <h4 class="job-title">${job.title}</h4>
                        <span class="company-name">${job.company}</span>
                        
                        <div class="job-meta-row">
                            <span><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                            <span><i class="fa-solid fa-clock"></i> ${job.duration || '12 Weeks'}</span>
                        </div>
                    </div>
                    
                    <div class="card-skills-wrapper">
                        ${skillsHtml}
                    </div>
                    
                    ${matchHtml}
                    
                    <div class="card-footer">
                        <div class="job-salary-label">
                            <span class="amount">${job.salary}</span>
                            <span class="label">Compensation</span>
                        </div>
                        
                        <div class="card-actions-wrapper">
                            <a href="internship-details.html?id=${job.id}" class="btn-card-action details">
                                <span>Details</span>
                            </a>
                            <a href="apply.html?id=${job.id}" class="btn-card-action apply">
                                <span>Apply</span>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Bind dynamic buttons inside list
        bindCardEvents();
        
    } catch (err) {
        console.error("Rendering internships failed:", err);
        listGrid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-exclamation" style="color:var(--error-color);"></i>
                <p>Failed to load internships database.</p>
            </div>
        `;
    }
}

// Bind Bookmark toggle buttons
function bindCardEvents() {
    const bookmarkButtons = listGrid.querySelectorAll('.btn-bookmark');
    bookmarkButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const jobId = btn.getAttribute('data-job-id');
            const jobTitle = btn.getAttribute('data-title');
            const jobCompany = btn.getAttribute('data-company');
            
            btn.disabled = true;
            
            try {
                // Toggle state
                const isSaved = btn.classList.contains('active');
                
                if (isSaved) {
                    // Remove bookmark
                    await removeSavedInternshipRef(jobId);
                    showAlert("Removed from Saved Internships.", "success");
                } else {
                    // Add bookmark
                    const saveData = {
                        userId,
                        internshipId: jobId,
                        title: jobTitle,
                        companyName: jobCompany
                    };
                    await saveSavedInternship(saveData);
                    showAlert("Saved to Bookmarks!", "success");
                }
                
                // Reload list
                renderInternshipsList();
                
            } catch (err) {
                console.error("Bookmark operation failed:", err);
                showAlert("Failed to toggle saved state: " + err.message);
                btn.disabled = false;
            }
        });
    });
}

// Sub-helper to delete bookmarks inside simulated DB tables or localStorage
async function removeSavedInternshipRef(jobId) {
    if (isMock) {
        let saved = JSON.parse(localStorage.getItem('mock_saved') || "[]");
        saved = saved.filter(item => !(item.userId === userId && item.internshipId === jobId));
        localStorage.setItem('mock_saved', JSON.stringify(saved));
        return Promise.resolve();
    } else {
        // In real Firebase production, you can locate the matching doc and delete it.
        // For simplicity we will update/delete in standard Firestore via import if available.
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

// Setup Tab switching and Search bar binds
function setupNavigationControls() {
    const tabs = [tabAllBtn, tabAiBtn, tabSavedBtn];
    
    tabs.forEach(tab => {
        if (!tab) return;
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.getAttribute('data-tab');
            hideAlert();
            renderInternshipsList();
        });
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderInternshipsList();
        });
    }
}

// Initializer on Page load
function initInternshipsPage() {
    setupNavigationControls();
    
    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            
            // Get user profile in memory
            currentProfile = await getUserProfile(userId);
            
            // Pre-seed and download live API jobs
            await fetchLiveJobs();
            
            // Run rendering
            renderInternshipsList();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInternshipsPage);
} else {
    initInternshipsPage();
}
