const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Initialize OpenAI client safely
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

router.post('/', async (req, res) => {
    try {
        const { message, chatHistory, resumeContext } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        // Construct the system prompt
        let systemPrompt = `You are a helpful AI Career and Internship Advisor for a student portal. 
Provide concise, helpful advice about tech internships, resumes, and skills.`;

        // Inject resume context if available
        if (resumeContext) {
            systemPrompt += `\n\nYou have analyzed the user's resume. Here is the context of their profile:
- Overall Score: ${resumeContext.profileScore}
- ATS Score: ${resumeContext.ATSScore}
- Technical Skills: ${resumeContext.technicalSkills ? resumeContext.technicalSkills.join(', ') : 'None listed'}
- Strengths: ${resumeContext.strengths ? resumeContext.strengths.join(', ') : 'None identified'}
- Recommended Roles: ${resumeContext.recommendedRoles ? resumeContext.recommendedRoles.join(', ') : 'None'}

Use this context to provide highly personalized answers to the user's questions.`;
        }

        // Format history for OpenAI
        const messages = [
            { role: "system", content: systemPrompt }
        ];

        // Add history (if any)
        if (chatHistory && Array.isArray(chatHistory)) {
            // Filter out any system messages from history just in case
            const filteredHistory = chatHistory.filter(msg => msg.role === 'user' || msg.role === 'assistant');
            messages.push(...filteredHistory);
        }

        // Add current message
        messages.push({ role: "user", content: message });

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Or gpt-4o-mini
            messages: messages,
            max_tokens: 800,
            temperature: 0.7
        });

        const responseText = completion.choices[0].message.content;

        res.json({ response: responseText });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ error: error.message || 'An error occurred during chat processing.' });
    }
});

module.exports = router;
