import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_ext.teams.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor

from autogen_agentchat.agents import UserProxyAgent
from autogen_agentchat.base import TaskResult
from autogen_agentchat.teams import MagenticOneGroupChat

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # dev only; lock down in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1) Initialize the OpenAI client
client = OpenAIChatCompletionClient(
    model="gpt-4o",
    api_key="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"
)

# 2) Instantiate your Magentic-One agents
surfer      = MultimodalWebSurfer("WebSurfer", model_client=client)
file_surfer = FileSurfer("FileSurfer", model_client=client)
coder       = MagenticOneCoderAgent("Coder", model_client=client)
terminal    = CodeExecutorAgent("ComputerTerminal", code_executor=LocalCommandLineCodeExecutor())

# 3) UserProxyAgent for HIL
user_proxy = UserProxyAgent(
    name="user_proxy",
    description="Asks user for feedback",
    input_func=None  # overridden per-connection
)

# 4) Build the MagenticOneGroupChat team
team = MagenticOneGroupChat(
    participants=[surfer, file_surfer, coder, terminal, user_proxy],
    model_client=client
)

@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await ws.accept()

    # 5) Override user_proxy’s input_func to go over WebSocket
    async def _user_input(prompt: str, cancellation_token=None) -> str:
        # Send a bold prompt event
        await ws.send_json({"type":"prompt", "prompt": f"<b>{prompt}</b>"})
        await ws.send_json({"type":"log",    "data": "🔄 Waiting for user feedback..."})
        data = await ws.receive_json()
        resp = data.get("content","")
        await ws.send_json({"type":"log",    "data": f"✅ User replied: {resp}"})
        return resp

    user_proxy.input_func = _user_input

    try:
        # 6) Get initial task
        init = await ws.receive_json()
        task = init.get("task","")
        await ws.send_json({"type":"log", "data": f"✏️ Starting: {task}"})

        # 7) Stream logs and results
        async for msg in team.run_stream(task=task):
            if isinstance(msg, TaskResult):
                if msg.messages:
                    out = msg.messages[-1].content
                    await ws.send_json({"type":"result","data": out})
            else:
                await ws.send_json({"type":"log","data": str(msg)})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        await ws.send_json({"type":"log", "data": f"❗ Error: {e}"})
        await ws.send_json({"type":"log", "data": tb})
