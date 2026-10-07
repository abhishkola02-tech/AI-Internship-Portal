// js/chat.js
// Handles communication with the backend GPT chat API.

import { 
    onAuthStateChanged,
    getResumeAnalysis,
    getUserProfile
} from './firebase.js';

const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const chatMessagesContainer = document.getElementById('chat-messages');

let chatHistory = [];
let userId = null;
let resumeContext = null;

function addMessageToUI(sender, text, isHtml = false) {
    if (!chatMessagesContainer) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    
    // Convert newlines to HTML breaks if not already HTML
    const formattedText = isHtml ? text : text.replace(/\n/g, '<br>');
    
    msgDiv.innerHTML = `
        <div class="message-bubble">${formattedText}</div>
    `;
    
    chatMessagesContainer.appendChild(msgDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = `chat-message assistant loading-indicator`;
    loadingDiv.id = 'chat-loading';
    loadingDiv.innerHTML = `
        <div class="message-bubble typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    chatMessagesContainer.appendChild(loadingDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function removeLoadingIndicator() {
    const loader = document.getElementById('chat-loading');
    if (loader) loader.remove();
}

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add User message to UI
    addMessageToUI('user', text);
    chatInput.value = '';
    
    // Add to local history
    chatHistory.push({ role: 'user', content: text });

    // Show loading
    addLoadingIndicator();
    btnSend.disabled = true;

    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                chatHistory: chatHistory.slice(-10), // Keep last 10 messages for context
                resumeContext: resumeContext
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        
        removeLoadingIndicator();
        addMessageToUI('assistant', data.response);
        chatHistory.push({ role: 'assistant', content: data.response });

    } catch (error) {
        console.error("Chat API Error:", error);
        removeLoadingIndicator();
        addMessageToUI('assistant', "I'm sorry, I'm having trouble connecting to the server right now. Please make sure the backend server is running.");
    } finally {
        btnSend.disabled = false;
        chatInput.focus();
    }
}

// Check auth and setup context
function initChatPage() {
    // Basic welcome message
    setTimeout(() => {
        addMessageToUI('assistant', "Hello! I am your AI Career Advisor. I can help you with interview prep, resume reviews, or career planning. Once you upload your resume, I'll provide personalized advice based on it.");
    }, 500);

    onAuthStateChanged(async (user) => {
        const currentUser = user || JSON.parse(localStorage.getItem("mock_current_user") || "null");
        if (currentUser) {
            userId = currentUser.uid;
            try {
                // Fetch context so the AI knows about this user
                resumeContext = await getResumeAnalysis(userId);
                const profile = await getUserProfile(userId);
                
                if (resumeContext || profile) {
                    addMessageToUI('system-note', `<em>AI has loaded your profile context and resume analysis.</em>`, true);
                }
            } catch (e) {
                console.log("Could not load user context for chat.", e);
            }
        }
    });

    if (btnSend) {
        btnSend.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatPage);
} else {
    initChatPage();
}