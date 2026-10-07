// js/apply.js
// Handles checking resume existence, mapping form properties, submitting applications to Firestore, and rendering success views.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    saveApplication 
} from './firebase.js';

// DOM elements
const jobSummaryBox = document.getElementById('job-summary-box');
const applicantNameEl = document.getElementById('applicant-name');
const applicantEmailEl = document.getElementById('applicant-email');
const applicantPhoneEl = document.getElementById('applicant-phone');
const resumeVerifyStatus = document.getElementById('resume-verify-status');
const btnSubmitApplication = document.getElementById('btn-submit-application');
const applicationForm = document.getElementById('application-form');
const coverLetterInput = document.getElementById('cover-letter');

const applyCardForm = document.getElementById('apply-card-form');
const successScreenCard = document.getElementById('success-screen-card');
const successJobDetails = document.getElementById('success-job-details');
const backLink = document.getElementById('back-link');
const alertBox = document.getElementById('alert-box');

// States
let userId = null;
let currentProfile = null;
let currentJob = null;

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

// Find job details from localStorage cache
function findJobById(jobId) {
    const jobs = JSON.parse(localStorage.getItem('cached_jobs') || "[]");
    return jobs.find(j => j.id === jobId) || null;
}

// Render dynamic job details header in form
function renderJobHeader(jobId) {
    currentJob = findJobById(jobId);
    
    if (!currentJob) {
        jobSummaryBox.innerHTML = `
            <div class="verify-badge error">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>Internship position not found.</span>
            </div>
        `;
        return;
    }
    
    // Set dynamic back navigation to detail view
    if (backLink) {
        backLink.href = `internship-details.html?id=${jobId}`;
    }
    
    jobSummaryBox.innerHTML = `
        <div>
            <h4 class="job-sum-title">${currentJob.title}</h4>
            <span class="job-sum-meta">${currentJob.company} &bull; ${currentJob.location}</span>
        </div>
        <div class="job-sum-salary">${currentJob.salary}</div>
    `;
}

// Map user profile coordinates
function populateApplicantDetails() {
    if (!currentProfile) return;
    
    applicantNameEl.textContent = currentProfile.name || "--";
    applicantEmailEl.textContent = currentProfile.email || "--";
    applicantPhoneEl.textContent = currentProfile.phone || "--";
    
    // Verify resume attachment
    if (currentProfile.resumeUrl && currentProfile.resumeUrl.trim() !== "") {
        const fileName = currentProfile.resumeFileName || "Uploaded_Resume.pdf";
        resumeVerifyStatus.innerHTML = `
            <div class="verify-badge success" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>PDF Resume verified: <strong>${fileName}</strong></span>
                </div>
                <a href="${currentProfile.resumeUrl}" target="_blank" download="${fileName}" style="color:var(--success-color); text-decoration:underline; font-size:13px;">View PDF</a>
            </div>
        `;
        btnSubmitApplication.disabled = false;
    } else {
        resumeVerifyStatus.innerHTML = `
            <div class="verify-badge error">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>No active PDF resume file found on profile.</span>
                <a href="upload-resume.html" class="btn-upload-redirect">Upload PDF Resume</a>
            </div>
        `;
        btnSubmitApplication.disabled = true;
    }
}

// Submit Application
async function submitApplication() {
    if (!userId || !currentJob) return;
    
    hideAlert();
    
    // Toggle Loading State
    btnSubmitApplication.disabled = true;
    const originalText = btnSubmitApplication.innerHTML;
    btnSubmitApplication.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting Application...`;
    
    try {
        const coverLetter = coverLetterInput.value.trim();
        
        const appPayload = {
            userId,
            internshipId: currentJob.id,
            companyName: currentJob.company,
            title: currentJob.title,
            coverLetter,
            resumeUrl: currentProfile?.resumeUrl || null,
            resumeFileName: currentProfile?.resumeFileName || "Uploaded_Resume.pdf",
            status: "Applied"
        };
        
        await saveApplication(appPayload);
        
        // Render Success Card Screen
        applyCardForm.classList.add('hidden');
        successScreenCard.classList.remove('hidden');
        showAlert("Application Submitted Successfully!", "success");
        
        // Populate Job details on success screen
        successJobDetails.innerHTML = `
            <h4 style="font-family:'Outfit', sans-serif; font-size:16px; font-weight:700; color:var(--text-primary);">${currentJob.title}</h4>
            <span style="font-size:13px; color:var(--text-secondary);">${currentJob.company} &bull; ${currentJob.location}</span>
        `;
        
        successScreenCard.scrollIntoView({ behavior: 'smooth' });
        
    } catch (err) {
        console.error("Submission failed:", err);
        showAlert("Failed to submit application: " + err.message);
        btnSubmitApplication.disabled = false;
        btnSubmitApplication.innerHTML = originalText;
    }
}

// Initializer function
function initApplyPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    
    if (jobId) {
        renderJobHeader(jobId);
    } else {
        showAlert("Invalid request. No internship selected.");
    }
    
    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            
            // Get profile details
            currentProfile = await getUserProfile(userId);
            populateApplicantDetails();
        }
    });
    
    if (applicationForm) {
        applicationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitApplication();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApplyPage);
} else {
    initApplyPage();
}
