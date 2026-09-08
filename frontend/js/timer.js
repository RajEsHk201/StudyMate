/**
 * StudyMate AI - Focus Timer & Pomodoro Controller
 * Features: 
 * - Customizable durations (15m, 25m Pomodoro, 50m Deep Work)
 * - Subject tagging (auto-populated or custom)
 * - Web Audio API synthesizer chime (no external audio files needed)
 * - Background countdown with floating mini-bar when modal is closed
 * - Automated SQLite persistence via API.logFocus()
 */
const FocusTimer = {
  durationSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  timerInterval: null,
  isRunning: false,
  currentSubject: "General Study",

  init() {
    this.bindEvents();
    this.updateDisplay();
  },

  bindEvents() {
    const triggerBtn = document.getElementById("focusTimerTriggerBtn");
    const modal = document.getElementById("focusTimerModal");
    const closeBtn = document.getElementById("closeFocusTimerModal");
    const startBtn = document.getElementById("timerStartBtn");
    const resetBtn = document.getElementById("timerResetBtn");
    const subjectInput = document.getElementById("timerSubjectInput");

    // Open Modal
    triggerBtn?.addEventListener("click", () => {
      this.openModal();
    });

    // Close Modal
    closeBtn?.addEventListener("click", () => {
      this.closeModal();
    });

    modal?.addEventListener("click", (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Start / Pause
    startBtn?.addEventListener("click", () => {
      if (this.isRunning) {
        this.pause();
      } else {
        this.start();
      }
    });

    // Reset
    resetBtn?.addEventListener("click", () => {
      this.reset();
    });

    // Subject input change
    subjectInput?.addEventListener("input", (e) => {
      this.currentSubject = e.target.value.trim() || "General Study";
    });

    // Preset pills (15m, 25m, 50m)
    document.querySelectorAll(".timer-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mins = parseInt(btn.getAttribute("data-mins"), 10);
        if (mins) {
          document.querySelectorAll(".timer-preset-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          this.setDuration(mins);
        }
      });
    });

    // Mini floating timer click to reopen modal
    document.getElementById("miniTimerPill")?.addEventListener("click", () => {
      this.openModal();
    });
  },

  openModal() {
    const modal = document.getElementById("focusTimerModal");
    if (modal) {
      modal.classList.add("open");
      modal.style.display = "flex";
    }
  },

  closeModal() {
    const modal = document.getElementById("focusTimerModal");
    if (modal) {
      modal.classList.remove("open");
      modal.style.display = "none";
    }
    // If running, ensure mini floating timer is visible
    this.updateMiniPill();
  },

  setDuration(mins) {
    if (this.isRunning) this.pause();
    this.durationSeconds = mins * 60;
    this.remainingSeconds = this.durationSeconds;
    this.updateDisplay();
    this.updateProgress(0);
  },

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const startBtn = document.getElementById("timerStartBtn");
    if (startBtn) {
      startBtn.innerHTML = `<span>⏸</span> Pause`;
      startBtn.classList.add("btn-paused");
    }

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);

    this.updateMiniPill();
  },

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    const startBtn = document.getElementById("timerStartBtn");
    if (startBtn) {
      startBtn.innerHTML = `<span>▶</span> Resume`;
      startBtn.classList.remove("btn-paused");
    }

    this.updateMiniPill();
  },

  reset() {
    this.pause();
    this.remainingSeconds = this.durationSeconds;
    this.updateDisplay();
    this.updateProgress(0);

    const startBtn = document.getElementById("timerStartBtn");
    if (startBtn) {
      startBtn.innerHTML = `<span>▶</span> Start Focus`;
      startBtn.classList.remove("btn-paused");
    }

    this.updateMiniPill();
  },

  tick() {
    if (this.remainingSeconds > 0) {
      this.remainingSeconds--;
      this.updateDisplay();

      const elapsed = this.durationSeconds - this.remainingSeconds;
      const progressPercent = (elapsed / this.durationSeconds) * 100;
      this.updateProgress(progressPercent);
      this.updateMiniPill();
    } else {
      this.completeSession();
    }
  },

  updateDisplay() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    const displayEl = document.getElementById("timerTimeDisplay");
    if (displayEl) displayEl.textContent = timeStr;

    // Also update document title if running
    if (this.isRunning) {
      document.title = `(${timeStr}) StudyMate Focus`;
    } else {
      document.title = "StudyMate AI - Autonomous Personalized Study Companion";
    }
  },

  updateProgress(percent) {
    const bar = document.getElementById("timerProgressBar");
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  },

  updateMiniPill() {
    const pill = document.getElementById("miniTimerPill");
    const label = document.getElementById("miniTimerVal");
    if (!pill || !label) return;

    if (this.isRunning) {
      pill.style.display = "flex";
      const minutes = Math.floor(this.remainingSeconds / 60);
      const seconds = this.remainingSeconds % 60;
      label.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
      pill.style.display = "none";
    }
  },

  async completeSession() {
    this.pause();
    this.playChime();

    const durationMins = Math.round(this.durationSeconds / 60);
    const subject = this.currentSubject || "General Study";
    const userEmail = ProfileManager.currentUser?.email;

    // Log focus session to SQLite backend
    try {
      await API.logFocus(userEmail, subject, durationMins);
      window.App?.showToast(`🎉 Focus complete! ${durationMins}m on "${subject}" logged.`);
    } catch (e) {
      console.warn("Could not log focus session:", e);
      window.App?.showToast(`🎉 Focus complete! Well done on ${durationMins}m of study.`);
    }

    this.reset();
  },

  /** Web Audio API chime - no audio files required */
  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;

        const startTime = ctx.currentTime + idx * 0.15;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 1.3);
      });
    } catch (e) {
      console.log("Audio notification played (silent fallback)");
    }
  }
};
