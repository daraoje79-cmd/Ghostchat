const API_BASE = 'http://localhost:3000';

const AVATAR_POOL = [
  { e: '🐺', bg: '#1e1b4b' }, { e: '🦊', bg: '#1f1007' },
  { e: '🐸', bg: '#052e16' }, { e: '🦋', bg: '#1f0a0a' },
  { e: '🐙', bg: '#0c1a35' }, { e: '🦄', bg: '#2e1065' },
  { e: '🐉', bg: '#042f2e' }, { e: '🦁', bg: '#1c1003' },
];
const CODENAMES = ['Shadow','Ghost','Phantom','Cipher','Wraith','Specter','Veil','Mist','Echo','Void','Raven','Neon'];

const myAvatarData = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
const myName = 'Anon ' + CODENAMES[Math.floor(Math.random() * CODENAMES.length)];

const messagesEl  = document.getElementById('messages');
const msgInput    = document.getElementById('msgInput');
const sendBtn     = document.getElementById('sendBtn');
const typingWrap  = document.getElementById('typingWrap');
const modNotice   = document.getElementById('modNotice');
const onlineCount = document.getElementById('onlineCount');
const menuBtn     = document.getElementById('menuBtn');
const sidebar     = document.getElementById('sidebar');
const overlay     = document.getElementById('overlay');
const sidebarClose= document.getElementById('sidebarClose');
const emojiToggle = document.getElementById('emojiToggle');
const quickEmojis = document.getElementById('quickEmojis');

document.getElementById('myAvatarSidebar').textContent = myAvatarData.e;
document.getElementById('myAvatarSidebar').style.background = myAvatarData.bg;
document.getElementById('myNameSidebar').textContent = myName;

menuBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('visible'); });
[sidebarClose, overlay].forEach(el => el.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }));

document.querySelectorAll('.room-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.room-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('currentRoom').textContent = btn.dataset.room;
    if (window.innerWidth <= 680) { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }
  });
});

emojiToggle.addEventListener('click', () => { quickEmojis.style.display = quickEmojis.style.display === 'none' ? 'flex' : 'none'; });
quickEmojis.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => { msgInput.value += btn.textContent; msgInput.focus(); quickEmojis.style.display = 'none'; });
});

msgInput.addEventListener('input', () => { msgInput.style.height = 'auto'; msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px'; });
msgInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
sendBtn.addEventListener('click', handleSend);

let count = 24;
setInterval(() => { count = Math.max(10, count + (Math.random() > 0.5 ? 1 : -1)); onlineCount.textContent = count; }, 5000);

let msgId = 0;

function renderMessage({ text, isMine = false, avatarData = null, name = 'Anonymous', isAI = false, reactions = {} }) {
  const id = 'msg-' + (++msgId);
  const av = isMine ? myAvatarData : (avatarData || AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)]);
  const displayName = isMine ? myName : name;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMine ? ' mine' : '');
  row.id = id;
  row._reactions = { ...reactions };
  const avatarClass = isAI ? 'msg-avatar ai-avatar' : 'msg-avatar';
  const avatarContent = isAI ? '🤖' : av.e;
  const avatarStyle = isAI ? '' : `background:${av.bg}`;
  const highlightedText = text.replace(/@AI\b/gi, '<span class="mention-ai">@AI</span>');
  const bubbleClass = isAI ? 'msg-bubble ai-bubble' : 'msg-bubble';
  const aiLabel = isAI ? '<div class="ai-label">✦ AI Response</div>' : '';
  const reactionHtml = buildReactionsHtml(id, row._reactions);
  row.innerHTML = `
    <div class="${avatarClass}" style="${avatarStyle}">${avatarContent}</div>
    <div class="msg-content">
      <div class="msg-meta">
        <span class="msg-name">${displayName}</span>
        <span class="msg-time">${time}</span>
      </div>
      <div class="${bubbleClass}">${aiLabel}${highlightedText}</div>
      <div class="reactions-row" id="rr-${id}">${reactionHtml}</div>
      <div class="react-picker" id="picker-${id}">
        ${['👍','❤️','😂','😮','🔥','💯','✨','👀','😭','💀','🙌','🤯'].map(e => `<button onclick="applyReaction('${id}','${e}')">${e}</button>`).join('')}
      </div>
    </div>`;
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return id;
}

