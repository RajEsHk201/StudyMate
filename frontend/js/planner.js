/**
 * StudyMate AI - AI Study Planner, Exam Countdown & Mock Exam Paper Controller
 */
const PlannerController = {
  currentPlan: null,
  currentMockExam: null,

  init() {
    this.bindEvents();
    this.updateCountdown();
    this.loadSavedPlan();
  },

  bindEvents() {
    // Generate Plan Button
    document.getElementById("generatePlanBtn")?.addEventListener("click", () => this.handleGeneratePlan());

    // Mock Exam Generator
    document.getElementById("generateMockExamBtn")?.addEventListener("click", () => this.handleGenerateMockExam());
    document.getElementById("printMockExamBtn")?.addEventListener("click", () => this.printMockExam());
    document.getElementById("newMockExamBtn")?.addEventListener("click", () => this.resetMockExamView());
  },

  updateCountdown() {
    const user = ProfileManager.currentUser || {};
    const examTarget = user.target_exam || "Final Exams";
    const examDateStr = user.exam_date;

    const titleEl = document.getElementById("plannerExamTitle");
    const countdownValEl = document.getElementById("plannerCountdownVal");
    const subTextEl = document.getElementById("plannerCountdownSub");

    if (titleEl) titleEl.textContent = examTarget;

    if (!examDateStr) {
      if (countdownValEl) countdownValEl.textContent = "No Date Set";
      if (subTextEl) subTextEl.innerHTML = `<button class="btn-link" onclick="ProfileManager.openProfileModal()">Set Exam Date in Profile</button>`;
      return;
    }

    const examDate = new Date(examDateStr + "T00:00:00");
    const now = new Date();
    const diffMs = examDate - now;

    if (diffMs <= 0) {
      if (countdownValEl) countdownValEl.textContent = "Exam Day!";
      if (subTextEl) subTextEl.textContent = "Good luck! You've got this.";
      return;
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

    if (countdownValEl) countdownValEl.textContent = `${days} Days`;
    if (subTextEl) subTextEl.textContent = `${hours} hours remaining until ${examTarget}`;
  },

  async handleGeneratePlan() {
    const user = ProfileManager.currentUser || {};
    const targetInput = document.getElementById("planTargetInput");
    const dateInput = document.getElementById("planDateInput");
    const subjectsInput = document.getElementById("planSubjectsInput");
    const hoursSelect = document.getElementById("planHoursSelect");

    const target = targetInput?.value.trim() || user.target_exam || "Semester Final Exams";
    const date = dateInput?.value || user.exam_date || "";
    const subjects = subjectsInput?.value.trim() || user.major || "All Core Subjects";
    const hours = parseInt(hoursSelect?.value || 3, 10);
    const email = user.email;

    const btn = document.getElementById("generatePlanBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Building Phased Study Roadmap with AI...";
    }

    try {
      const resp = await API.generateStudyPlan(target, date, subjects, hours, email);
      this.currentPlan = resp.plan;
      localStorage.setItem("studymate_saved_plan", JSON.stringify(this.currentPlan));
      this.renderPlan(this.currentPlan);
      window.App?.showToast("🎉 Generated personalized revision roadmap!");
    } catch (e) {
      alert("Failed to generate study plan: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Generate AI Study Plan";
      }
    }
  },

  loadSavedPlan() {
    try {
      const saved = localStorage.getItem("studymate_saved_plan");
      if (saved) {
        this.currentPlan = JSON.parse(saved);
        this.renderPlan(this.currentPlan);
      }
    } catch (e) {}
  },

  renderPlan(plan) {
    if (!plan) return;
    const container = document.getElementById("planPhasesContainer");
    const strategyEl = document.getElementById("planDailyStrategy");
    const tipsContainer = document.getElementById("planTipsList");
    const headlineEl = document.getElementById("planHeadline");

    if (headlineEl) headlineEl.textContent = plan.headline || "Personalized Revision Roadmap";
    if (strategyEl) strategyEl.textContent = plan.daily_focus_strategy || "";

    if (container && plan.phases) {
      container.innerHTML = plan.phases.map(phase => `
        <div class="planner-phase-card">
          <div class="phase-header">
            <span class="phase-badge">${escapeHTML(phase.duration || `Phase ${phase.phase_num}`)}</span>
            <h4>${escapeHTML(phase.title)}</h4>
          </div>
          <p class="phase-focus"><strong>Focus:</strong> ${escapeHTML(phase.focus)}</p>
          
          <div class="milestones-checklist">
            ${(phase.weekly_milestones || []).map((m, idx) => `
              <label class="milestone-item">
                <input type="checkbox" onchange="PlannerController.toggleMilestone(this)">
                <span>${escapeHTML(m)}</span>
              </label>
            `).join("")}
          </div>

          ${phase.active_recall_task ? `
            <div class="phase-recall-box">
              <span>🧪 <strong>Active Recall Task:</strong> ${escapeHTML(phase.active_recall_task)}</span>
            </div>
          ` : ''}
        </div>
      `).join("");
    }

    if (tipsContainer && plan.high_yield_tips) {
      tipsContainer.innerHTML = plan.high_yield_tips.map(tip => `
        <div class="planner-tip-pill">
          <span>💡</span> <span>${escapeHTML(tip)}</span>
        </div>
      `).join("");
    }
  },

  toggleMilestone(checkbox) {
    const parent = checkbox.closest(".milestone-item");
    if (parent) {
      parent.classList.toggle("completed", checkbox.checked);
    }
  },

  /* ----------------- MOCK EXAM PAPER GENERATOR ----------------- */
  async handleGenerateMockExam(contextText = null) {
    const topicInput = document.getElementById("mockExamTopicInput");
    const durationSelect = document.getElementById("mockExamDurationSelect");
    const examTypeSelect = document.getElementById("mockExamTypeSelect");

    const topic = topicInput ? topicInput.value.trim() : "";
    if (!topic) {
      alert("Please enter a subject or topic for the mock exam.");
      return;
    }

    const duration = parseInt(durationSelect?.value || 60, 10);
    const examType = examTypeSelect?.value || "Standard University Exam";
    const userEmail = ProfileManager.currentUser?.email;

    const btn = document.getElementById("generateMockExamBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Setting Examination Paper & Mark Scheme...";
    }

    try {
      const resp = await API.generateMockExam(topic, examType, duration, userEmail, contextText);
      this.currentMockExam = resp;
      
      document.getElementById("mockExamLauncher")?.classList.add("hidden");
      const paperContainer = document.getElementById("mockExamPaperContainer");
      if (paperContainer) {
        paperContainer.classList.remove("hidden");
        const bodyEl = document.getElementById("mockExamPaperBody");
        if (bodyEl && typeof marked !== "undefined") {
          bodyEl.innerHTML = marked.parse(resp.paper_markdown || "");
        } else if (bodyEl) {
          bodyEl.textContent = resp.paper_markdown || "";
        }
      }
      window.App?.showToast("📋 Mock Examination Paper ready!");
    } catch (e) {
      alert("Failed to generate mock exam: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Generate Complete Mock Exam Paper";
      }
    }
  },

  resetMockExamView() {
    document.getElementById("mockExamPaperContainer")?.classList.add("hidden");
    document.getElementById("mockExamLauncher")?.classList.remove("hidden");
  },

  printMockExam() {
    window.print();
  },

  launchMockFromNotes(topic, contextText) {
    window.App?.switchView("planner");
    const topicInput = document.getElementById("mockExamTopicInput");
    if (topicInput) topicInput.value = topic;
    this.handleGenerateMockExam(contextText);
  }
};

window.PlannerController = PlannerController;
