import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.teams.magentic_one import MagenticOne
from autogen_agentchat.base import TaskResult

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow Electron renderer
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client and agent
client = OpenAIChatCompletionClient(
    model="gpt-4o",
    api_key="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"
)
agents = MagenticOne(client=client)

@app.post("/chat")
async def chat(payload: dict):
    task = payload.get("task", "")
    logs, results = [], []
    async for msg in agents.run_stream(task=task):
        if isinstance(msg, TaskResult) and msg.messages:
            results.append(getattr(msg.messages[-1], 'content', ''))
        else:
            logs.append(str(msg))
    return {"logs": logs, "results": results}

@app.get("/chat/stream")
async def chat_stream(request: Request, task: str = ""):
    async def event_generator():
        async for msg in agents.run_stream(task=task):
            if await request.is_disconnected():
                break
            if isinstance(msg, TaskResult) and msg.messages:
                yield {"event": "result", "data": getattr(msg.messages[-1], 'content', '')}
            else:
                yield {"event": "log", "data": str(msg)}
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
