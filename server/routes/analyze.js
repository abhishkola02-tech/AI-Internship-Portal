const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');

// Configure multer for file uploads (store in memory for immediate processing)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Initialize OpenAI client safely
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

router.post('/', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No resume file provided.' });
        }

        const file = req.file;
        const extension = file.originalname.split('.').pop().toLowerCase();
        let extractedText = '';

        // 1. Extract Text based on file type
        console.log(`Extracting text from ${file.originalname}...`);
        if (extension === 'pdf') {
            const pdfData = await pdfParse(file.buffer);
            extractedText = pdfData.text;
        } else if (extension === 'docx') {
            const docxData = await mammoth.extractRawText({ buffer: file.buffer });
            extractedText = docxData.value;
        } else {
            return res.status(400).json({ error: 'Unsupported file format. Only PDF and DOCX are supported.' });
        }

        if (!extractedText || extractedText.trim() === '') {
            return res.status(400).json({ error: 'Could not extract any text from the document.' });
        }

        // 2. Analyze with OpenAI
        console.log('Sending extracted text to OpenAI for analysis...');
        
        const systemPrompt = `You are an expert AI Career and Internship Advisor and a highly accurate Resume Parser. 
Your task is to analyze the provided resume text and return a structured JSON response.

You MUST extract and generate the following fields in the exact JSON format specified below:
{
  "profileScore": (number, 0-100, overall quality of the resume),
  "studentName": (string, candidate full name parsed from resume),
  "education": (string, highest degree / college / university),
  "skills": [(array of strings, all key technical and professional skills)],
  "technicalSkills": [(array of strings, strictly technical skills like Python, React, AWS, etc.)],
  "experience": [(array of strings, summaries of work or internship experience)],
  "projects": [(array of strings, key projects mentioned in resume)],
  "certifications": [(array of strings, certifications or online courses listed)],
  "summary": (string, 2-3 sentences summarizing their profile),
  "strengths": [(array of strings, key strengths)],
  "weaknesses": [(array of strings, areas for improvement)],
  "missingSkills": [(array of strings, skills that would make them more competitive for their likely target roles)],
  "recommendedRoles": [(array of strings, e.g., "Frontend Developer", "Data Analyst")],
  "recommendedInternships": [
      {
          "title": (string),
          "domain": (string),
          "reason": (string, why this fits them)
      }
  ],
  "roadmap": [
      {
          "step": (string, e.g., "Phase 1: Deepen Fundamentals"),
          "description": (string)
      }
  ],
  "courses": [
      {
          "name": (string),
          "platform": (string, e.g., Coursera, YouTube),
          "topic": (string)
      }
  ],
  "projectsToBuild": [
      {
          "title": (string),
          "description": (string),
          "techStack": [(array of strings)]
      }
  ],
  "resumeImprovements": [(array of strings, actionable advice to improve the resume itself)],
  "ATSScore": (number, 0-100, estimated ATS parseability and keyword match),
  "AIConfidence": (number, 0-100, your confidence in this analysis based on the resume clarity)
}

IMPORTANT: 
- Return ONLY valid JSON. Do not include markdown code blocks (like \`\`\`json) or any other text before or after the JSON.
- Be highly analytical and constructive.
- Extract as many technical skills as you can find.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using gpt-4o-mini for speed and cost-effectiveness as discussed
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Here is the resume text to analyze:\n\n${extractedText}` }
            ],
            temperature: 0.2, // Low temperature for more deterministic/structured output
        });

        const rawResponse = completion.choices[0].message.content;
        
        // Safely parse the JSON response (handling potential markdown wrapping)
        let jsonResponse;
        try {
            let cleanResponse = rawResponse.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
            } else if (cleanResponse.startsWith('```')) {
                 cleanResponse = cleanResponse.replace(/^```\n/, '').replace(/\n```$/, '');
            }
            jsonResponse = JSON.parse(cleanResponse);
        } catch (parseError) {
            console.error('Failed to parse OpenAI response as JSON:', parseError);
            console.error('Raw response was:', rawResponse);
            return res.status(500).json({ error: 'Failed to process AI analysis results.' });
        }

        console.log('Analysis completed successfully.');
        res.json(jsonResponse);

    } catch (error) {
        console.error('Error in /api/analyze:', error);
        res.status(500).json({ error: error.message || 'An error occurred during resume analysis.' });
    }
});

module.exports = router;
