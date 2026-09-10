/**
 * StudyMate AI - Chat View & Conversation Controller
 * Clean, polished markdown rendering inspired by ChatGPT / Claude output formatting
 */
const ChatController = {
  activeSessionId: null,
  selectedAttachment: null,

  init() {
    this.initMarked();
    this.bindEvents();
  },

  /** Configure marked.js for clean, safe rendering */
  initMarked() {
    if (typeof marked !== "undefined") {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
      });

      // Custom renderer for polished output
      const renderer = new marked.Renderer();

      // Wrap tables in scrollable container
      renderer.table = function (header, body) {
        return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
      };

      // Code blocks with copy button and language label
      renderer.code = function (code, lang) {
        const language = (lang || "").toLowerCase().trim();
        const langLabel = language ? `<span class="code-lang-label">${language}</span>` : "";
        const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<div class="code-block-wrap">
          <div class="code-block-header">${langLabel}<button class="code-copy-btn" onclick="ChatController.copyCode(this)">📋 Copy</button></div>
          <pre><code class="language-${language}">${escapedCode}</code></pre>
        </div>`;
      };

      // Inline code
      renderer.codespan = function (code) {
        return `<code class="inline-code">${code}</code>`;
      };

      // Clean blockquotes
      renderer.blockquote = function (quote) {
        return `<blockquote class="ai-blockquote">${quote}</blockquote>`;
      };

      // Clean list items
      renderer.listitem = function (text) {
        return `<li>${text}</li>`;
      };

      marked.use({ renderer });
    }
  },

  bindEvents() {
    const form = document.getElementById("chatComposerForm");
    const textarea = document.getElementById("chatInput");

    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Auto-grow textarea
    textarea?.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
    });

    // File attachments
    document.getElementById("attachFileTrigger")?.addEventListener("click", () => {
      document.getElementById("universalFileInput")?.click();
    });

    document.getElementById("universalFileInput")?.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleAttachmentSelected(e.target.files[0]);
      }
    });

    document.getElementById("removeAttachmentBtn")?.addEventListener("click", () => {
      this.clearAttachment();
    });

    // Quick prompts
    document.querySelectorAll(".quick-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const text = pill.getAttribute("data-prompt") || pill.textContent;
        const input = document.getElementById("chatInput");
        if (input) {
          input.value = text;
          input.focus();
        }
      });
    });
  },

  handleAttachmentSelected(file) {
    const validExts = ["png", "jpg", "jpeg", "webp", "pdf", "docx", "txt", "pptx"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!validExts.includes(ext)) {
      alert("Supported formats: Images (PNG, JPG, WebP) and Documents (PDF, DOCX, TXT, PPTX)");
      return;
    }

    this.selectedAttachment = file;
    const bar = document.getElementById("attachmentBar");
    const nameEl = document.getElementById("attachmentName");
    if (bar && nameEl) {
      nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      bar.classList.add("show");
    }
  },

  clearAttachment() {
    this.selectedAttachment = null;
    const bar = document.getElementById("attachmentBar");
    const input = document.getElementById("universalFileInput");
    if (bar) bar.classList.remove("show");
    if (input) input.value = "";
  },

  async handleSubmit(overrideText = null, overrideDisplay = null) {
    const input = document.getElementById("chatInput");
    const rawInputText = input ? input.value.trim() : "";
    const text = overrideText || rawInputText;
    const hasAttachment = Boolean(this.selectedAttachment);

    if (!text && !hasAttachment) return;

    const mode = document.getElementById("modeSelect")?.value || "notes";
    const userEmail = ProfileManager.currentUser?.email;

    // Clear input if submitted via textarea
    if (input && !overrideText) {
      input.value = "";
      input.style.height = "auto";
    }

    // Hide welcome hero if visible
    document.getElementById("welcomeHero")?.classList.add("hidden");

    // Render user message
    const userDisplayText = overrideDisplay || (hasAttachment
      ? `📎 ${this.selectedAttachment.name}\n\n${rawInputText}`
      : rawInputText || text);
    this.appendMessage("user", userDisplayText);

    // Render loading indicator
    const thinkingId = "thinking-" + Date.now();
    this.appendThinking(thinkingId);

    const sendBtn = document.getElementById("sendChatBtn");
    if (sendBtn) sendBtn.disabled = true;

    try {
      let responseData;

      if (hasAttachment) {
        const formData = new FormData();
        formData.append("file", this.selectedAttachment);
        formData.append("prompt", text || "Analyze this study material and explain key concepts.");
        formData.append("mode", mode);
        formData.append("user_email", userEmail || "");

        const isImage = this.selectedAttachment.type.startsWith("image/");
        responseData = isImage
          ? await API.analyzeImage(formData)
          : await API.analyzeDocument(formData);

        this.clearAttachment();
      } else {
        responseData = await API.sendMessage(text, mode, this.activeSessionId, userEmail);
        if (responseData.session_id) {
          this.activeSessionId = responseData.session_id;
        }
      }

      this.removeThinking(thinkingId);
      this.appendMessage("ai", responseData.result || "No content generated.");

      // Refresh session sidebar if newly created
      window.App?.loadSessions();
    } catch (err) {
      console.error(err);
      this.removeThinking(thinkingId);
      this.appendMessage("ai", `⚠️ **Error reaching StudyMate:** ${err.message}. Please check your connection or server logs.`);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      this.scrollToBottom();
    }
  },

  appendMessage(role, content) {
    const container = document.getElementById("chatMessagesList");
    if (!container) return;

    const row = document.createElement("div");
    row.className = `msg-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = role === "ai" ? "✦" : (ProfileManager.currentUser?.name?.charAt(0).toUpperCase() || "U");

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";

    if (role === "user") {
      bubble.textContent = content;
    } else {
      // Use marked.js for proper markdown rendering
      const cleanContent = this.cleanThinkingTags(content);
      bubble.innerHTML = `<div class="ai-content">${this.renderMarkdown(cleanContent)}</div>`;

      // Action toolbar for AI messages
      const actions = document.createElement("div");
      actions.className = "msg-actions";
      actions.innerHTML = `
        <button class="msg-action-btn" onclick="ChatController.copyBubbleText(this)" title="Copy to clipboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        </button>
        <button class="msg-action-btn" onclick="ChatController.quizFromNotes(this)" title="Generate a quiz from this content">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Quiz
        </button>
        <button class="msg-action-btn" onclick="ChatController.flashcardsFromNotes(this)" title="Generate active-recall flashcards">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8"/></svg>
          Flashcards
        </button>
      `;
      bubble.appendChild(actions);
    }

    if (role === "ai") {
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.appendChild(bubble);
      row.appendChild(avatar);
    }

    container.appendChild(row);
    this.scrollToBottom();
  },

  /** Strip any remaining <think> tags or thinking prefixes from AI output */
  cleanThinkingTags(text) {
    if (!text) return "";
    let cleaned = text;
    // Remove closed thinking blocks: <think>, <reasoning>, <internal>, <scratchpad>
    cleaned = cleaned.replace(/<(?:think|reasoning|internal|scratchpad)[^>]*>[\s\S]*?<\/(?:think|reasoning|internal|scratchpad)>/gi, "");
    // Remove unclosed <think> tags
    cleaned = cleaned.replace(/<think(?:\s[^>]*)?>[\s\S]*$/gi, "");
    // Remove "Thinking:" or "Thought process:" prefixes
    cleaned = cleaned.replace(/^[\s]*(?:thought process|thinking|internal reasoning|let me think|here'?s my (?:thought|reasoning|analysis)|my reasoning|chain of thought)[\s]*:?[\s]*/i, "");
    // Remove leading meta-commentary like "Here is the response:"
    cleaned = cleaned.replace(/^(?:here (?:is|are) (?:the|your|my)|sure[,!.]* (?:here|let me)|of course[,!.]* (?:here|let me))[^\n]*?(?::\s*\n|\n)/i, "");
    // Remove leading blank lines
    cleaned = cleaned.replace(/^\s*\n+/, "");
    return cleaned.trim();
  },

  /** Render markdown using marked.js with fallback */
  renderMarkdown(raw) {
    if (typeof marked !== "undefined") {
      try {
        return marked.parse(raw);
      } catch (e) {
        console.warn("Marked.js parse error, falling back:", e);
      }
    }
    // Fallback: basic HTML escaping
    return this.fallbackMarkdown(raw);
  },

  /** Simple fallback markdown when marked.js is unavailable */
  fallbackMarkdown(raw) {
    let html = escapeHTML(raw);
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/gi, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p><(h[1-3]|pre|ul)>/g, '<$1>');
    html = html.replace(/<\/(h[1-3]|pre|ul)><\/p>/g, '</$1>');
    return html;
  },

  appendThinking(id) {
    const container = document.getElementById("chatMessagesList");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "msg-row ai";
    row.id = id;
    row.innerHTML = `
      <div class="msg-avatar">✦</div>
      <div class="msg-bubble">
        <div class="thinking-indicator">
          <div class="thinking-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="thinking-label">Thinking...</span>
        </div>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
  },

  removeThinking(id) {
    document.getElementById(id)?.remove();
  },

  scrollToBottom() {
    const scrollArea = document.getElementById("chatScrollArea");
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
  },

  copyBubbleText(btn) {
    const bubble = btn.closest(".msg-bubble");
    if (!bubble) return;
    // Get only the AI content text, not the action buttons
    const aiContent = bubble.querySelector(".ai-content");
    const text = (aiContent || bubble).innerText.trim();
    navigator.clipboard.writeText(text).then(() => {
      const origHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.classList.remove("copied");
      }, 1600);
    });
  },

  copyCode(btn) {
    const wrap = btn.closest(".code-block-wrap");
    const code = wrap?.querySelector("code");
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        const orig = btn.textContent;
        btn.textContent = "✅ Copied!";
        setTimeout(() => btn.textContent = orig, 1600);
      });
    }
  },

  quizFromNotes(btn) {
    const bubble = btn.closest(".msg-bubble");
    const aiContent = bubble?.querySelector(".ai-content");
    const text = aiContent ? aiContent.innerText : "";
    window.App?.switchView("quiz");
    QuizController.launchFromContext("Notes Review", text.slice(0, 5000));
  },

  flashcardsFromNotes(btn) {
    const bubble = btn.closest(".msg-bubble");
    const aiContent = bubble?.querySelector(".ai-content");
    const text = aiContent ? aiContent.innerText : "";
    window.App?.switchView("flashcards");
    FlashcardsController.launchFromNotes("Notes Flashcards", text.slice(0, 6000));
  }
};
