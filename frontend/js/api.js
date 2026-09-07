/**
 * StudyMate AI - Centralized API Service
 */
const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = options.body instanceof FormData 
      ? {} 
      : { "Content-Type": "application/json" };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    const response = await fetch(endpoint, config);
    if (!response.ok) {
      let errDetail = "";
      try {
        const errJson = await response.json();
        errDetail = errJson.error || errJson.details || "";
      } catch (e) {}
      throw new Error(errDetail || `Request failed with status ${response.status}`);
    }
    return await response.json();
  },

  // Chat & Conversation
  sendMessage(topic, mode, sessionId, userEmail) {
    return this.request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ topic, mode, session_id: sessionId, user_email: userEmail })
    });
  },

  getSessions(userEmail) {
    const q = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : "";
    return this.request(`/api/sessions${q}`);
  },

  createSession(title, sessionType, userEmail) {
    return this.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title, session_type: sessionType, user_email: userEmail })
    });
  },

  getSessionMessages(sessionId) {
    return this.request(`/api/sessions/${sessionId}/messages`);
  },

  deleteSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  },

  // Document & Image Study Analysis
  analyzeImage(formData) {
    return this.request("/api/study/analyze-image", {
      method: "POST",
      body: formData
    });
  },

  analyzeDocument(formData) {
    return this.request("/api/study/analyze-doc", {
      method: "POST",
      body: formData
    });
  },

  // Quiz Engine
  generateQuiz(topic, numQuestions, difficulty, userEmail, documentContext) {
    return this.request("/api/quiz/generate", {
      method: "POST",
      body: JSON.stringify({
        topic,
        num_questions: numQuestions,
        difficulty,
        user_email: userEmail,
        document_context: documentContext
      })
    });
  },

  submitQuiz(data) {
    return this.request("/api/quiz/submit", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  getQuizHistory(userEmail) {
    return this.request(`/api/quiz/history?user_email=${encodeURIComponent(userEmail)}`);
  },

  // Flashcards & Spaced Repetition (SRS)
  generateFlashcards(topic, numCards, userEmail, context) {
    return this.request("/api/flashcards/generate", {
      method: "POST",
      body: JSON.stringify({
        topic,
        num_cards: numCards,
        user_email: userEmail,
        context
      })
    });
  },

  getDecks(userEmail) {
    return this.request(`/api/flashcards/decks?user_email=${encodeURIComponent(userEmail)}`);
  },

  getDeckCards(deckId) {
    return this.request(`/api/flashcards/decks/${deckId}`);
  },

  reviewCard(cardId, quality) {
    return this.request("/api/flashcards/review", {
      method: "POST",
      body: JSON.stringify({ card_id: cardId, quality })
    });
  },

  // Profile & Mistake Vault
  getProfile(email) {
    return this.request(`/api/profile?email=${encodeURIComponent(email)}`);
  },

  updateProfile(profileData) {
    return this.request("/api/profile", {
      method: "POST",
      body: JSON.stringify(profileData)
    });
  },

  getMistakeVault(email, status = "all") {
    return this.request(`/api/memory/vault?email=${encodeURIComponent(email)}&status=${status}`);
  },

  resolveMistake(mistakeId) {
    return this.request("/api/memory/resolve-mistake", {
      method: "POST",
      body: JSON.stringify({ mistake_id: mistakeId })
    });
  },

  // Analytics & Focus Logging
  logFocus(userEmail, subject, durationMinutes) {
    return this.request("/api/analytics/focus-log", {
      method: "POST",
      body: JSON.stringify({
        user_email: userEmail,
        subject,
        duration_minutes: durationMinutes
      })
    });
  },

  getStats(userEmail) {
    return this.request(`/api/analytics/stats?user_email=${encodeURIComponent(userEmail)}`);
  }
};
