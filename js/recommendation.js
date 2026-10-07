// js/recommendation.js
// Handles calculations of internship match compatibility and dynamic score cards formatting based on real AI extracted skills.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    getResumeAnalysis
} from './firebase.js';

// DOM elements
const profileSkillsList = document.getElementById('profile-skills-list');
const missingSkillsList = document.getElementById('missing-skills-list');
const recommendationsList = document.getElementById('recommendations-list');
const matchedCountBadge = document.getElementById('matched-count-badge');

// Global States
let userId = null;
let currentProfile = null;
let resumeAnalysis = null;

// Default Seeded Jobs List to calculate recommendations against
const defaultJobs = [
    {
        id: "job_ml_google",
        title: "AI & Machine Learning Engineer Intern",
        company: "Google",
        location: "Mountain View, CA (Hybrid)",
        salary: "$8,500 / mo",
        skillsRequired: ["Python", "Machine Learning", "TensorFlow", "Git"],
        duration: "12 Weeks",
        eligibility: "BS/MS/PhD in Computer Science, Data Science, or related technical field with coding experience.",
        description: "Join the Google Core AI team to build, train, and optimize next-generation deep learning models. You will work on real-world datasets, design neural architectures, and collaborate with researchers to deploy models at Google scale."
    },
    {
        id: "job_fullstack_stripe",
        title: "Software Engineering Intern - Full Stack",
        company: "Stripe",
        location: "San Francisco, CA (Remote)",
        salary: "$7,800 / mo",
        skillsRequired: ["HTML", "CSS", "React", "SQL", "Java"],
        duration: "10 Weeks",
        eligibility: "Currently pursuing a Bachelor's in CS or Software Engineering with web application projects.",
        description: "Help build the infrastructure of global internet commerce. In this internship, you'll join our developer dashboard team. You will write robust frontend elements in React, integrate payment gateways, and connect SQL database triggers."
    },
    {
        id: "job_swe_amazon",
        title: "Software Development Engineer Intern (SDE)",
        company: "Amazon",
        location: "Seattle, WA (Office)",
        salary: "$7,500 / mo",
        skillsRequired: ["Java", "SQL", "Git", "Python"],
        duration: "12 Weeks",
        eligibility: "Familiarity with Object-Oriented Design, data structures, and algorithms in Java/C++.",
        description: "Engage in full-lifecycle software development. You will own a standalone service feature, design databases, write backend integrations, and write unit tests to ensure operational excellence on our AWS product catalogs."
    },
    {
        id: "job_frontend_vercel",
        title: "Frontend Engineering Intern",
        company: "Vercel",
        location: "New York, NY (Remote)",
        salary: "$6,800 / mo",
        skillsRequired: ["HTML", "CSS", "React", "JavaScript"],
        duration: "8 Weeks",
        eligibility: "Portfolio demonstrating modern web development, UI responsiveness, and pixel-perfect layouts.",
        description: "Work beside the creators of Next.js to craft stunning developer dashboards. You will implement fluid CSS micro-animations, write reusable React components, and build accessible user experiences."
    },
    {
        id: "job_data_meta",
        title: "Data Scientist / Analyst Intern",
        company: "Meta",
        location: "New York, NY (Office)",
        salary: "$8,000 / mo",
        skillsRequired: ["Python", "SQL", "Machine Learning", "Pandas"],
        duration: "12 Weeks",
        eligibility: "Familiarity with data manipulation (Pandas, Numpy), SQL querying, and fundamental statistics.",
        description: "Empower product teams by extracting user insight. You will build dashboards, write advanced SQL aggregation queries, write regression analytics scripts in Python, and present recommendations to improve advertising systems."
    }
];

// Check and initialize local storage job cache if missing
function initJobsCache() {
    if (!localStorage.getItem('cached_jobs')) {
        localStorage.setItem('cached_jobs', JSON.stringify(defaultJobs));
    }
}

// Render active profile skills list and missing skills from analysis
function renderProfileSkills() {
    if (!profileSkillsList || !missingSkillsList) return;
    
    const skills = resumeAnalysis?.technicalSkills || currentProfile?.skills || [];
    const missing = resumeAnalysis?.missingSkills || [];
    
    if (skills.length === 0) {
        profileSkillsList.innerHTML = `
            <span class="no-skills-msg">No skills found. Upload a resume in the Upload Resume tab to extract skills using AI.</span>
        `;
    } else {
        profileSkillsList.innerHTML = skills.map(skill => {
            return `<span class="tag-chip">${skill}</span>`;
        }).join('');
    }

    if (missing.length === 0) {
        if (skills.length > 0) {
            missingSkillsList.innerHTML = `<span class="no-skills-msg" style="color:var(--success-color);">Great job! No major skill gaps identified for your target roles.</span>`;
        } else {
            missingSkillsList.innerHTML = `<span class="no-skills-msg">Upload a resume to see missing skill recommendations.</span>`;
        }
    } else {
        missingSkillsList.innerHTML = missing.map(skill => {
            return `<span class="tag-chip" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: var(--error-color);">${skill}</span>`;
        }).join('');
    }
}

