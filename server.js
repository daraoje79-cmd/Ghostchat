require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const rateLimits = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip || 'unknown';
  const now = Date.now();
  let e = rateLimits.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60000 }; rateLimits.set(ip, e); }
  e.count++;
  if (e.count > 20) return res.status(429).json({ error: 'Too many requests.' });
  next();
}

const BLOCKED = [
  /\b(kill yourself|kys|suicide method)\b/i,
  /\b(n[i1]gg[ae]r|f[a4]gg[o0]t)\b/i,
  /\b(buy [^\s]+ cheap|click here to win|free money)\b/i,
];

app.post('/api/moderate', rateLimit, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ safe: false });
  for (const p of BLOCKED) { if (p.test(text)) return res.json({ safe: false, reason: 'Content policy violation.' }); }
  return res.json({ safe: true });
});

app.post('/api/ai', rateLimit, async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question.' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No Gemini API key set. Set GEMINI_API_KEY or GOOGLE_API_KEY.' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `You are GhostAI, a friendly AI assistant in an anonymous chat room called GhostChat. Be warm, concise, and helpful. Keep responses under 200 words. For emotional topics, acknowledge feelings first. No markdown, no bullet points — plain text only.`
    });

    const result = await model.generateContent(question);
    const answer = result.response.text();
    res.json({ answer });
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'AI unavailable.', reason: err?.message || String(err) });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(port, () => {
  console.log(`\n🚀 GhostChat running at http://localhost:${port}`);
  console.log(`   Gemini API key: ${process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing'}\n`);
});