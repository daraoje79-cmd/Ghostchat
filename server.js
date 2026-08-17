require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const path      = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const port   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ---- Rate limiting ---- */
const rateLimits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let e = rateLimits.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + 60000 }; rateLimits.set(ip, e); }
  e.count++;
  if (e.count > 30) return res.status(429).json({ error: 'Too many requests.' });
  next();
}

/* ---- Rooms store (in-memory) ---- */
const rooms = new Map();
const DEFAULT_ROOMS = ['general', 'confessions', 'random', 'vent'];
DEFAULT_ROOMS.forEach(r => rooms.set(r, { name: r, messages: [], users: 0, custom: false }));

/* ---- Moderation ---- */
const BLOCKED = [
  /\b(kill yourself|kys|suicide method)\b/i,
  /\b(n[i1]gg[ae]r|f[a4]gg[o0]t)\b/i,
  /\b(buy [^\s]+ cheap|click here to win|free money)\b/i,
];
function isClean(text) {
  return !BLOCKED.some(p => p.test(text));
}

/* ---- AI endpoint ---- */
app.post('/api/ai', rateLimit, async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question.' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key.' });
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: `You are GhostAI, a friendly AI assistant in an anonymous chat room called GhostChat. Be warm, concise, and helpful. Keep responses under 200 words. For emotional topics, acknowledge feelings first. No markdown, no bullet points — plain text only.`
    });
    const result = await model.generateContent(question);
    res.json({ answer: result.response.text() });
  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ error: 'AI unavailable.' });
  }
});

/* ---- Create room endpoint ---- */
app.post('/api/rooms', rateLimit, (req, res) => {
  const { name } = req.body;
  if (!name || name.length < 2 || name.length > 30) return res.status(400).json({ error: 'Invalid room name.' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  if (!rooms.has(slug)) {
    rooms.set(slug, { name: slug, messages: [], users: 0, custom: true });
  }
  res.json({ slug });
});

/* ---- Get rooms list ---- */
app.get('/api/rooms', (req, res) => {
  const list = [];
  rooms.forEach((v, k) => list.push({ slug: k, users: v.users, custom: v.custom }));
  res.json(list);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

/* ---- Socket.io ---- */
io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', (room) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) rooms.get(currentRoom).users = Math.max(0, rooms.get(currentRoom).users - 1);
      io.to(currentRoom).emit('user-count', rooms.get(currentRoom)?.users || 0);
    }

    if (!rooms.has(room)) {
      rooms.set(room, { name: room, messages: [], users: 0, custom: true });
    }

    currentRoom = room;
    socket.join(room);
    rooms.get(room).users++;

    // Send last 50 messages to new user
    socket.emit('history', rooms.get(room).messages.slice(-50));
    io.to(room).emit('user-count', rooms.get(room).users);
  });

  socket.on('message', (data) => {
    if (!currentRoom || !data.text || data.text.length > 1000) return;
    if (!isClean(data.text)) {
      socket.emit('moderated', { reason: 'Message blocked by moderation.' });
      return;
    }

    const msg = {
      id: Date.now() + Math.random().toString(36).slice(2),
      text: data.text,
      avatar: data.avatar,
      name: data.name,
      time: new Date().toISOString(),
      reactions: {}
    };

    rooms.get(currentRoom).messages.push(msg);
    if (rooms.get(currentRoom).messages.length > 200) {
      rooms.get(currentRoom).messages.shift();
    }

    io.to(currentRoom).emit('message', msg);
  });

  socket.on('reaction', (data) => {
    if (!currentRoom) return;
    io.to(currentRoom).emit('reaction', data);
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).users = Math.max(0, rooms.get(currentRoom).users - 1);
      io.to(currentRoom).emit('user-count', rooms.get(currentRoom).users);
    }
  });
});

server.listen(port, () => {
  console.log(`\n🚀 GhostChat running at http://localhost:${port}`);
  console.log(`   Gemini API key: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}\n`);
});