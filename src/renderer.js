// File: src/renderer.js
console.log("Renderer loaded");

const convList   = document.getElementById("conversations");
const inputEl    = document.getElementById("new-task");
const sendBtn    = document.getElementById("send-btn");
const resultPane = document.getElementById("result-output");

let activeWs = null;

async function runChat() {
  const task = inputEl.value.trim();
  if (!task) return;

  // 1) Build conversation item with spinner + logs + feedback
  const li = document.createElement("li");
  li.classList.add("conversation-item");
  const ts = Date.now();
  li.innerHTML = `
    <div class="prompt-text">${task}</div>
    <div class="spinner" id="spinner-${ts}">⏳</div>
    <details open>
      <summary>Show logs</summary>
      <div class="logs-container" id="logs-${ts}"></div>
    </details>
    <div class="feedback-container">
      <input
        type="text"
        id="feedback-${ts}"
        class="feedback-input"
        placeholder="Type here and press Enter…"
      />
    </div>`;
  convList.appendChild(li);

  const spinnerEl  = document.getElementById(`spinner-${ts}`);
  const logsEl     = document.getElementById(`logs-${ts}`);
  const feedbackEl = document.getElementById(`feedback-${ts}`);
  resultPane.textContent = "";

  // 2) Close any existing WS
  if (activeWs && activeWs.readyState < 2) activeWs.close();

  // 3) Open new WebSocket
  const ws = new WebSocket("ws://127.0.0.1:8000/ws/chat");
  activeWs = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ task }));
    logsEl.innerHTML += `<div class="log-entry">🔗 Connected & task sent.</div>`;
  };
  ws.onerror = err => {
    logsEl.innerHTML += `<div class="error">WS error: ${err}</div>`;
    spinnerEl.textContent = "❌";
  };
  ws.onclose = () => {
    logsEl.innerHTML += `<div class="log-entry">🔒 Connection closed.</div>`;
  };

  // 4) Handle incoming messages
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);

    // On first log or prompt/result, hide spinner
    if (spinnerEl) { spinnerEl.style.display = "none"; }

    if (msg.type === "log") {
      logsEl.innerHTML += `<div class="log-entry">${msg.data}</div>`;
    }
    else if (msg.type === "prompt") {
      // Bold prompt is already HTML bolded
      logsEl.innerHTML += `<div class="prompt-entry">${msg.prompt}</div>`;
      feedbackEl.focus();
    }
    else if (msg.type === "result") {
      resultPane.innerHTML += `<div class="result-entry">${msg.data}</div>`;
    }
  };

  // 5) Feedback input always visible
  feedbackEl.addEventListener("keypress", e => {
    if (e.key === "Enter" && feedbackEl.value.trim()) {
      const content = feedbackEl.value.trim();
      ws.send(JSON.stringify({ content }));
      logsEl.innerHTML += `<div class="user-response">You: ${content}</div>`;
      feedbackEl.value = "";
    }
  });

  inputEl.value = "";
}

inputEl.addEventListener("keypress", e => { if (e.key === "Enter") runChat(); });
sendBtn.addEventListener("click", runChat);
