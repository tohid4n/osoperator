console.log('Renderer loaded');
const convList   = document.getElementById('conversations');
const input      = document.getElementById('new-task');
const btn        = document.getElementById('send-btn');
const resultPane = document.getElementById('result-output');

async function runChat() {
  const task = input.value.trim();
  if (!task) return;

  // 1) Create conversation item
  const li = document.createElement('li');
  li.classList.add('conversation-item');
  li.innerHTML = `
    <div class="prompt-text">${task}</div>
    <details>
      <summary>Show logs</summary>
      <div class="logs-container" id="logs-${Date.now()}"></div>
    </details>
  `;
  convList.appendChild(li);

  // Grab the newly created logs container
  const logsEl    = li.querySelector('.logs-container');
  const summaryEl = li.querySelector('summary');

  // 2) Clear result pane
  resultPane.textContent = '';

  // 3) Fetch SSE stream
  const url      = `http://127.0.0.1:8000/chat/stream?task=${encodeURIComponent(task)}`;
  const response = await fetch(url);
  const reader   = response.body.getReader();
  const decoder  = new TextDecoder();
  let lastEvent = null;

  // 4) Read loop
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    chunk.split(/\r?\n/).forEach(line => {
      if (line.startsWith('event: ')) {
        lastEvent = line.replace('event: ', '').trim();
      }
      else if (line.startsWith('data: ')) {
        const data = line.replace('data: ', '');
        if (lastEvent === 'log') {
          // append to logs
          logsEl.textContent += data + '\n';
        }
        else if (lastEvent === 'result') {
          // show final result
          resultPane.textContent += data;
        }
      }
    });
  }

  // 5) If logs exist, leave summary clickable—otherwise hide it
  if (!logsEl.textContent.trim()) {
    summaryEl.style.display = 'none';
  }

  input.value = '';
}

// event bindings
input.addEventListener('keypress', e => { if (e.key === 'Enter') runChat(); });
btn.addEventListener('click', runChat);
