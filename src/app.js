// ── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey: (typeof window.OPENAI_API_KEY === 'string' && window.OPENAI_API_KEY.trim())
    ? window.OPENAI_API_KEY.trim()
    : '',
  rows: [],
  headers: [],
  chineseColumns: [],
  hasServerKey: false,
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const settingsOverlay = document.getElementById('settings-overlay');
const settingsBtn     = document.getElementById('settings-btn');
const settingsClose   = document.getElementById('settings-close');
const apiKeyInput     = document.getElementById('api-key-input');
const apiKeyToggle    = document.getElementById('api-key-toggle');
const apiKeySave      = document.getElementById('api-key-save');
const recentsSidebar  = document.getElementById('recents-sidebar');
const recentsList     = document.getElementById('recents-list');
const newChatBtn      = document.getElementById('new-chat-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const openSidebarBtn  = document.getElementById('open-sidebar-btn');
const messagesEl      = document.getElementById('messages');
const chatScroll      = document.getElementById('chat-scroll');
const inputWrapper    = document.getElementById('input-wrapper');
const chatInput       = document.getElementById('chat-input');
const sendBtn         = document.getElementById('send-btn');
const attachmentCard  = document.getElementById('attachment-card');
const attachmentName  = document.getElementById('attachment-name');
const removeAttachmentBtn = document.getElementById('remove-attachment');

const START_PLACEHOLDER = 'Drop a CSV file to get started…';
const STORAGE_KEY = 'translateai.conversations.v1';
const LOCAL_APP_URL = 'http://localhost:8787';
const welcomeMarkup = messagesEl.innerHTML;
let conversations = loadConversations();
let currentConversationId = null;

// ── Settings panel ─────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });
apiKeyToggle.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'text' ? 'password' : 'text';
});
apiKeySave.addEventListener('click', saveKey);
apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveKey(); });
closeSidebarBtn.addEventListener('click', closeSidebar);
openSidebarBtn.addEventListener('click', openSidebar);
newChatBtn.addEventListener('click', startNewChat);
removeAttachmentBtn.addEventListener('click', clearPendingFile);
renderRecents();
redirectFileMode();
loadServerStatus();

async function redirectFileMode() {
  if (window.location.protocol !== 'file:') return;
  try {
    await fetch(`${LOCAL_APP_URL}/health`, { cache: 'no-store' });
    window.location.href = LOCAL_APP_URL;
  } catch {
    addAiMessage(
      `Run the local server first, then open ` +
      `<a href="${LOCAL_APP_URL}">${LOCAL_APP_URL}</a>.`
    );
  }
}

async function loadServerStatus() {
  if (window.location.protocol === 'file:') return;
  try {
    const res = await fetch('/api/status', { cache: 'no-store' });
    const status = await res.json();
    state.hasServerKey = Boolean(status.hasServerKey);
    settingsBtn.classList.toggle('hidden', state.hasServerKey);
  } catch {
    state.hasServerKey = false;
  }
}

function closeSidebar() {
  document.body.classList.add('sidebar-closed');
  recentsSidebar.setAttribute('aria-hidden', 'true');
  openSidebarBtn.classList.remove('hidden');
}

function openSidebar() {
  document.body.classList.remove('sidebar-closed');
  recentsSidebar.setAttribute('aria-hidden', 'false');
  openSidebarBtn.classList.add('hidden');
}

// ── Conversation history ──────────────────────────────────────────────────
function loadConversations() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 20)));
}

function renderRecents() {
  recentsList.innerHTML = '';
  if (!conversations.length) {
    const empty = document.createElement('div');
    empty.className = 'recents-empty';
    empty.textContent = 'No recent chats yet';
    recentsList.appendChild(empty);
    return;
  }

  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = `recent-row${conv.id === currentConversationId ? ' active' : ''}`;

    const btn = document.createElement('button');
    btn.className = 'recent-item';
    btn.type = 'button';
    btn.textContent = conv.title;
    btn.title = conv.title;
    btn.addEventListener('click', () => loadConversation(conv.id));

    const del = document.createElement('button');
    del.className = 'recent-delete';
    del.type = 'button';
    del.setAttribute('aria-label', `Delete ${conv.title}`);
    del.title = 'Delete chat';
    del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    del.addEventListener('click', e => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });

    item.appendChild(btn);
    item.appendChild(del);
    recentsList.appendChild(item);
  });
}

function deleteConversation(id) {
  conversations = conversations.filter(c => c.id !== id);
  saveConversations();
  if (currentConversationId === id) {
    startNewChat();
    return;
  }
  renderRecents();
}

