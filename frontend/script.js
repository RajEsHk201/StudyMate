/* =========================================================
   StudyMate — front-end logic
   Talks to Flask POST /generate expecting:
     { "topic": "...", "mode": "notes"|"summary"|"questions"|"mcq"|"simple" }
   and returning:
     { "result": "markdown-ish text" }
   Each sent message is one turn; mode can change between turns.
   ========================================================= */

let selectedMode = "notes";
let started = false;

const modeLabels = {
  notes:     "📝 Notes",
  summary:   "📌 Summary",
  questions: "❓ Questions",
  mcq:       "🧪 MCQ Quiz",
  simple:    "🧠 Explain Simply",
};

const shell        = document.getElementById("shell");
const conversation = document.getElementById("conversation");
const modeTrack    = document.getElementById("modeTrack");
const modeThumb    = document.getElementById("modeThumb");
const composerForm = document.getElementById("composerForm");
const topicInput   = document.getElementById("topic");
const sendBtn      = document.getElementById("sendBtn");

/* ---------------- theme ---------------- */

const themeToggle = document.getElementById("themeToggle");
const themeIcon   = document.getElementById("themeIcon");

const MOON = '<path d="M21 12.5A9 9 0 1 1 11.5 3a7 7 0 0 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
const SUN  = '<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  themeIcon.innerHTML = theme === "light" ? SUN : MOON;
  themeToggle.title = theme === "light" ? "Switch to dark" : "Switch to light";
  try{ localStorage.setItem("studymate-theme", theme); } catch (e) {}
}

(function initTheme(){
  let saved = null;
  try{ saved = localStorage.getItem("studymate-theme"); } catch (e) {}
  const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));
})();

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "light" ? "dark" : "light");
});

/* ---------------- mode select (sliding thumb) ---------------- */

function positionThumb(btnEl){
  if (!btnEl) return;
  const trackRect = modeTrack.getBoundingClientRect();
  const btnRect = btnEl.getBoundingClientRect();
  modeThumb.style.left = (btnRect.left - trackRect.left + modeTrack.scrollLeft) + "px";
  modeThumb.style.width = btnRect.width + "px";
}

function selectMode(mode, btnEl){
  selectedMode = mode;
  document.querySelectorAll(".mode-pill").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  positionThumb(btnEl);
}

window.addEventListener("load", () => positionThumb(document.querySelector(".mode-pill.active")));
window.addEventListener("resize", () => positionThumb(document.querySelector(".mode-pill.active")));

/* ---------------- textarea: auto-grow + enter-to-send ---------------- */

topicInput.addEventListener("input", () => {
  topicInput.style.height = "auto";
  topicInput.style.height = Math.min(topicInput.scrollHeight, 160) + "px";
});

topicInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    composerForm.requestSubmit();
  }
});

/* ---------------- submit ---------------- */

composerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = topicInput.value.trim();
  if (!text) return;

  if (!started){
    started = true;
    shell.classList.add("started");
  }

  topicInput.value = "";
  topicInput.style.height = "auto";
  sendToStudyMate(text);
});

/* ---------------- message rendering ---------------- */

function appendMessage(role, html){
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "✦";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = html;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  conversation.appendChild(wrap);
  conversation.scrollTop = conversation.scrollHeight;
  return { wrap, bubble };
}

async function sendToStudyMate(text){
  appendMessage("user", escapeHtml(text));

  const modeUsed = selectedMode;
  const { bubble } = appendMessage("assistant", `<div class="thinking"><span></span><span></span><span></span></div>`);

  sendBtn.disabled = true;

  try{
    const response = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: text, mode: modeUsed }),
    });

    if (!response.ok) throw new Error(`Server responded ${response.status}`);
    const data = await response.json();

    const tag = `<span class="mode-tag">${modeLabels[modeUsed] || modeUsed}</span><br>`;
    bubble.innerHTML = tag + renderMarkdownLite(data.result || "No content received.");

  } catch (error){
    bubble.innerHTML = `<p>Something went wrong reaching StudyMate's server. Check that Flask is running and <code>/generate</code> is returning a response.</p>`;
    console.error(error);
  } finally{
    sendBtn.disabled = false;
    conversation.scrollTop = conversation.scrollHeight;
  }
}

/* ---------------- tiny markdown-ish renderer ---------------- */

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMarkdownLite(raw){
  const escaped = escapeHtml(raw);
  const lines = escaped.split("\n");
  let html = "";
  let inList = null;

  const closeList = () => { if (inList){ html += `</${inList}>`; inList = null; } };

  for (let line of lines){
    const trimmed = line.trim();
    if (!trimmed){ closeList(); continue; }

    const heading = trimmed.match(/^###\s+(.*)/) || trimmed.match(/^##\s+(.*)/) || trimmed.match(/^#\s+(.*)/);
    if (heading){ closeList(); html += `<h3>${inline(heading[1])}</h3>`; continue; }

    const bullet = trimmed.match(/^[-*]\s+(.*)/);
    if (bullet){
      if (inList !== "ul"){ closeList(); html += "<ul>"; inList = "ul"; }
      html += `<li>${inline(bullet[1])}</li>`;
      continue;
    }

    const numbered = trimmed.match(/^\d+\.\s+(.*)/);
    if (numbered){
      if (inList !== "ol"){ closeList(); html += "<ol>"; inList = "ol"; }
      html += `<li>${inline(numbered[1])}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inline(trimmed)}</p>`;
  }
  closeList();
  return html;
}

function inline(text){
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}