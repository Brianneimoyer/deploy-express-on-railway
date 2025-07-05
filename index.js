const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const app = express();
const multer = require('multer');
const pdf = require('pdf-parse');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.get('/', (req, res) => {
  res.json({ message: "Railway server is running!" });
});

// TEST PROXY ROUTE
app.post('/test-proxy', (req, res) => {
  res.json({ message: "Proxy route working!" });
});

// SUPABASE PROXY ROUTE (ONLY ONE!)
app.post('/supabase-proxy', async (req, res) => {
  console.log("=== SUPABASE PROXY REQUEST RECEIVED ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const { action, table, data, query } = req.body;
    
    const supabaseUrl = 'https://kiajxqdnzlnczshtfcdq.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpYWp4cWRuemxuY3pzaHRmY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTEyMzQsImV4cCI6MjA2Njg4NzIzNH0.CSN2qoIiR61zKfSDys-zOUjYJgtNmOJX0thDO8b3Ikk';
    
    let method = 'GET';
    let url = `${supabaseUrl}/rest/v1/${table}`;
    let body = null;
    
    if (action === 'select') {
      url += query ? `?${query}` : '?select=*';
    } else if (action === 'insert') {
      method = 'POST';
      body = JSON.stringify(data);
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body
    });

    console.log("=== SUPABASE FETCH RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);

    if (!response.ok) {
      const errorText = await response.text();

      // Try to parse as JSON error (cleaner logging)
      try {
        const jsonError = JSON.parse(errorText);
        console.log("❌ SUPABASE JSON ERROR:", JSON.stringify(jsonError, null, 2));
        return res.status(response.status).json({ error: jsonError });
      } catch (err) {
        // Fallback if it's plain text
        console.log("❌ SUPABASE TEXT ERROR:", errorText);
        return res.status(response.status).json({ error: errorText });
      }
    }

    let result;
    if (response.status === 201 && action === 'insert') {
      // Insert operations often return empty body
      result = { success: true, status: 'created' };
    } else {
      result = await response.json();
    }

if (req.body.action === 'insert') {
  console.log("=== INSERT OPERATION RESULT ===");
  console.log("Insert result:", JSON.stringify(result, null, 2));
}
    console.log("=== SUPABASE RESPONSE ===");
    console.log("Response from Supabase:", JSON.stringify(result, null, 2));
    res.json({ data: result });
    
  } catch (error) {
    console.log("=== CATCH ERROR ===");
    console.log("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// CHAT ROUTE
app.post("/chat", async (req, res) => {
  console.log("=== CHAT REQUEST DEBUG ===");
  console.log("Messages received:", req.body.messages?.length);
  
  try {
    // SEPARATE SYSTEM MESSAGES FROM USER/ASSISTANT MESSAGES
    const systemMessages = req.body.messages
      .filter(msg => msg.role === "system")
      .map(msg => msg.content)
      .join("\n\n");
    
    let conversationMessages = req.body.messages
      .filter(msg => msg.role !== "system")
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    if (conversationMessages.length === 0) {
      conversationMessages.push({
        role: "user",
        content: "Provide a brief response based on the system context."
      });
    }
    
    console.log("System messages combined:", systemMessages.length, "chars");
    console.log("Conversation messages:", conversationMessages.length);
    
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        system: systemMessages, // System messages go here
        messages: conversationMessages, // Only user/assistant messages
        temperature: 0.7,
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
      }
    );
    
    console.log("✅ Claude API SUCCESS!");
    
    if (response.data.content && response.data.content.length > 0 && response.data.content[0].text) {
      res.json({ text: response.data.content[0].text, content: response.data.content[0].text });
    } else {
      console.log("❌ Empty Claude response (likely token limit):", response.data);
      res.json({ text: "Summary unavailable due to length.", content: "Summary unavailable due to length." });
    }
    
  } catch (err) {
    console.log("❌ CLAUDE API ERROR:");
    console.error("Error details:", err.response?.data || err.message);
    res.status(500).json({ error: err.toString() });
  }
});

// Web Search Endpoint
app.post('/web-search', async (req, res) => {
  try {
    const { query, userId, maxResults = 5 } = req.body;
    
    console.log('🌐 Web search request:', { query, userId, maxResults });
    
    // For now, we'll return mock results for testing
    // You can add real web search API later
    const apiKey = process.env.BING_SEARCH_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ No Bing API key found, returning mock results');
      // Return mock results for testing
      return res.json([
        {
          title: `Mock Result for "${query}"`,
          url: "https://example.com/1",
          snippet: `This is a mock search result for testing the query: ${query}. Web search is working!`
        },
        {
          title: `Another Result for "${query}"`,
          url: "https://example.com/2", 
          snippet: `Additional mock result to demonstrate web search functionality for: ${query}`
        }
      ]);
    }
    
    // Real Bing search (when you add API key later)
    const searchUrl = `https://api.bing.microsoft.com/v7.0/search`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      },
      params: {
        q: query,
        count: maxResults,
        responseFilter: 'Webpages'
      }
    });
    
    const results = response.data.webPages?.value?.map(item => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet
    })) || [];
    
    console.log('✅ Web search results:', results.length);
    res.json(results);
    
  } catch (error) {
    console.error('❌ Web search error:', error);
    res.status(500).json({ error: 'Web search failed' });
  }
});

// Image Analysis Endpoint
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageData, fileName, userId } = req.body;
    
    console.log('🖼️ Image analysis request:', { fileName, userId });
    
    // For now, return a simple analysis
    // Later you can integrate with OpenAI GPT-4V or Google Vision
    const mockAnalysis = {
      description: `Analysis of image: ${fileName}`,
      objects: ['object1', 'object2'],
      text: 'No text detected',
      analysis: `This appears to be an uploaded image called "${fileName}". Full AI analysis would require additional API integration with vision AI services.`,
      confidence: 0.85,
      suggestions: [
        'This image has been successfully received',
        'Image format appears to be supported', 
        'Ready for AI analysis when vision API is configured'
      ]
    };
    
    console.log('✅ Image analysis complete');
    res.json(mockAnalysis);
    
  } catch (error) {
    console.error('❌ Image analysis error:', error);
    res.status(500).json({ error: 'Image analysis failed' });
  }
});

// PDF Processing Endpoint
app.post('/process-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }
    
    console.log('📄 PDF processing request:', { 
      fileName: req.file.originalname,
      size: req.file.size 
    });
    
    // Extract text from PDF
    const pdfData = await pdf(req.file.buffer);
    
    const result = {
      text: pdfData.text,
      metadata: {
        pages: pdfData.numpages,
        info: pdfData.info,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        wordCount: pdfData.text.split(/\s+/).length,
        charCount: pdfData.text.length
      },
      summary: `PDF "${req.file.originalname}" contains ${pdfData.numpages} pages with ${pdfData.text.split(/\s+/).length} words.`
    };
    
    console.log('✅ PDF processed successfully:', {
      pages: result.metadata.pages,
      textLength: result.text.length,
      wordCount: result.metadata.wordCount
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ PDF processing error:', error);
    res.status(500).json({ 
      error: 'PDF processing failed',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