function startNewChat() {
  currentConversationId = null;
  resetWorkingState();
  messagesEl.innerHTML = welcomeMarkup;
  hideAttachmentCard();
  disableInput(START_PLACEHOLDER);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  renderRecents();
}

function resetWorkingState() {
  state.rows = [];
  state.headers = [];
  state.chineseColumns = [];
  pendingFile = null;
}

function loadConversation(id) {
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;
  currentConversationId = id;
  resetWorkingState();
  Object.assign(state, {
    rows: conv.csvState?.rows || [],
    headers: conv.csvState?.headers || [],
    chineseColumns: conv.csvState?.chineseColumns || [],
  });
  messagesEl.innerHTML = conv.html || welcomeMarkup;
  restoreInteractiveMessages();
  hideAttachmentCard();
  chatInput.value = '';
  chatInput.style.height = 'auto';
  enableInput(state.rows.length
    ? 'Tell me which columns to translate and the target language…'
    : START_PLACEHOLDER);
  if (!state.rows.length) disableInput(START_PLACEHOLDER);
  renderRecents();
  scrollDown();
}

function ensureConversation(titleSeed) {
  if (currentConversationId) return;
  const id = `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  currentConversationId = id;
  conversations.unshift({
    id,
    title: titleFromSeed(titleSeed),
    html: '',
    csvState: { rows: [], headers: [], chineseColumns: [] },
    updatedAt: Date.now(),
  });
  saveConversations();
  renderRecents();
}

function titleFromSeed(seed) {
  const clean = String(seed || '').replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim();
  if (!clean) return 'New CSV Translation';
  return clean.length > 34 ? `${clean.slice(0, 31)}...` : clean;
}

function persistConversation() {
  if (!currentConversationId) return;
  const conv = conversations.find(c => c.id === currentConversationId);
  if (!conv) return;
  conv.html = messagesEl.innerHTML;
  conv.csvState = {
    rows: state.rows,
    headers: state.headers,
    chineseColumns: state.chineseColumns,
  };
  conv.updatedAt = Date.now();
  conversations = [
    conv,
    ...conversations.filter(c => c.id !== currentConversationId),
  ];
  saveConversations();
  renderRecents();
}

function restoreInteractiveMessages() {
  messagesEl.querySelectorAll('.bubble').forEach(bubble => bindColumnToggle(bubble));
  messagesEl.querySelectorAll('#open-settings-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openSettings();
    });
  });
}

function openSettings() {
  settingsOverlay.classList.remove('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'false');
  apiKeyInput.value = state.apiKey;
  renderKeyStatus();
  apiKeyInput.focus();
}

function closeSettings() {
  settingsOverlay.classList.add('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

function saveKey() {
  const val = apiKeyInput.value.trim();
  if (!val) { shakeInput(apiKeyInput); return; }
  state.apiKey = val;
  renderKeyStatus();
  closeSettings();
}

function renderKeyStatus() {
  document.getElementById('key-status-line')?.remove();
  if (!state.apiKey) return;
  const p = document.createElement('p');
  p.id = 'key-status-line';
  p.className = 'key-status';
  p.textContent = `Key saved: ${state.apiKey.slice(0, 7)}${'•'.repeat(12)}`;
  apiKeySave.insertAdjacentElement('afterend', p);
}

function shakeInput(el) {
  el.style.borderColor = '#ef4444';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1400);
}

// ── CSV parsing ────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function splitLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

// ── CJK detection ──────────────────────────────────────────────────────────
const CJK = /[一-鿿㐀-䶿\u{20000}-\u{2a6df}]/u;

function detectChineseColumns(headers, rows) {
  return headers.filter(h => rows.some(r => CJK.test(r[h] ?? '')));
}

// ── File handling ──────────────────────────────────────────────────────────
let pendingFile = null;
let composerDragDepth = 0;

inputWrapper.addEventListener('dragenter', e => {
  if (!hasDraggedFiles(e)) return;
  e.preventDefault();
  composerDragDepth++;
  inputWrapper.classList.add('drag-over');
});

inputWrapper.addEventListener('dragover', e => {
  if (!hasDraggedFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  inputWrapper.classList.add('drag-over');
});

inputWrapper.addEventListener('dragleave', e => {
  if (!hasDraggedFiles(e)) return;
  composerDragDepth = Math.max(0, composerDragDepth - 1);
  if (!composerDragDepth) inputWrapper.classList.remove('drag-over');
});

inputWrapper.addEventListener('drop', e => {
  if (!hasDraggedFiles(e)) return;
  e.preventDefault();
  composerDragDepth = 0;
  inputWrapper.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) stageFile(f);
});

function hasDraggedFiles(e) {
  return Array.from(e.dataTransfer?.types || []).includes('Files');
}

function stageFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    addAiMessage('Please upload a <strong>.csv</strong> file.');
    return;
  }

  pendingFile = file;
  chatInput.disabled = false;
  chatInput.value = '';
  chatInput.placeholder = 'Tell me what to translate, or send to read the file.';
  attachmentName.textContent = file.name;
  attachmentCard.classList.remove('hidden');
  sendBtn.disabled = false;
  chatInput.focus();
}

function clearPendingFile() {
  pendingFile = null;
  hideAttachmentCard();
  disableInput(START_PLACEHOLDER);
}

function hideAttachmentCard() {
  attachmentCard.classList.add('hidden');
  attachmentName.textContent = '';
}

function processPendingFile(file, queuedInstruction = '') {
  const reader = new FileReader();
  reader.onload = async e => {
    const { headers, rows } = parseCSV(e.target.result);
    if (!headers.length || !rows.length) {
      addAiMessage('This CSV appears to be empty or invalid. Please try a different file.');
      disableInput(START_PLACEHOLDER);
      return;
    }

    state.headers        = headers;
    state.rows           = rows;
    state.chineseColumns = detectChineseColumns(headers, rows);

    dismissWelcome();

    // ── Upload message ────────────────────────────────────────────────────
    const cCols  = state.chineseColumns;

    let detectionBlock;
    if (cCols.length) {
      detectionBlock =
        `<strong>Chinese Content Found In ${cCols.length} Column${cCols.length !== 1 ? 's' : ''}:</strong>`;
    } else {
      detectionBlock = `<strong>No Chinese content detected.</strong><br>`;
    }

    const queuedTasks = queuedInstruction
      ? parseInstruction(queuedInstruction, state.headers, state.chineseColumns)
      : [];
    let shouldRunQueuedInstruction = Boolean(queuedInstruction && queuedTasks.length);

    let followUpBlock = '';
    if (queuedInstruction && !queuedTasks.length) {
      followUpBlock = `<br>${renderInstructionGuidance(queuedInstruction)}`;
      shouldRunQueuedInstruction = false;
    } else if (!queuedInstruction) {
      followUpBlock =
        `<br>Tell me which columns to translate and the target language.<br><br>` +
        `Examples:<ul>${renderInstructionExamples()}</ul>`;
    }

    const bubble = addAiMessage(
      detectionBlock +
      renderExpandableColumns(cCols.length ? cCols : headers) +
      followUpBlock
    );
    bindColumnToggle(bubble);

    enableInput('Tell me which columns to translate and the target language…');

    if (shouldRunQueuedInstruction) {
      await handleTranslationInstruction(queuedInstruction);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ── Input helpers ──────────────────────────────────────────────────────────
function enableInput(placeholder) {
  chatInput.disabled    = false;
  chatInput.placeholder = placeholder;
  updateSend();
  chatInput.focus();
}

function disableInput(placeholder) {
  chatInput.disabled    = true;
  chatInput.placeholder = placeholder;
  sendBtn.disabled      = true;
}

function renderExpandableColumns(cols) {
  const visibleCols = cols.slice(0, 5);
  const hiddenCols = cols.slice(5);
  const visibleList = visibleCols.map(c => `<li>${escHtml(c)}</li>`).join('');
  const hiddenList = hiddenCols.map(c => `<li>${escHtml(c)}</li>`).join('');
  if (!hiddenCols.length) return `<ul>${visibleList}</ul>`;
  return (
    `<ul>${visibleList}</ul>` +
    `<button class="btn-link column-toggle" type="button" data-expanded="false">` +
      `<span class="more-count">+${hiddenCols.length} more</span> ` +
      `<span class="view-all">Expand to view all</span>` +
    `</button>` +
    `<ul class="extra-columns hidden">${hiddenList}</ul>` +
    `<button class="btn-link column-collapse hidden" type="button">Show Less</button>`
  );
}

function renderInstructionExamples(languageOverride = '') {
  const cols = (state.chineseColumns.length ? state.chineseColumns : state.headers).slice(0, 4);
  const col0 = cols[0] || 'product_name';
  const col1 = cols[1] || 'description';
  const lang = languageOverride || 'Japanese';
  const examples = [
    `Translate <code>${escHtml(col0)}</code> to ${escHtml(lang)}`,
  ];

  if (col1) examples.push(`Translate <code>${escHtml(col1)}</code> to Korean`);
  examples.push(`Translate <code>${escHtml(col0)}</code> to Japanese and Korean`);
  if (col1) {
    examples.push(`Translate <code>${escHtml(col0)}</code> to Japanese and <code>${escHtml(col1)}</code> to Korean`);
  }
  examples.push('Translate everything to German');

  return examples.map(ex => `<li>${ex}</li>`).join('');
}

function renderInstructionGuidance(instruction) {
  const diagnosis = diagnoseRequest(instruction, state.headers);

  if (diagnosis.type === 'missing_language') {
    const named = diagnosis.cols.map(c => `<strong>${escHtml(c)}</strong>`).join(', ');
    return (
      `Which language would you like ${named} translated into?<br><br>` +
      `<ul><li>Japanese</li><li>Korean</li><li>English</li><li>German</li><li>French</li></ul>`
    );
  }

  if (diagnosis.type === 'missing_column') {
    const lang = escHtml(diagnosis.lang);
    return (
      `Which columns would you like translated to <strong>${lang}</strong>?<br><br>` +
      `Examples:<ul>${renderInstructionExamples(lang)}</ul>`
    );
  }

  return (
    `Please tell me which columns to translate and the target language.<br><br>` +
    `Examples:<ul>${renderInstructionExamples()}</ul>`
  );
}

function bindColumnToggle(bubble) {
  const toggle = bubble.querySelector('.column-toggle');
  if (!toggle) return;
  const extra = bubble.querySelector('.extra-columns');
  const collapse = bubble.querySelector('.column-collapse');
  toggle.addEventListener('click', () => {
    toggle.dataset.expanded = 'true';
    toggle.classList.add('hidden');
    extra?.classList.remove('hidden');
    collapse?.classList.remove('hidden');
  });
  collapse?.addEventListener('click', () => {
    toggle.dataset.expanded = 'false';
    extra?.classList.add('hidden');
    collapse.classList.add('hidden');
    toggle.classList.remove('hidden');
  });
}

// ── Instruction parsing ────────────────────────────────────────────────────
// Handles all README-documented patterns:
//   "Translate col to Japanese"
//   "Translate col to Japanese and Korean"           ← same col, multiple langs
//   "Translate col to Japanese, Korean, and French"  ← same col, multiple langs
//   "Translate col1 to Japanese and col2 to Korean"  ← different cols
//   "Translate col1 to Japanese and Korean and col2 to French"  ← mixed
//   "Translate everything to German"
//   "Translate everything into Japanese"
//   "Translate all Chinese content into Japanese"
function parseInstruction(raw, headers, chineseColumns) {
  const defaultCols = chineseColumns.length ? chineseColumns : headers;
  const prep = '(?:to|into)';
  const intent = parseSemanticIntent(raw, headers, defaultCols);
  if (intent.length) return intent;

  // "translate everything / all / Chinese content / detected columns to|into X"
  const allRe = new RegExp(
    `translate\\s+(?:everything|all(?:\\s+(?:chinese\\s+content|detected\\s+columns|columns))?|chinese\\s+content|detected\\s+columns|chinese\\s+columns)\\s+${prep}\\s+([\\w][\\w ]{0,20})`,
    'i'
  );
  const allMatch = allRe.exec(raw);
  if (allMatch) {
    return defaultCols.map(col => ({ column: col, language: normLang(allMatch[1].trim()) }));
  }

  const tasks = [];

  // Split by "translate" keyword — each piece begins a new column assignment
  const segments = raw.split(/\btranslate\b/i).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    // Each segment: "COLUMN to|into REST"
    const toMatch = /\b(?:to|into)\b/i.exec(seg);
    if (!toMatch) continue;

    const colRaw = seg.slice(0, toMatch.index).trim();
    const rest   = seg.slice(toMatch.index + toMatch[0].length).trim();

    const col = resolveColumn(colRaw, headers);
    if (!col) continue;

    let currentCol = col;

    // Split "rest" by "and" — each piece is either a language or "COL to LANG"
    const andParts = rest.split(/\band\b/i).map(s => s.trim()).filter(Boolean);

    for (const part of andParts) {
      // Detect "COL to|into LANG" — a new column assignment within the same sentence
      const colToRe = /^([\w_][\w_ ]{0,40}?)\s+(?:to|into)\s+([\w][\w ]{0,20})$/i.exec(part);
      if (colToRe) {
        const newCol = resolveColumn(colToRe[1].trim(), headers);
        if (newCol) {
          currentCol = newCol;
          pushTask(tasks, currentCol, normLang(colToRe[2].trim()));
          continue;
        }
      }

      // Otherwise: one or more languages (comma-separated) for currentCol
      const langTokens = part.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
      for (const tok of langTokens) {
        if (tok) pushTask(tasks, currentCol, normLang(tok));
      }
    }
  }

  if (tasks.length) return tasks;

  if (hasScopedColumnIntent(raw)) return [];

  // Fallback: bare "to|into LANG" → default columns
  const simple = /\b(?:to|into)\s+([\w]+(?:\s[\w]+)?)\b/i.exec(raw);
  if (simple) {
    return defaultCols.map(col => ({ column: col, language: normLang(simple[1].trim()) }));
  }

  return [];
}

function parseSemanticIntent(raw, headers, defaultCols) {
  const text = raw.toLowerCase().trim();
  if (!/\btranslate\b/.test(text)) return [];

  const lang = extractTargetLanguage(raw);
  if (!lang) return [];

  const scopeText = extractScopeText(raw);
  const cols = resolveSemanticScope(scopeText, headers, defaultCols);
  if (!cols.length) return [];

  return cols.map(col => ({ column: col, language: lang }));
}

function extractTargetLanguage(raw) {
  const match = /\b(?:to|into)\s+(.+?)\s*$/i.exec(raw);
  if (!match) return null;
  let lang = match[1]
    .replace(/[.!?]+$/g, '')
    .replace(/\b(?:please|thanks|thank you)\b/gi, '')
    .trim();
  if (!lang) return null;
  return normLang(lang);
}

function extractScopeText(raw) {
  const withoutTranslate = raw.replace(/^\s*translate\b/i, '').trim();
  const match = /\b(?:to|into)\b/i.exec(withoutTranslate);
  return (match ? withoutTranslate.slice(0, match.index) : withoutTranslate)
    .replace(/\b(?:please|the|these|those)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveSemanticScope(scopeText, headers, defaultCols) {
  const scope = scopeText.toLowerCase();
  if (!scope) return [];
  const isChineseScoped = /\b(?:chinese|detected)\b/.test(scope);
  const orderedCols = isChineseScoped ? defaultCols : headers;

  if (/\b(?:everything|all|all columns)\b/.test(scope)) {
    return [...headers];
  }

  const range = /columns?\s+(\d+|[a-z-]+)\s*(?:-|to|through|thru)\s*(\d+|[a-z-]+)/i.exec(scope);
  if (range) {
    const start = parseCount(range[1]);
    const end = parseCount(range[2]);
    if (start && end) {
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.max(start, end);
      return orderedCols.slice(lo - 1, hi);
    }
  }

  const firstLast = /\b(first|last)\s+(\d+|[a-z-]+)\s+(?:chinese\s+|detected\s+)?columns?\b/i.exec(scope);
  if (firstLast) {
    const count = parseCount(firstLast[2]);
    if (count) {
      return firstLast[1].toLowerCase() === 'last'
        ? orderedCols.slice(-count)
        : orderedCols.slice(0, count);
    }
  }

  const singleFirstLast = /\b(first|last)\s+(?:chinese\s+|detected\s+)?column\b/i.exec(scope);
  if (singleFirstLast) {
    return singleFirstLast[1].toLowerCase() === 'last'
      ? orderedCols.slice(-1)
      : orderedCols.slice(0, 1);
  }

  const firstOrdinal = /\bfirst\s+(\d+|[a-z-]+)\b/i.exec(scope);
  if (firstOrdinal) {
    const count = parseCount(firstOrdinal[1]);
    if (count) return orderedCols.slice(0, count);
  }

  const lastOrdinal = /\blast\s+(\d+|[a-z-]+)\b/i.exec(scope);
  if (lastOrdinal) {
    const count = parseCount(lastOrdinal[1]);
    if (count) return orderedCols.slice(-count);
  }

  if (/\b(?:all chinese content|chinese content|detected columns|chinese columns)\b/.test(scope)) {
    return [...defaultCols];
  }

  const explicitCols = headers.filter(h => {
    const low = h.toLowerCase();
    return scope === low || scope.includes(low);
  });
  if (explicitCols.length) return explicitCols;

  const resolved = resolveColumn(scopeText, headers);
  return resolved ? [resolved] : [];
}

function hasScopedColumnIntent(raw) {
  return /\b(?:first|last|columns?\s+\d+|columns?\s+[a-z-]+\s*(?:-|to|through|thru)|chinese\s+columns?|detected\s+columns?)\b/i.test(raw);
}

function parseCount(raw) {
  const clean = String(raw).toLowerCase().replace(/-/g, ' ').trim();
  if (/^\d+$/.test(clean)) return Number(clean);
  const words = {
    one: 1, first: 1,
    two: 2, second: 2,
    three: 3, third: 3,
    four: 4, fourth: 4,
    five: 5, fifth: 5,
    six: 6, sixth: 6,
    seven: 7, seventh: 7,
    eight: 8, eighth: 8,
    nine: 9, ninth: 9,
    ten: 10, tenth: 10,
  };
  return words[clean] || 0;
}

// Add task only if not already present (deduplication)
function pushTask(tasks, column, language) {
  if (!tasks.find(t => t.column === column && t.language === language)) {
    tasks.push({ column, language });
  }
}

// Fuzzy-match a raw column string against known headers
function resolveColumn(rawCol, headers) {
  const lower = rawCol.toLowerCase().trim();
  return headers.find(c => c.toLowerCase() === lower)
      || headers.find(c => c.toLowerCase().includes(lower))
      || headers.find(c => lower.includes(c.toLowerCase()))
      || null;
}

// Diagnose incomplete requests so we can ask only for what's missing.
// Returns { type: 'missing_language', cols } | { type: 'missing_column', lang } | { type: 'unclear' }
function diagnoseRequest(raw, headers) {
  const rawLow = raw.toLowerCase().trim();

  // Find column names mentioned in the raw text
  const mentionedCols = headers.filter(h =>
    rawLow === h.toLowerCase() ||
    rawLow.includes(h.toLowerCase())
  );

  // Find any known language mentioned
  const mentionedLang = detectLanguageInText(rawLow);

  if (mentionedCols.length && !mentionedLang) {
    return { type: 'missing_language', cols: mentionedCols };
  }
  if (mentionedLang && !mentionedCols.length) {
    return { type: 'missing_column', lang: mentionedLang };
  }
  return { type: 'unclear' };
}

function detectLanguageInText(text) {
  // Check full language names first, then abbreviations
  const fullNames = [...new Set(Object.values(LANGS))];
  for (const name of fullNames) {
    if (text.includes(name.toLowerCase())) return name;
  }
  for (const [abbr, name] of Object.entries(LANGS)) {
    if (text === abbr || text.split(/\s+/).includes(abbr)) return name;
  }
  return null;
}

const LANGS = {
  jp: 'Japanese',  ja: 'Japanese',  jpn: 'Japanese',
  en: 'English',   eng: 'English',
  ko: 'Korean',    kr: 'Korean',
  fr: 'French',    de: 'German',    es: 'Spanish',
  pt: 'Portuguese', it: 'Italian',  ru: 'Russian',
  ar: 'Arabic',    hi: 'Hindi',     th: 'Thai',     vi: 'Vietnamese',
  zh: 'Chinese (Simplified)', cn: 'Chinese (Simplified)',
};

function normLang(raw) {
  const k = raw.toLowerCase().replace(/[\s-]/g, '');
  return LANGS[k] || (raw.charAt(0).toUpperCase() + raw.slice(1));
}

// ── OpenAI translation ─────────────────────────────────────────────────────
async function translateBatch(texts, language) {
  if (!texts.some(t => t.trim())) return texts.map(() => '');

  const prompt = [
    `You are a professional translator. Translate the following texts to ${language}.`,
    `Return ONLY a JSON array of translated strings, same order and count as input.`,
    `Empty strings stay empty. Numbers and product codes stay unchanged. No commentary.`,
    ``,
    JSON.stringify(texts),
  ].join('\n');

  if (window.location.protocol === 'file:') {
    throw new Error('Run the local server and open http://localhost:8787 so translation requests can use the API proxy.');
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: state.apiKey,
      prompt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid API key. Open Settings to update it.');
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data    = await res.json();
  const content = data.choices[0].message.content.trim();
  const arr     = /\[[\s\S]*\]/.exec(content);
  if (!arr) throw new Error('Unexpected response from OpenAI — could not parse translations.');
  const result  = JSON.parse(arr[0]);
  return texts.map((orig, i) => result[i] ?? orig); // safety: never lose a value
}

function formatTranslationError(err) {
  if (err?.message === 'Load failed' || err?.name === 'TypeError') {
    return 'Could not reach the local API proxy. Open the app from http://localhost:8787 instead of file://, then try again.';
  }
  return err?.message || 'Unexpected translation error.';
}

const BATCH = 20;

// runTranslation: ADDITIVE — appends new "col (Language)" columns.
// Original columns are untouched. Output has all original + all translated columns.
async function runTranslation(tasks, onProgress) {
  const resultRows = state.rows.map(r => ({ ...r }));
  const newHeaders = [...state.headers];
  const newCols    = [];

  // Insert each translated column right after the source column's last existing translation.
  // For "col → Japanese, Korean": Japanese goes at srcIndex+1, then Korean at srcIndex+2.
  // This keeps all translations of the same source grouped in request order.
  for (const t of tasks) {
    const newCol = `${t.column} (${t.language})`;
    if (!newHeaders.includes(newCol)) {
      let insertAfter = newHeaders.indexOf(t.column);
      // Advance past any translations already registered for this source column
      while (
        insertAfter + 1 < newHeaders.length &&
        newHeaders[insertAfter + 1].startsWith(`${t.column} (`)
      ) { insertAfter++; }
      newHeaders.splice(insertAfter + 1, 0, newCol);
      newCols.push(newCol);
    }
  }

  const totalBatches = tasks.reduce((s, _) => s + Math.ceil(state.rows.length / BATCH), 0);
  let done = 0;

  for (const task of tasks) {
    const newCol = `${task.column} (${task.language})`;
    const texts  = state.rows.map(r => r[task.column] || '');

    for (let i = 0; i < texts.length; i += BATCH) {
      const chunk      = texts.slice(i, i + BATCH);
      const translated = await translateBatch(chunk, task.language);
      translated.forEach((v, j) => { resultRows[i + j][newCol] = v; }); // append to new col
      done++;
      onProgress(done / totalBatches);
    }
  }

  return { rows: resultRows, headers: newHeaders, newCols, tasks };
}

// ── CSV export ─────────────────────────────────────────────────────────────
function toCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.map(esc).join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(',')),
  ].join('\n');
}

// ── Chat UI helpers ────────────────────────────────────────────────────────
function dismissWelcome() { document.getElementById('welcome-state')?.remove(); }

function addUserMessage(text) {
  const { wrap, bubble } = makeMessage('user');
  bubble.textContent = text;
  messagesEl.appendChild(wrap);
  scrollDown();
  persistConversation();
}

function addUserFileMessage(file, text = '') {
  const { wrap, bubble } = makeMessage('user');
  bubble.classList.add('file-bubble');
  bubble.innerHTML = `
    <div class="chat-file-card">
      <div class="chat-file-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18M3 9h18"/>
        </svg>
      </div>
      <div class="chat-file-copy">
        <div class="chat-file-name">${escHtml(file.name)}</div>
        <div class="chat-file-type">Spreadsheet</div>
      </div>
    </div>
    ${text ? `<div class="chat-file-prompt">${escHtml(text)}</div>` : ''}`;
  messagesEl.appendChild(wrap);
  scrollDown();
  persistConversation();
}

function addAiMessage(html) {
  const { wrap, bubble } = makeMessage('ai');
  bubble.innerHTML = html;
  messagesEl.appendChild(wrap);
  scrollDown();
  persistConversation();
  return bubble;
}

function makeMessage(role) {
  const wrap   = document.createElement('div');
  wrap.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}-avatar`;
  avatar.textContent = role === 'user' ? 'U' : 'AI';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  return { wrap, bubble };
}

function addProgressMessage() {
  const { wrap, bubble } = makeMessage('ai');
  wrap.id = 'progress-wrap';
  bubble.innerHTML = `
    <div class="prog-status">Translating…</div>
    <div class="progress-wrap">
      <div class="progress-track"><div class="progress-fill" id="prog-fill"></div></div>
      <div class="progress-label" id="prog-label">0%</div>
    </div>`;
  messagesEl.appendChild(wrap);
  scrollDown();
  return {
    update(pct) {
      const p    = Math.round(pct * 100);
      const fill = document.getElementById('prog-fill');
      const lbl  = document.getElementById('prog-label');
      if (fill) fill.style.width = p + '%';
      if (lbl)  lbl.textContent  = p + '%';
    },
    remove() { document.getElementById('progress-wrap')?.remove(); },
  };
}

function scrollDown() { chatScroll.scrollTop = chatScroll.scrollHeight; }

// ── Result rendering ───────────────────────────────────────────────────────
function renderResult(headers, rows, newCols, tasks, totalRows) {
  const langs    = [...new Set(tasks.map(t => t.language))].join(', ');
  const colCount = newCols.length;
  const bubble   = addAiMessage('');

  // Stat block — matches README format exactly
  const stats = document.createElement('div');
  stats.className = 'result-stats';
  stats.innerHTML =
    `<div class="stat-headline"><span class="stat-check">✓</span> Translation complete</div>` +
    `<div class="stat-grid">` +
      `<div class="stat-item"><span class="stat-key">Languages</span><span class="stat-val">${escHtml(langs)}</span></div>` +
      `<div class="stat-item"><span class="stat-key">Rows translated</span><span class="stat-val">${totalRows}</span></div>` +
      `<div class="stat-item"><span class="stat-key">Columns translated</span><span class="stat-val">${colCount}</span></div>` +
    `</div>`;
  bubble.appendChild(stats);

  // Preview card
  const card    = document.createElement('div');
  card.className = 'preview-card';

  const cardHdr = document.createElement('div');
  cardHdr.className = 'preview-card-header';
  cardHdr.textContent = `Preview — first ${Math.min(5, rows.length)} of ${totalRows} rows`;
  card.appendChild(cardHdr);

  const scroll = document.createElement('div');
  scroll.className = 'preview-scroll';

  const table = document.createElement('table');
  table.className = 'preview-table';

  // thead — original cols (normal) + new translated cols (highlighted)
  const thead = document.createElement('thead');
  const hr    = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    if (newCols.includes(h)) th.className = 'col-new';
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  // tbody — first 5 rows; new translated cells highlighted in green
  const tbody = document.createElement('tbody');
  rows.slice(0, 5).forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h] ?? '';
      td.title       = row[h] ?? '';
      if (newCols.includes(h)) td.className = 'cell-new';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  card.appendChild(scroll);
  bubble.appendChild(card);

  // Action buttons
  const csv       = toCSV(headers, rows);
  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-action';
  copyBtn.innerHTML = copyIcon() + 'Copy CSV';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(csv).then(() => {
      copyBtn.textContent = '✓ Copied';
      copyBtn.classList.add('success');
      setTimeout(() => {
        copyBtn.innerHTML = copyIcon() + 'Copy CSV';
        copyBtn.classList.remove('success');
      }, 2000);
    });
  });

  const dlBtn = document.createElement('button');
  dlBtn.className = 'btn-action';
  dlBtn.innerHTML = dlIcon() + 'Download CSV';
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'translated.csv' }).click();
    URL.revokeObjectURL(url);
  });

  actionRow.appendChild(copyBtn);
  actionRow.appendChild(dlBtn);
  bubble.appendChild(actionRow);
  scrollDown();
  persistConversation();
}

