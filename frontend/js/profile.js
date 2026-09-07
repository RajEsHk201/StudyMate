/**
 * StudyMate AI - Personalization & Profile Module
 */
const ProfileManager = {
  currentUser: null,

  init() {
    this.bindEvents();
    this.loadUserFromStorage();
  },

  bindEvents() {
    document.getElementById("profileModalBtn")?.addEventListener("click", () => this.openProfileModal());
    document.getElementById("closeProfileModal")?.addEventListener("click", () => this.closeProfileModal());
    document.getElementById("profileForm")?.addEventListener("submit", (e) => this.handleSaveProfile(e));
    
    document.getElementById("vaultTriggerBtn")?.addEventListener("click", () => this.openVaultDrawer());
    document.getElementById("closeVaultBtn")?.addEventListener("click", () => this.closeVaultDrawer());
  },

  loadUserFromStorage() {
    try {
      const stored = localStorage.getItem("studymate_user");
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.updateUI(this.currentUser);
        this.syncWithServer(this.currentUser.email);
      } else {
        // Default guest user
        this.currentUser = {
          name: "Student",
          email: "student@studymate.ai",
          education_level: "Undergraduate",
          major: "Computer Science",
          target_exam: "Final Exams",
          exam_date: "2026-11-15",
          learning_style: "Intuitive & Visual",
          tutor_mode: "Explanatory Tutor"
        };
        this.updateUI(this.currentUser);
      }
    } catch (e) {
      console.error("Failed to load user profile:", e);
    }
  },

  async syncWithServer(email) {
    try {
      const data = await API.getProfile(email);
      if (data && data.profile) {
        this.currentUser = data.profile;
        localStorage.setItem("studymate_user", JSON.stringify(this.currentUser));
        this.updateUI(this.currentUser);
      }
    } catch (e) {
      console.warn("Server profile sync:", e);
    }
  },

  updateUI(user) {
    document.querySelectorAll(".user-name-display").forEach(el => el.textContent = user.name || "Student");
    document.querySelectorAll(".user-role-display").forEach(el => {
      el.textContent = `${user.education_level || "Undergrad"} • ${user.major || "General"}`;
    });
    document.querySelectorAll(".user-avatar-display").forEach(el => {
      el.textContent = (user.name || "S").charAt(0).toUpperCase();
    });

    // Populate form fields
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    setVal("profileNameInput", user.name);
    setVal("profileEmailInput", user.email);
    setVal("profileLevelSelect", user.education_level);
    setVal("profileMajorInput", user.major);
    setVal("profileExamInput", user.target_exam);
    setVal("profileDateInput", user.exam_date);
    setVal("profileStyleSelect", user.learning_style);
    setVal("profilePersonaSelect", user.tutor_mode);
  },

  openProfileModal() {
    this.updateUI(this.currentUser);
    document.getElementById("profileModal")?.classList.add("open");
  },

  closeProfileModal() {
    document.getElementById("profileModal")?.classList.remove("open");
  },

  async handleSaveProfile(e) {
    e.preventDefault();
    const updated = {
      email: document.getElementById("profileEmailInput")?.value.trim() || this.currentUser.email,
      name: document.getElementById("profileNameInput")?.value.trim() || "Student",
      education_level: document.getElementById("profileLevelSelect")?.value,
      major: document.getElementById("profileMajorInput")?.value.trim() || "General",
      target_exam: document.getElementById("profileExamInput")?.value.trim() || "",
      exam_date: document.getElementById("profileDateInput")?.value || "",
      learning_style: document.getElementById("profileStyleSelect")?.value,
      tutor_mode: document.getElementById("profilePersonaSelect")?.value
    };

    try {
      const resp = await API.updateProfile(updated);
      this.currentUser = resp.profile || updated;
      localStorage.setItem("studymate_user", JSON.stringify(this.currentUser));
      this.updateUI(this.currentUser);
      this.closeProfileModal();
      window.App?.showToast("Personal tutor profile updated!");
    } catch (err) {
      alert("Error saving profile: " + err.message);
    }
  },

  async openVaultDrawer() {
    const drawer = document.getElementById("vaultDrawer");
    if (!drawer) return;
    drawer.classList.add("open");

    const list = document.getElementById("vaultList");
    if (!list) return;
    list.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';

    try {
      const resp = await API.getMistakeVault(this.currentUser.email);
      const items = resp.vault || [];
      if (items.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding: 40px 10px; color: var(--text-muted); font-size:13.5px;">
            🎉 <strong>Clean Slate!</strong><br>
            No missed concepts in your vault right now. Complete active-recall quizzes to track topics needing revision!
          </div>
        `;
        return;
      }

      list.innerHTML = items.map(item => `
        <div class="vault-item-card" id="vault-item-${item.id}">
          <span class="vault-item-tag">${escapeHTML(item.topic)}</span>
          <div class="vault-item-q">${escapeHTML(item.question)}</div>
          <div class="vault-item-exp">${escapeHTML(item.explanation)}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <span style="font-size:11px; color:var(--text-subtle);">Status: ${item.status === 'mastered' ? '✅ Mastered' : '⚠️ Needs Review'}</span>
            ${item.status !== 'mastered' ? `
              <button class="vault-item-btn" onclick="ProfileManager.markMastered(${item.id})">Mark Mastered</button>
            ` : ''}
          </div>
        </div>
      `).join("");
    } catch (err) {
      list.innerHTML = `<div style="color:var(--accent-coral); font-size:13px;">Failed to load vault: ${err.message}</div>`;
    }
  },

  closeVaultDrawer() {
    document.getElementById("vaultDrawer")?.classList.remove("open");
  },

  async markMastered(mistakeId) {
    try {
      await API.resolveMistake(mistakeId);
      const card = document.getElementById(`vault-item-${mistakeId}`);
      if (card) {
        card.style.opacity = "0.5";
        card.querySelector(".vault-item-btn")?.remove();
      }
      window.App?.showToast("Concept marked as mastered!");
    } catch (e) {
      alert("Error: " + e.message);
    }
  }
};
