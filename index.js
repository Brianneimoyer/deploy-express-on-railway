const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// DEBUG: Log API key status on startup
console.log("=== STARTUP DEBUG ===");
console.log("API Key exists:", !!ANTHROPIC_API_KEY);
console.log("API Key first 15 chars:", ANTHROPIC_API_KEY?.substring(0, 15));

app.post("/chat", async (req, res) => {
  console.log("=== CHAT REQUEST DEBUG ===");
  console.log("Messages received:", req.body.messages?.length);
  
  try {
    const cleanMessages = req.body.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log("Clean messages prepared:", cleanMessages.length);
    console.log("About to call Claude API...");
    
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: cleanMessages,
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
    console.log("Response received, sending back to client...");
    res.json({ content: response.data.content[0].text });
    
  } catch (err) {
    console.log("❌ CLAUDE API ERROR:");
    console.error("Error details:", err.response?.data || err.message);
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
