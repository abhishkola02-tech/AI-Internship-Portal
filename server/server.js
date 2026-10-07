const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow cross-origin requests from the frontend
app.use(express.json()); // Parse JSON bodies

// Routes
const analyzeRoutes = require('./routes/analyze');
const chatRoutes = require('./routes/chat');

app.use('/api/analyze', analyzeRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'AI Internship Portal Backend is running.' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
});
