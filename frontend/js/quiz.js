/**
 * StudyMate AI - Interactive Active Recall Quiz Controller
 */
const QuizController = {
  currentQuiz: null,
  currentIndex: 0,
  userAnswers: {},
  score: 0,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById("startQuizBtn")?.addEventListener("click", () => this.handleStartQuiz());
    document.getElementById("nextQuestionBtn")?.addEventListener("click", () => this.nextQuestion());
    document.getElementById("restartQuizBtn")?.addEventListener("click", () => this.resetQuiz());
  },

  launchFromContext(topic, contextText) {
    const input = document.getElementById("quizTopicInput");
    if (input) input.value = topic;
    this.handleStartQuiz(contextText);
  },

  async handleStartQuiz(documentContext = null) {
    const topicInput = document.getElementById("quizTopicInput");
    const countSelect = document.getElementById("quizCountSelect");
    const diffSelect = document.getElementById("quizDiffSelect");

    const topic = topicInput ? topicInput.value.trim() : "";
    if (!topic) {
      alert("Please enter a subject or topic for the quiz.");
      return;
    }

    const count = parseInt(countSelect?.value || 5);
    const difficulty = diffSelect?.value || "mixed";
    const userEmail = ProfileManager.currentUser?.email;

    const startBtn = document.getElementById("startQuizBtn");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = "Generating Quiz Questions...";
    }

    try {
      const data = await API.generateQuiz(topic, count, difficulty, userEmail, documentContext);
      if (!data || !data.questions || data.questions.length === 0) {
        throw new Error("Unable to generate valid questions. Try a more specific topic.");
      }

      this.currentQuiz = data;
      this.currentIndex = 0;
      this.userAnswers = {};
      this.score = 0;

      document.getElementById("quizLauncherCard")?.classList.add("hidden");
      document.getElementById("quizScorecard")?.classList.add("hidden");
      document.getElementById("quizActiveContainer")?.classList.remove("hidden");

      this.renderCurrentQuestion();
    } catch (err) {
      alert("Error generating quiz: " + err.message);
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = "Start Active Recall Quiz";
      }
    }
  },

  renderCurrentQuestion() {
    const q = this.currentQuiz.questions[this.currentIndex];
    const total = this.currentQuiz.questions.length;

    // Progress
    const pct = ((this.currentIndex + 1) / total) * 100;
    const progressFill = document.getElementById("quizProgressFill");
    const progressText = document.getElementById("quizProgressText");
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) progressText.textContent = `Question ${this.currentIndex + 1} of ${total}`;

    // Question Details
    const textEl = document.getElementById("quizQuestionText");
    const diffEl = document.getElementById("quizDiffBadge");
    if (textEl) textEl.textContent = q.question;
    if (diffEl) diffEl.textContent = q.difficulty || "Medium";

    // Options
    const stack = document.getElementById("quizOptionsStack");
    if (!stack) return;
    stack.innerHTML = "";

    const letters = ["A", "B", "C", "D"];
    q.options.forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.innerHTML = `
        <span class="option-letter">${letters[idx]}</span>
        <span class="option-text">${escapeHTML(optText)}</span>
      `;
      btn.addEventListener("click", () => this.handleSelectOption(idx, btn));
      stack.appendChild(btn);
    });

    // Reset Explanation & Next Button
    const expBox = document.getElementById("quizExplanationBox");
    if (expBox) expBox.classList.remove("show");

    const nextBtn = document.getElementById("nextQuestionBtn");
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = this.currentIndex === total - 1 ? "Finish & See Score" : "Next Question →";
    }
  },

  handleSelectOption(selectedIdx, btnEl) {
    const q = this.currentQuiz.questions[this.currentIndex];
    const optionsStack = document.getElementById("quizOptionsStack");
    const optionBtns = optionsStack.querySelectorAll(".option-btn");

    // Prevent re-selection
    optionBtns.forEach(b => b.disabled = true);

    const isCorrect = selectedIdx === q.answer_index;
    this.userAnswers[q.id] = selectedIdx;
    if (isCorrect) this.score++;

    // Highlight selected option
    if (isCorrect) {
      btnEl.classList.add("correct");
    } else {
      btnEl.classList.add("incorrect");
      // Also highlight correct answer in green
      if (optionBtns[q.answer_index]) {
        optionBtns[q.answer_index].classList.add("correct");
      }
    }

    // Reveal instant explanation
    const expBox = document.getElementById("quizExplanationBox");
    const expText = document.getElementById("quizExplanationText");
    if (expBox && expText) {
      expText.textContent = q.explanation;
      expBox.classList.add("show");
    }

    // Enable Next Button
    const nextBtn = document.getElementById("nextQuestionBtn");
    if (nextBtn) nextBtn.disabled = false;
  },

  nextQuestion() {
    if (this.currentIndex < this.currentQuiz.questions.length - 1) {
      this.currentIndex++;
      this.renderCurrentQuestion();
    } else {
      this.finishQuiz();
    }
  },

  async finishQuiz() {
    document.getElementById("quizActiveContainer")?.classList.add("hidden");
    const scorecard = document.getElementById("quizScorecard");
    if (scorecard) scorecard.classList.remove("hidden");

    const total = this.currentQuiz.questions.length;
    const pct = Math.round((this.score / total) * 100);

    const scoreCircle = document.getElementById("scoreCircleVal");
    const headline = document.getElementById("scoreHeadline");
    const summaryP = document.getElementById("scoreSummaryP");

    if (scoreCircle) scoreCircle.textContent = `${this.score}/${total}`;

    let feedback = "";
    if (pct >= 85) {
      feedback = "🌟 Outstanding Mastery! You have a solid grasp of these concepts.";
    } else if (pct >= 60) {
      feedback = "👍 Good Progress! Review the missed concepts below to close retention gaps.";
    } else {
      feedback = "💡 Growth Area! StudyMate logged your missed concepts to your Mistake Vault for focused review.";
    }

    if (headline) headline.textContent = `${pct}% Accuracy`;
    if (summaryP) summaryP.textContent = feedback;

    // Submit results to backend for Mistake Vault logging & analytics
    try {
      await API.submitQuiz({
        user_email: ProfileManager.currentUser?.email,
        topic: this.currentQuiz.topic,
        score: this.score,
        total_questions: total,
        answers: this.userAnswers,
        questions: this.currentQuiz.questions
      });
      // Refresh analytics streak & stats
      window.App?.loadStats();
    } catch (e) {
      console.warn("Error submitting quiz results:", e);
    }
  },

  resetQuiz() {
    document.getElementById("quizScorecard")?.classList.add("hidden");
    document.getElementById("quizActiveContainer")?.classList.add("hidden");
    document.getElementById("quizLauncherCard")?.classList.remove("hidden");
  }
};
