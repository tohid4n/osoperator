const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  runTask: async (task) => {
    const response = await fetch('http://127.0.0.1:8000/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task })
    });
    return response.body; // ReadableStream
  }
});