function copyIcon() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
}
function dlIcon() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}

// ── Send handler ───────────────────────────────────────────────────────────
function updateSend() {
  sendBtn.disabled = !pendingFile && (chatInput.disabled || !chatInput.value.trim());
}

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 130) + 'px';
  updateSend();
});

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); }
});
sendBtn.addEventListener('click', send);

async function send() {
  const instruction = chatInput.value.trim();
  if (pendingFile) {
    const file = pendingFile;
    pendingFile = null;
    ensureConversation(file.name);
    sendBtn.disabled = true;
    hideAttachmentCard();
    addUserFileMessage(file, instruction);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatInput.placeholder = 'Reading CSV file…';
    processPendingFile(file, instruction);
    return;
  }

  if (!instruction) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  updateSend();

  addUserMessage(instruction);
  await handleTranslationInstruction(instruction);
}

async function handleTranslationInstruction(instruction) {
  if (!state.rows.length) {
    addAiMessage('Please upload a CSV file first.');
    return;
  }

  if (!state.hasServerKey && !state.apiKey) {
    const bubble = addAiMessage(
      `This deployment is missing its OpenAI API key. ` +
      `<a href="#" id="open-settings-link">Open Settings</a> to add one for local testing.`
    );
    bubble.querySelector('#open-settings-link')?.addEventListener('click', e => {
      e.preventDefault(); openSettings();
    });
    return;
  }

  const tasks = parseInstruction(instruction, state.headers, state.chineseColumns);

  // ── Incomplete request: ask only for what's missing ───────────────────
  if (!tasks.length) {
    addAiMessage(renderInstructionGuidance(instruction));
    return;
  }

  // ── Request is complete — go straight to translation (no confirmation) ─
  chatInput.disabled    = true;
  sendBtn.disabled      = true;

  addAiMessage(renderTaskSummary(tasks));
  const progress = addProgressMessage();

  try {
    const { rows, headers, newCols, tasks: doneTasks } = await runTranslation(
      tasks,
      pct => progress.update(pct)
    );
    progress.remove();
    renderResult(headers, rows, newCols, doneTasks, state.rows.length);
  } catch (err) {
    progress.remove();
    const bubble  = addAiMessage('');
    const alertEl = document.createElement('div');
    alertEl.className = 'inline-alert';
    alertEl.innerHTML = `<strong>Translation failed:</strong> ${escHtml(formatTranslationError(err))}`;
    bubble.appendChild(alertEl);
    persistConversation();
    if (!state.hasServerKey && (err.message.includes('API key') || err.message.includes('Invalid'))) {
      setTimeout(openSettings, 600);
    }
  }

  chatInput.disabled    = false;
  updateSend();
  chatInput.focus();
}

function renderTaskSummary(tasks) {
  const langs = [...new Set(tasks.map(t => t.language))].join(', ');
  const cols = [...new Set(tasks.map(t => t.column))];
  const visible = cols.slice(0, 4).map(c => `<code>${escHtml(c)}</code>`).join(', ');
  const more = cols.length > 4 ? ` and ${cols.length - 4} more` : '';
  return `Got it. Translating ${visible}${more} to <strong>${escHtml(langs)}</strong>…`;
}

// ── Utility ────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
