🔄 YES! COMPLETE REPLACEMENT FOR CLAUDE API:
javascriptconst express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.post("/chat", async (req, res) => {
  console.log("Received /chat request:", req.body);
  
  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-sonnet-20240229", // or "claude-3-opus-20240229" for premium
        max_tokens: 1000,
        messages: req.body.messages,
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
    
    console.log("Claude response:", response.data);
    res.json({ content: response.data.content[0].text });
    
  } catch (err) {
    console.error("Claude API error:", err.response?.data || err.message);
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