function buildReactionsHtml(id, reactions) {
  let html = '';
  Object.entries(reactions).forEach(([e, d]) => {
    if (d.count > 0) html += `<button class="react-btn${d.active ? ' active' : ''}" onclick="toggleReaction('${id}','${e}')">${e} ${d.count}</button>`;
  });
  html += `<button class="add-react" onclick="openPicker('${id}')">＋</button>`;
  return html;
}

function refreshReactions(id) {
  const row = document.getElementById(id);
  if (!row) return;
  document.getElementById('rr-' + id).innerHTML = buildReactionsHtml(id, row._reactions);
}

window.toggleReaction = (id, emoji) => {
  const row = document.getElementById(id);
  if (!row) return;
  const r = row._reactions[emoji];
  if (!r) return;
  r.active = !r.active;
  r.count += r.active ? 1 : -1;
  if (r.count <= 0) delete row._reactions[emoji];
  refreshReactions(id);
};

window.openPicker = (id) => {
  document.querySelectorAll('.react-picker').forEach(p => { if (p.id !== 'picker-' + id) p.classList.remove('open'); });
  document.getElementById('picker-' + id)?.classList.toggle('open');
};

window.applyReaction = (id, emoji) => {
  const row = document.getElementById(id);
  if (!row) return;
  if (!row._reactions[emoji]) row._reactions[emoji] = { count: 0, active: false };
  const r = row._reactions[emoji];
  r.active = !r.active;
  r.count += r.active ? 1 : -1;
  if (r.count <= 0) delete row._reactions[emoji];
  document.getElementById('picker-' + id)?.classList.remove('open');
  refreshReactions(id);
};

document.addEventListener('click', e => {
  if (!e.target.closest('.add-react') && !e.target.closest('.react-picker')) {
    document.querySelectorAll('.react-picker').forEach(p => p.classList.remove('open'));
  }
});

function addDateDivider(label = 'Today') {
  const div = document.createElement('div');
  div.className = 'date-divider';
  div.innerHTML = `<span>${label}</span>`;
  messagesEl.appendChild(div);
}

addDateDivider('Today');
[
  { text: 'anyone else feel like they need to vent but have no one to talk to?', reactions: { '❤️': { count: 7, active: false }, '😮': { count: 2, active: false } } },
  { text: 'this is literally the only place i feel comfortable being honest 💙', reactions: { '💯': { count: 11, active: false } } },
  { text: 'no judgment zone, just vibes 🙏', reactions: { '👍': { count: 14, active: false }, '🔥': { count: 5, active: false } } },
  { text: 'try asking @AI something, it actually helps!', reactions: {} },
].forEach(m => renderMessage({ text: m.text, reactions: m.reactions }));

async function handleSend() {
  const text = msgInput.value.trim();
  if (!text) return;
  msgInput.value = '';
  msgInput.style.height = 'auto';
  quickEmojis.style.display = 'none';
  sendBtn.disabled = true;
  const safe = await moderateMessage(text);
  sendBtn.disabled = false;
  if (!safe) { modNotice.style.display = 'flex'; setTimeout(() => modNotice.style.display = 'none', 5000); return; }
  renderMessage({ text, isMine: true });
  if (/@AI\b/i.test(text)) {
    const question = text.replace(/@AI\b/gi, '').trim() || text;
    await askAI(question);
  }
}

async function moderateMessage(text) {
  try {
    const res = await fetch(`${API_BASE}/api/moderate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!res.ok) return true;
    const data = await res.json();
    return data.safe;
  } catch { return true; }
}

async function askAI(question) {
  typingWrap.style.display = 'flex';
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const res = await fetch(`${API_BASE}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
    const data = await res.json();
    typingWrap.style.display = 'none';
    if (!res.ok) {
      const reason = data?.reason || data?.error || 'Unknown AI error.';
      renderMessage({ text: `⚠️ AI is unavailable. ${reason}`, isAI: true, name: 'GhostAI', reactions: {} });
      return;
    }
    renderMessage({ text: data.answer, isAI: true, name: 'GhostAI', reactions: {} });
  } catch (err) {
    typingWrap.style.display = 'none';
    const msg = err?.message ? `⚠️ AI is unavailable. ${err.message}` : '⚠️ AI is unavailable. Make sure the backend server is running.';
    renderMessage({ text: msg, isAI: true, name: 'GhostAI', reactions: {} });
  }
}