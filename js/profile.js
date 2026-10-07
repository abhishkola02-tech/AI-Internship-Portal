// js/profile.js
// Handles user profile updates, tag chip injection, field mapping, and validations.

import { 
    onAuthStateChanged, 
    getUserProfile, 
    saveUserProfile 
} from './firebase.js';

// DOM Elements
const profileForm = document.getElementById('profile-form');
const nameInput = document.getElementById('profile-name');
const emailInput = document.getElementById('profile-email');
const phoneInput = document.getElementById('profile-phone');
const branchInput = document.getElementById('profile-branch');
const cgpaInput = document.getElementById('profile-cgpa');
const interestsInput = document.getElementById('profile-interests');
const certsInput = document.getElementById('profile-certifications');
const linkedinInput = document.getElementById('profile-linkedin');
const githubInput = document.getElementById('profile-github');
const btnSave = document.getElementById('btn-save-profile');

const skillsInput = document.getElementById('skills-input');
const skillsContainer = document.getElementById('skills-tag-container');

// State holding user details
let userId = null;
let skills = [];
let existingProfileData = {};

// Alert Messages helper
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alert-box');
    const alertMsg = document.getElementById('alert-message');
    const alertIcon = alertBox.querySelector('.alert-icon');
    
    if (!alertBox || !alertMsg) return;
    
    alertMsg.textContent = message;
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
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
    const alertBox = document.getElementById('alert-box');
    if (alertBox) {
        alertBox.classList.add('hidden');
    }
}

// Renders the tags inside the tag-input-container
function renderSkillChips() {
    // Remove existing chips
    const existingChips = skillsContainer.querySelectorAll('.tag-chip');
    existingChips.forEach(chip => chip.remove());
    
    // Create new chips and insert them before the input element
    skills.forEach((skill, index) => {
        const chip = document.createElement('div');
        chip.className = 'tag-chip';
        chip.innerHTML = `
            <span>${skill}</span>
            <span class="tag-delete" data-index="${index}">
                <i class="fa-solid fa-xmark"></i>
            </span>
        `;
        skillsContainer.insertBefore(chip, skillsInput);
    });
    
    // Re-bind delete click events
    const deleteButtons = skillsContainer.querySelectorAll('.tag-delete');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.getAttribute('data-index'));
            removeSkill(index);
        });
    });
}

// Add skill to array and re-render
function addSkill(skillName) {
    const cleanSkill = skillName.trim();
    if (cleanSkill === "") return;
    
    // Avoid duplicates (case-insensitive checks)
    const lowercaseSkills = skills.map(s => s.toLowerCase());
    if (!lowercaseSkills.includes(cleanSkill.toLowerCase())) {
        skills.push(cleanSkill);
        renderSkillChips();
    }
    
    skillsInput.value = "";
}

// Remove skill from array and re-render
function removeSkill(index) {
    skills.splice(index, 1);
    renderSkillChips();
}

// Setup Event Listeners for Dynamic Tag input
function initTagInput() {
    if (!skillsInput || !skillsContainer) return;
    
    // Focus container on clicking border wrapper
    skillsContainer.addEventListener('click', (e) => {
        if (e.target === skillsContainer) {
            skillsInput.focus();
        }
    });

    skillsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addSkill(skillsInput.value);
        }
    });

    skillsInput.addEventListener('blur', () => {
        addSkill(skillsInput.value);
    });
}

// Populate form elements with profile data from Firestore
async function populateProfileForm(user) {
    try {
        existingProfileData = await getUserProfile(user.uid) || {};
        
        // Map elements
        nameInput.value = existingProfileData.name || user.displayName || "";
        emailInput.value = existingProfileData.email || user.email || "";
        phoneInput.value = existingProfileData.phone || "";
        branchInput.value = existingProfileData.branch || "";
        cgpaInput.value = existingProfileData.cgpa || "";
        interestsInput.value = existingProfileData.interests || "";
        certsInput.value = existingProfileData.certifications || "";
        linkedinInput.value = existingProfileData.linkedinUrl || "";
        githubInput.value = existingProfileData.githubUrl || "";
        
        // Map skills
        skills = Array.isArray(existingProfileData.skills) ? [...existingProfileData.skills] : [];
        renderSkillChips();
        
        // Map Resume Display
        const resumeDisplay = document.getElementById('profile-resume-display');
        if (resumeDisplay) {
            if (existingProfileData.resumeUrl) {
                const fileName = existingProfileData.resumeFileName || "Uploaded_Resume.pdf";
                const uploadDate = existingProfileData.resumeUploadedAt 
                    ? new Date(existingProfileData.resumeUploadedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : "";
                
                resumeDisplay.style.textAlign = "left";
                resumeDisplay.style.borderStyle = "solid";
                resumeDisplay.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
                        <div style="display:flex; align-items:center; gap:14px;">
                            <div style="width:44px; height:44px; background:rgba(231,76,60,0.15); border-radius:10px; display:flex; align-items:center; justify-content:center; color:#e74c3c; font-size:22px;">
                                <i class="fa-solid fa-file-pdf"></i>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:15px; color:var(--text-primary); font-weight:600;">${fileName}</h4>
                                <span style="font-size:12px; color:var(--text-secondary);">${uploadDate ? `Uploaded on ${uploadDate}` : 'Active stored PDF'}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <a href="${existingProfileData.resumeUrl}" target="_blank" download="${fileName}" class="btn-save" style="text-decoration:none; padding:8px 14px; font-size:13px; background:rgba(255,255,255,0.08); border:1px solid var(--border-color); color:var(--text-primary);">
                                <i class="fa-solid fa-file-arrow-down"></i> View / Download PDF
                            </a>
                            <a href="upload-resume.html" class="btn-save" style="text-decoration:none; padding:8px 14px; font-size:13px;">
                                <i class="fa-solid fa-pen-to-square"></i> Replace PDF
                            </a>
                        </div>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error("Error fetching user profile:", error);
        showAlert("Failed to load profile details. Please try again.");
    }
}

// Submit Profile Changes
async function saveProfile() {
    hideAlert();
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const branch = branchInput.value;
    const cgpaRaw = cgpaInput.value.trim();
    const interests = interestsInput.value.trim();
    const certifications = certsInput.value.trim();
    const linkedinUrl = linkedinInput.value.trim();
    const githubUrl = githubInput.value.trim();
    
    // Valdiation checks
    if (!name || !phone || !cgpaRaw) {
        showAlert("Full Name, Phone Number, and CGPA are required.");
        return;
    }
    
    const cgpa = parseFloat(cgpaRaw);
    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        showAlert("CGPA must be a valid decimal number between 0.00 and 10.00.");
        return;
    }
    
    if (skills.length === 0) {
        showAlert("Please enter at least one professional skill.");
        return;
    }
    
    // Toggle Save Button State
    btnSave.disabled = true;
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    
    try {
        // Prepare profile payload. Merge existing file urls / config properties
        const payload = {
            ...existingProfileData,
            name,
            phone,
            branch,
            cgpa,
            skills,
            interests,
            certifications,
            linkedinUrl,
            githubUrl,
            updatedAt: new Date().toISOString()
        };
        
        await saveUserProfile(userId, payload);
        showAlert("Profile changes saved successfully!", "success");
        
        // Reload details in memory
        existingProfileData = payload;
        
    } catch (err) {
        console.error("Profile save failed:", err);
        showAlert("Failed to save changes: " + err.message);
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
    }
}

// Wire everything up on load
function initProfilePage() {
    initTagInput();
    
    onAuthStateChanged((user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            populateProfileForm(currentUser);
        }
    });
    
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProfile();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
    initProfilePage();
}