// Calculate recommendation scores for all jobs against profile skills
function calculateRecommendations() {
    if (!recommendationsList) return;
    
    const userSkills = (resumeAnalysis?.technicalSkills || currentProfile?.skills || []).map(s => s.toLowerCase().trim());
    let jobs = JSON.parse(localStorage.getItem('cached_jobs') || "[]");
    
    // If AI analysis provided recommended internships, inject them into the local cache/list
    if (resumeAnalysis?.recommendedInternships && resumeAnalysis.recommendedInternships.length > 0) {
        resumeAnalysis.recommendedInternships.forEach((aiJob, idx) => {
            const aiJobId = `ai_job_${idx}`;
            if (!jobs.some(j => j.id === aiJobId)) {
                jobs.push({
                    id: aiJobId,
                    title: aiJob.title,
                    company: "AI Recommended Partner",
                    location: "Remote",
                    salary: "Variable",
                    skillsRequired: resumeAnalysis.technicalSkills.slice(0, 3) || [],
                    duration: "TBD",
                    eligibility: "Based on AI profile matching",
                    description: aiJob.reason || "This role was specifically recommended by the AI based on your unique skill profile and strengths."
                });
            }
        });
    }
    
    if (userSkills.length === 0) {
        recommendationsList.innerHTML = `
            <div class="empty-results">
                <i class="fa-solid fa-tags"></i>
                <p>Upload a resume to extract skills and view AI matched internships.</p>
            </div>
        `;
        matchedCountBadge.textContent = "0 Matches";
        return;
    }
    
    // Map internships with matching calculations
    const evaluatedJobs = jobs.map(job => {
        const reqSkills = job.skillsRequired || [];
        const matched = [];
        const missing = [];
        
        reqSkills.forEach(skill => {
            // Simple sub-string/includes match
            const sLower = skill.toLowerCase().trim();
            if (userSkills.some(u => u.includes(sLower) || sLower.includes(u))) {
                matched.push(skill);
            } else {
                missing.push(skill);
            }
        });
        
        const score = reqSkills.length > 0 ? Math.round((matched.length / reqSkills.length) * 100) : 0;
        
        let label = "Low Match";
        let ratingClass = "low";
        if (score >= 75) {
            label = "Highly Recommended";
            ratingClass = "high";
        } else if (score >= 50) {
            label = "Recommended";
            ratingClass = "medium";
        }
        
        return {
            ...job,
            score,
            matched,
            missing,
            label,
            ratingClass
        };
    });
    
    // Sort descending by score
    evaluatedJobs.sort((a, b) => b.score - a.score);
    
    // Render list
    recommendationsList.innerHTML = evaluatedJobs.map(job => {
        const matchedStr = job.matched.length > 0 ? job.matched.join(', ') : 'None';
        const missingStr = job.missing.length > 0 ? job.missing.join(', ') : 'None';
        
        return `
            <div class="recommendation-card">
                <div class="rec-card-header">
                    <div>
                        <h4 class="rec-job-title">${job.title}</h4>
                        <div class="rec-company-row">
                            <span style="font-weight:600;"><i class="fa-solid fa-building"></i> ${job.company}</span>
                            <span><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                            <span><i class="fa-solid fa-wallet"></i> ${job.salary}</span>
                        </div>
                    </div>
                    
                    <div class="match-score-radial">
                        <span class="match-percentage ${job.ratingClass}">${job.score}%</span>
                        <span class="match-label-badge ${job.ratingClass}">${job.label}</span>
                    </div>
                </div>
                
                <div class="skills-comparison-block">
                    <div class="comparison-row">
                        <strong>Matched:</strong>
                        <span class="matched-skills-text">${matchedStr}</span>
                    </div>
                    <div class="comparison-row">
                        <strong>Missing:</strong>
                        <span class="missing-skills-text">${missingStr}</span>
                    </div>
                </div>
                
                <div class="rec-card-actions">
                    <a href="internship-details.html?id=${job.id}" class="btn-card-action details">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>Details</span>
                    </a>
                    <a href="apply.html?id=${job.id}" class="btn-card-action apply">
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>Apply</span>
                    </a>
                </div>
            </div>
        `;
    }).join('');
    
    matchedCountBadge.textContent = `${evaluatedJobs.length} Matches`;
}

// Initializer function
function initRecommendationPage() {
    initJobsCache();
    
    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            
            // Get profile details & AI analysis
            currentProfile = await getUserProfile(userId);
            const hasResume = currentProfile && currentProfile.resumeUrl;
            resumeAnalysis = hasResume ? await getResumeAnalysis(userId) : null;
            
            renderProfileSkills();
            calculateRecommendations();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecommendationPage);
} else {
    initRecommendationPage();
}
