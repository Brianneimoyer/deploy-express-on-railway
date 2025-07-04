const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const app = express();
app.use(cors());
app.use(express.json());
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

    const result = await response.json();
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
