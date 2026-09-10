/**
 * StudyMate AI - Main App Coordinator & View Switcher
 */
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const App = {
  activeView: "chat",
  sessions: [],

  init() {
    this.initTheme();
    this.bindEvents();

    ProfileManager.init();
    ChatController.init();
    QuizController.init();
    FlashcardsController.init();
    PlannerController.init();
    FocusTimer.init();

    this.loadSessions();
    this.loadStats();
  },

  bindEvents() {
    // View Switcher Navigation
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        if (view) this.switchView(view);
      });
    });

    // Theme Toggle
    document.getElementById("themeToggleBtn")?.addEventListener("click", () => this.toggleTheme());

    // New Session
    document.getElementById("newSessionBtn")?.addEventListener("click", () => this.openNewSessionModal());
    document.getElementById("closeSessionModal")?.addEventListener("click", () => this.closeNewSessionModal());
    
    document.querySelectorAll(".session-type-card").forEach(card => {
      card.addEventListener("click", () => {
        const type = card.getAttribute("data-type") || "Free Study";
        this.createNewSession(type);
      });
    });
  },

  /* ----------------- Theme Controller ----------------- */
  initTheme() {
    const savedTheme = localStorage.getItem("studymate_theme") || localStorage.getItem("studymate-theme") || 
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    this.setTheme(savedTheme);
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem("studymate_theme", theme);
    localStorage.setItem("studymate-theme", theme);
    const icon = document.getElementById("themeToggleIcon");
    if (icon) {
      icon.innerHTML = theme === "dark" 
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>'
        : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    this.setTheme(current === "light" ? "dark" : "light");
  },

  /* ----------------- View Navigation ----------------- */
  switchView(viewName) {
    this.activeView = viewName;

    // Update Nav buttons
    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
    });

    // Update Views
    document.querySelectorAll(".view-container").forEach(el => {
      el.classList.remove("active-view");
    });
    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) targetView.classList.add("active-view");

    // Contextual view loading
    const activeTitle = document.getElementById("activeViewTitle");
    if (activeTitle) {
      const titles = {
        chat: "Tutor & Study Notes",
        quiz: "Active Recall Quizzes",
        flashcards: "Spaced Repetition Flashcards",
        planner: "AI Study Planner & Mock Exams"
      };
      activeTitle.textContent = titles[viewName] || "StudyMate AI";
    }

    if (viewName === "flashcards") {
      FlashcardsController.showDeckLibrary();
    } else if (viewName === "planner") {
      PlannerController.updateCountdown();
    }
  },

  /* ----------------- Sessions ----------------- */
  async loadSessions() {
    const userEmail = ProfileManager.currentUser?.email;
    const list = document.getElementById("sessionsList");
    if (!list) return;

    try {
      const resp = await API.getSessions(userEmail);
      this.sessions = resp.sessions || [];

      if (this.sessions.length === 0) {
        list.innerHTML = `<div style="padding: 10px; font-size:12px; color:var(--text-subtle);">No sessions yet.</div>`;
        return;
      }

      list.innerHTML = this.sessions.map(s => `
        <div class="session-item ${ChatController.activeSessionId === s.id ? 'active' : ''}" 
             onclick="App.selectSession(${s.id}, '${escapeHTML(s.title)}')">
          <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHTML(s.title)}</span>
          <button class="session-delete" onclick="event.stopPropagation(); App.deleteSession(${s.id})" title="Delete session">×</button>
        </div>
      `).join("");
    } catch (e) {
      console.warn("Failed to load sessions:", e);
    }
  },

  openNewSessionModal() {
    document.getElementById("newSessionModal")?.classList.add("open");
  },

  closeNewSessionModal() {
    document.getElementById("newSessionModal")?.classList.remove("open");
  },

  async createNewSession(sessionType) {
    const userEmail = ProfileManager.currentUser?.email;
    const title = `${sessionType} - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    try {
      const resp = await API.createSession(title, sessionType, userEmail);
      this.closeNewSessionModal();
      this.selectSession(resp.session.id, resp.session.title);
      this.loadSessions();
      this.showToast(`Started new ${sessionType} session!`);
    } catch (e) {
      alert("Failed to create session: " + e.message);
    }
  },

  async selectSession(sessionId, title) {
    ChatController.activeSessionId = sessionId;
    this.switchView("chat");

    const messagesList = document.getElementById("chatMessagesList");
    const welcome = document.getElementById("welcomeHero");
    if (messagesList) messagesList.innerHTML = "";

    try {
      const resp = await API.getSessionMessages(sessionId);
      const messages = resp.messages || [];

      if (messages.length === 0) {
        if (welcome) welcome.classList.remove("hidden");
      } else {
        if (welcome) welcome.classList.add("hidden");
        messages.forEach(m => {
          ChatController.appendMessage(m.role, m.content);
        });
      }

      // Update active highlight in sidebar
      document.querySelectorAll(".session-item").forEach(el => el.classList.remove("active"));
      this.loadSessions();
    } catch (e) {
      console.warn("Error loading messages:", e);
    }
  },

  async deleteSession(sessionId) {
    if (!confirm("Delete this study session?")) return;
    try {
      await API.deleteSession(sessionId);
      if (ChatController.activeSessionId === sessionId) {
        ChatController.activeSessionId = null;
        document.getElementById("chatMessagesList").innerHTML = "";
        document.getElementById("welcomeHero")?.classList.remove("hidden");
      }
      this.loadSessions();
    } catch (e) {
      alert("Error: " + e.message);
    }
  },

  async loadStats() {
    const userEmail = ProfileManager.currentUser?.email;
    try {
      const stats = await API.getStats(userEmail);
      const streakEl = document.getElementById("studyStreakVal");
      const focusEl = document.getElementById("todayFocusMinsVal");

      if (streakEl && stats.study_streak !== undefined) {
        streakEl.textContent = `${stats.study_streak} Day${stats.study_streak === 1 ? '' : 's'} Streak`;
      }
      if (focusEl && stats.today_focus_mins !== undefined) {
        focusEl.textContent = `${stats.today_focus_mins}m`;
      }
    } catch (e) {
      console.warn("Could not load study stats:", e);
    }
  },

  showToast(message) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--text-main);
        color: var(--bg-surface);
        padding: 10px 18px;
        border-radius: var(--radius-full);
        font-size: 13px;
        font-weight: 700;
        box-shadow: var(--shadow-lg);
        z-index: 2000;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2500);
  }
};

window.App = App;
window.ProfileManager = ProfileManager;
window.ChatController = ChatController;
window.QuizController = QuizController;
window.FlashcardsController = FlashcardsController;
window.PlannerController = PlannerController;
window.FocusTimer = FocusTimer;

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
