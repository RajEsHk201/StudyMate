/**
 * StudyMate AI - Interactive Flashcards & SM-2 Spaced Repetition Controller
 * Features:
 * - 3D CSS flip animations with smooth perspective transitions
 * - SuperMemo SM-2 Recall Ratings (1: Again, 2: Hard, 3: Good, 4: Easy)
 * - Keyboard shortcuts (Space: Flip, 1-4: Rate, H: Hint, Left/Right: Navigate)
 * - AI Deck Generator from topic or note context
 * - Anki CSV Export download
 */
const FlashcardsController = {
  decks: [],
  currentDeck: null,
  cards: [],
  currentIndex: 0,
  isFlipped: false,
  isHintVisible: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Launcher & Generate modal
    document.getElementById("createDeckBtn")?.addEventListener("click", () => this.handleGenerateDeck());
    document.getElementById("startCustomDeckBtn")?.addEventListener("click", () => this.handleGenerateDeck());
    document.getElementById("backToDecksBtn")?.addEventListener("click", () => this.showDeckLibrary());

    // Card interactions
    const cardEl = document.getElementById("flashcard3D");
    cardEl?.addEventListener("click", () => this.flipCard());

    document.getElementById("flipCardBtn")?.addEventListener("click", () => this.flipCard());
    document.getElementById("cardHintBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleHint();
    });

    // SRS Quality Rating Buttons
    document.querySelectorAll(".srs-rate-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const quality = parseInt(btn.getAttribute("data-quality"), 10);
        this.rateCard(quality);
      });
    });

    // Anki Export
    document.getElementById("exportAnkiBtn")?.addEventListener("click", () => {
      if (this.currentDeck) {
        window.open(`/api/flashcards/export/${this.currentDeck.id}`, "_blank");
      }
    });

    // Keyboard navigation
    document.addEventListener("keydown", (e) => {
      // Only handle if in flashcards view and session is active
      const view = document.getElementById("flashcardsView");
      const activeStage = document.getElementById("flashcardActiveStage");
      if (!view?.classList.contains("active-view") || activeStage?.classList.contains("hidden")) return;

      // Ignore if typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        this.flipCard();
      } else if (e.key === "1" || e.key === "a") {
        this.rateCard(0); // Again
      } else if (e.key === "2" || e.key === "h") {
        this.rateCard(3); // Hard
      } else if (e.key === "3" || e.key === "g") {
        this.rateCard(4); // Good
      } else if (e.key === "4" || e.key === "e") {
        this.rateCard(5); // Easy
      } else if (e.key.toLowerCase() === "h") {
        this.toggleHint();
      }
    });
  },

  async loadDecks() {
    const userEmail = ProfileManager.currentUser?.email;
    const grid = document.getElementById("deckLibraryGrid");
    if (!grid) return;

    grid.innerHTML = '<div class="thinking-dots"><span></span><span></span><span></span></div>';

    try {
      const data = await API.getDecks(userEmail);
      this.decks = data.decks || [];

      if (this.decks.length === 0) {
        grid.innerHTML = `
          <div class="empty-deck-notice">
            <div style="font-size:32px; margin-bottom:8px;">🎴</div>
            <strong>No Flashcard Decks Yet</strong>
            <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
              Create your first AI-generated active-recall deck on any subject, or turn your tutor notes into flashcards.
            </p>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.decks.map(deck => `
        <div class="deck-card" onclick="FlashcardsController.openDeck(${deck.id})">
          <div class="deck-card-header">
            <span class="deck-tag">${escapeHTML(deck.topic)}</span>
            ${deck.due_cards > 0 ? `<span class="badge-due">${deck.due_cards} Due</span>` : `<span class="badge-done">✓ Up to Date</span>`}
          </div>
          <h4 class="deck-title">${escapeHTML(deck.title)}</h4>
          <div class="deck-card-footer">
            <span>${deck.total_cards} Cards</span>
            <button class="btn-deck-action" onclick="event.stopPropagation(); FlashcardsController.openDeck(${deck.id})">Study Deck →</button>
          </div>
        </div>
      `).join("");
    } catch (e) {
      grid.innerHTML = `<div style="color:var(--accent-coral); font-size:13px;">Error loading decks: ${e.message}</div>`;
    }
  },

  async openDeck(deckId) {
    this.currentDeck = this.decks.find(d => d.id === deckId) || { id: deckId, title: "Flashcard Deck" };
    const library = document.getElementById("deckLibrarySection");
    const activeStage = document.getElementById("flashcardActiveStage");
    const summaryCard = document.getElementById("deckCompletedCard");

    if (library) library.classList.add("hidden");
    if (summaryCard) summaryCard.classList.add("hidden");
    if (activeStage) activeStage.classList.remove("hidden");

    try {
      const resp = await API.getDeckCards(deckId);
      this.cards = resp.cards || [];
      this.currentIndex = 0;
      this.isFlipped = false;
      this.isHintVisible = false;

      const titleEl = document.getElementById("activeDeckTitle");
      if (titleEl) titleEl.textContent = this.currentDeck.title || `Deck #${deckId}`;

      if (this.cards.length === 0) {
        alert("This deck has no cards.");
        this.showDeckLibrary();
        return;
      }

      this.renderCard();
    } catch (e) {
      alert("Error loading cards: " + e.message);
      this.showDeckLibrary();
    }
  },

  renderCard() {
    const card = this.cards[this.currentIndex];
    const total = this.cards.length;

    this.isFlipped = false;
    this.isHintVisible = false;

    // Card element
    const cardWrap = document.getElementById("flashcard3D");
    if (cardWrap) cardWrap.classList.remove("flipped");

    // Front & Back Text
    const frontEl = document.getElementById("cardFrontText");
    const backEl = document.getElementById("cardBackText");
    const tagEl = document.getElementById("cardTagBadge");
    const hintBox = document.getElementById("cardHintBox");
    const hintText = document.getElementById("cardHintText");

    if (frontEl) frontEl.textContent = card.front;
    if (backEl) backEl.textContent = card.back;
    if (tagEl) tagEl.textContent = card.tag || "Core Concept";

    if (hintBox && hintText) {
      hintText.textContent = card.hint || "No hint provided.";
      hintBox.classList.add("hidden");
    }

    // Progress
    const progressFill = document.getElementById("deckProgressFill");
    const progressText = document.getElementById("deckProgressText");
    const pct = ((this.currentIndex + 1) / total) * 100;
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) progressText.textContent = `Card ${this.currentIndex + 1} of ${total}`;

    // Interval indicator
    const intervalBadge = document.getElementById("cardIntervalBadge");
    if (intervalBadge) {
      intervalBadge.textContent = card.interval_days > 0 ? `SRS Interval: ${card.interval_days}d` : "New Card";
    }
  },

  flipCard() {
    this.isFlipped = !this.isFlipped;
    const cardWrap = document.getElementById("flashcard3D");
    if (cardWrap) {
      cardWrap.classList.toggle("flipped", this.isFlipped);
    }
  },

  toggleHint() {
    this.isHintVisible = !this.isHintVisible;
    const hintBox = document.getElementById("cardHintBox");
    if (hintBox) {
      hintBox.classList.toggle("hidden", !this.isHintVisible);
    }
  },

  async rateCard(quality) {
    const card = this.cards[this.currentIndex];
    if (!card) return;

    // Save SM-2 result
    try {
      await API.reviewCard(card.id, quality);
    } catch (e) {
      console.warn("Error reviewing card:", e);
    }

    // Advance to next card
    if (this.currentIndex < this.cards.length - 1) {
      this.currentIndex++;
      this.renderCard();
    } else {
      this.completeDeckReview();
    }
  },

  completeDeckReview() {
    document.getElementById("flashcardActiveStage")?.classList.add("hidden");
    const summaryCard = document.getElementById("deckCompletedCard");
    if (summaryCard) summaryCard.classList.remove("hidden");

    window.App?.loadStats();
  },

  showDeckLibrary() {
    document.getElementById("flashcardActiveStage")?.classList.add("hidden");
    document.getElementById("deckCompletedCard")?.classList.add("hidden");
    document.getElementById("deckLibrarySection")?.classList.remove("hidden");
    this.loadDecks();
  },

  async handleGenerateDeck(contextText = null) {
    const topicInput = document.getElementById("deckTopicInput");
    const countSelect = document.getElementById("deckCountSelect");

    const topic = topicInput ? topicInput.value.trim() : "";
    if (!topic) {
      alert("Please enter a subject or topic for the flashcard deck.");
      return;
    }

    const count = parseInt(countSelect?.value || 8, 10);
    const userEmail = ProfileManager.currentUser?.email;

    const btn = document.getElementById("createDeckBtn") || document.getElementById("startCustomDeckBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating Flashcards with AI...";
    }

    try {
      const result = await API.generateFlashcards(topic, count, userEmail, contextText);
      if (topicInput) topicInput.value = "";
      window.App?.showToast(`🎉 Generated ${result.cards.length} flashcards for "${topic}"!`);
      this.openDeck(result.deck_id);
    } catch (e) {
      alert("Failed to generate flashcards: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Generate Flashcard Deck";
      }
    }
  },

  launchFromNotes(topic, contextText) {
    window.App?.switchView("flashcards");
    const topicInput = document.getElementById("deckTopicInput");
    if (topicInput) topicInput.value = topic;
    this.handleGenerateDeck(contextText);
  }
};

window.FlashcardsController = FlashcardsController;
