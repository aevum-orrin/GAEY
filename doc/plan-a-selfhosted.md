# Plan A — 保底方案实施计划:Self-hosted Voice (Whisper + Ollama + Kokoro)

> **这是 GAEY "完全本地、零按量成本" 路线的可执行实施计划。**
> 高层可行性分析见 `doc/cost-and-self-hosting.md` Part 2;部署取舍见
> `doc/plan-b-gemini.md` 的对比表。本文是**一步步把它做出来**的施工图。
>
> **语言约定 / Language:** 这份 plan 文档**中英混杂**(方便头脑风暴)。但
> **项目里真正写进仓库的代码、配置、代码注释一律全英文 (English-only)。**
>
> **时间口径:** 工具/型号信息为 **2026‑06**;落地前请对一遍各项目的官方文档。

---

## 0. 怎么用这份文档 / How to use this doc

这份文档是**给人 + 给 Claude 共同执行**的。它把 Plan A 拆成 **16 个 phase
(Phase 0–15)**,每个 phase 都是一个**可独立测试、可回滚**的小闭环。

### 0.1 每个 phase 的执行循环 / The per-phase loop

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. Claude 实现该 phase 的代码 (English-only code & comments)             │
│  2. Claude 跑【自动化测试】(headless: lint / type-check / build /        │
│     pytest with mocks & fixtures) —— 必须全绿                            │
│  3. 测过 → Claude【自动 commit】(author=aevum-orrin, committer=Claude)   │
│     ⚠️ 不 push(除非你明确说 push)                                       │
│  4. 你按本文【你的手动测试 / Your manual test】一步步在真机上验          │
│     (真 Ollama / Whisper / Kokoro / 麦克风 / 扬声器 / GPU)               │
│  5. 你测过 → 你说一句 "Phase N 过了,下一个" → Claude 进入 Phase N+1     │
│  6. 你没过 → 反馈现象 → Claude 修 → 回到第 2 步                          │
└────────────────────────────────────────────────────────────────────────┘
```

**两类测试,必须分清:**

| 标记 | 谁跑 | 在哪跑 | 内容 | 作用 |
| --- | --- | --- | --- | --- |
| 🤖 **Auto (Claude)** | Claude | 云端容器(无 GPU/无麦克风/可能无法下大模型) | lint、type-check、`pnpm build`、`pytest`(**mock 掉模型** + 用 committed 音频 fixture) | **gate 自动 commit** |
| 🧑 **Manual (You)** | 你 | 你的真机 | 真 Ollama/Whisper/Kokoro、真麦克风说话、真扬声器听、真 GPU、真延迟 | **gate 进入下一 phase** |

> ⚠️ **诚实说明 / Honest caveat:** Claude 的容器**很可能**没有 GPU、不能用麦克
> 风/扬声器、也可能无法下载几个 GB 的模型权重。所以"语音到底自不自然""延迟到
> 底多少""GPU 上 70B 跑不跑得动"这些**只能你来测**。Claude 的 🤖 自动化测试覆
> 盖的是**逻辑、协议、胶水代码、类型、构建**——它能保证"代码不是坏的",但**不
> 能替代你对真实语音体验的验收**。每个 phase 都会标注哪些测试 Claude 能真跑、
> 哪些被 mock、哪些必须你来。

### 0.2 Phase 状态追踪 / Status tracker

> Claude 每完成一个 phase 就更新这张表(并在 commit 里带上)。

| Phase | 名称 | 状态 | Claude auto-test | 你已验收 |
| --- | --- | --- | --- | --- |
| 0 | Prerequisites & scaffold | 🤖 Auto-tested | ☑ | ☐ |
| 1 | Backend WebSocket skeleton | 📝 Planned | ☐ | ☐ |
| 2 | LLM via Ollama (text, streaming) | 📝 Planned | ☐ | ☐ |
| 3 | TTS via Kokoro (text → audio) | 📝 Planned | ☐ | ☐ |
| 4 | STT via Whisper (audio → text) | 📝 Planned | ☐ | ☐ |
| 5 | VAD / endpointing (Silero) | 📝 Planned | ☐ | ☐ |
| 6 | Server pipeline, push-to-talk | 📝 Planned | ☐ | ☐ |
| 7 | Frontend integration, push-to-talk | 📝 Planned | ☐ | ☐ |
| 8 | Streaming pipeline (low latency) | 📝 Planned | ☐ | ☐ |
| 9 | Real-time turn-taking (hands-free) | 📝 Planned | ☐ | ☐ |
| 10 | Barge-in / interruption | 📝 Planned | ☐ | ☐ |
| 11 | Robustness (echo, reconnect, errors) | 📝 Planned | ☐ | ☐ |
| 12 | Speech-rate control wiring | 📝 Planned | ☐ | ☐ |
| 13 | Quality mode / model switching | 📝 Planned | ☐ | ☐ |
| 14 | Packaging & one-command run | 📝 Planned | ☐ | ☐ |
| 15 | Deployment (local / Vercel hybrid) | 📝 Planned | ☐ | ☐ |

状态图例 / Legend:📝 Planned · 🚧 In progress · 🤖 Auto-tested (committed) ·
✅ You-accepted · ⛔ Blocked

---

## A. 总体架构 / Architecture

```
┌─────────────────────────── 你的机器 / your machine ───────────────────────────┐
│                                                                                │
│   Browser (Next.js 现有 UI 基本不动)                                           │
│     │  ▲                                                                        │
│     │  │  WebSocket: ws://localhost:8000/ws                                     │
│     │  │  (mic PCM 上行 / transcript + TTS 音频 下行)                           │
│     ▼  │                                                                        │
│   Local voice backend  (新增 / new — Python 3.11 + FastAPI + websockets)        │
│     ├─ Silero VAD      → 断句 endpointing / 检测打断 barge-in                   │
│     ├─ faster-whisper  → STT (audio → text)                                     │
│     ├─ Ollama client   → LLM (HTTP, streaming)  ──▶  Ollama daemon :11434       │
│     └─ Kokoro          → TTS (text → audio)                                     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

**核心认知:** ElevenLabs 把"一条实时管线"藏在一个 SDK 后面;Plan A 要**自己把
这条管线拼出来**——三个模型 + 串它们的胶水 + 一个状态机。难点不在单个模型,而
在**流式编排 + 断句 + 打断 + 低延迟**。

### A.1 仓库布局 / Repo layout(最终形态)

```
GAEY/
├─ app/                         # Next.js (existing)
│  ├─ api/
│  │  ├─ signed-url/route.ts    # ElevenLabs (kept behind a feature flag)
│  │  └─ local-config/route.ts  # (new, optional) expose backend WS URL to client
│  └─ ...
├─ components/
│  └─ ConvAI.tsx                # UI kept; swap the conversation hook (Phase 7)
├─ lib/
│  ├─ useConversationProvider.ts# (new) flag: 'elevenlabs' | 'local'
│  └─ useLocalConversation.ts   # (new) drop-in hook, same surface as ElevenLabs
├─ local-backend/               # (new) the Python voice service
│  ├─ app/
│  │  ├─ main.py                # FastAPI app + /health + /ws
│  │  ├─ protocol.py            # WS message schemas (pydantic)
│  │  ├─ pipeline.py            # orchestration state machine
│  │  ├─ stt_whisper.py         # faster-whisper wrapper
│  │  ├─ llm_ollama.py          # Ollama streaming client
│  │  ├─ tts_kokoro.py          # Kokoro wrapper
│  │  ├─ vad_silero.py          # Silero VAD wrapper
│  │  └─ config.py              # settings (pydantic-settings, env-driven)
│  ├─ scripts/                  # human-runnable demos (say.py, transcribe.py, …)
│  ├─ tests/
│  │  ├─ fixtures/              # committed audio fixtures (small WAVs)
│  │  ├─ conftest.py            # mocks for Ollama/Whisper/Kokoro
│  │  └─ test_*.py
│  ├─ requirements.txt
│  ├─ requirements-dev.txt
│  ├─ pyproject.toml            # ruff + mypy + pytest config
│  ├─ Makefile                  # setup / run / test / lint / fmt
│  └─ README.md                 # backend run guide (English)
├─ doc/
│  ├─ plan-a-selfhosted.md      # ← this file
│  ├─ plan-b-gemini.md
│  └─ cost-and-self-hosting.md
└─ ...
```

> **Feature flag 策略:** 不删 ElevenLabs 路径。用一个环境变量
> `NEXT_PUBLIC_CONV_PROVIDER = 'elevenlabs' | 'local'` 切换,这样任何一个 phase
> 出问题都能一键切回可用的 ElevenLabs 版本,**永远有可回滚的绿色状态**。

---

## B. 技术栈与版本 / Tech stack

| 角色 | 选型 | 备注 |
| --- | --- | --- |
| Backend web | **Python 3.11 + FastAPI + uvicorn** | `websockets` via FastAPI WS |
| STT | **faster-whisper** (CTranslate2) | 默认 `base.en`/`small.en`;GPU 上 `distil-large-v3` |
| LLM runtime | **Ollama** | OpenAI 兼容 `/v1` + 原生 `/api/chat` (stream) |
| LLM model | **llama3.1:8b**(默认) | 质量档可换更大,见 §H.4 / Phase 13 |
| TTS | **Kokoro** (kokoro / kokoro-onnx) | 自然美音,CPU 可近实时;备选 Piper |
| VAD | **silero-vad** (onnxruntime) | 轻量,可 CPU/浏览器 |
| Frontend | 现有 Next.js 15 / React 19 | 新增 `useLocalConversation` hook |
| Mic capture | **AudioWorklet** + `getUserMedia` | 16 kHz mono PCM16 上行 |
| 后端测试 | **pytest + pytest-asyncio + respx + numpy** | mock 模型;fixture 音频 |
| 后端质量 | **ruff**(lint+fmt) + **mypy**(types) | CI gate |
| 前端测试 | **vitest**(hook 逻辑) + `tsc`/`eslint`/`next build` | 现有 + 新增 vitest |

> 选 **Python** 而非 Node 做后端:Whisper/Kokoro/Silero 的一流实现都在 Python
> 生态,省掉大量绑定工作。前后端通过 WebSocket 解耦,语言不一致没关系。

---

## C. 音频格式约定 / Audio conventions(全程统一,避免踩坑)

| 用途 | 采样率 | 格式 | 声道 | 说明 |
| --- | --- | --- | --- | --- |
| 浏览器上行(mic→backend) | **16000 Hz** | PCM **s16le** (Int16) | mono | Whisper/Silero 的原生输入 |
| VAD 内部 | 16000 Hz | float32 [-1,1] | mono | Silero 要 float32 |
| Whisper 输入 | 16000 Hz | float32 | mono | faster-whisper 接 numpy |
| Kokoro 输出 | **24000 Hz** | float32 → PCM s16le | mono | Kokoro 原生 24k |
| 下行(backend→浏览器) | **24000 Hz** | PCM s16le 分帧 | mono | 浏览器端重采样到 AudioContext |

- **分帧 / framing:** 上行每 **20 ms**(320 samples @16k = 640 bytes)一帧;下行
  TTS 每 ~**40 ms** 一帧,便于打断时快速丢弃队列。
- **传输:** 音频走 **WS binary frame**(不 base64,省 33% 带宽);控制消息走
  **WS text frame (JSON)**。后端用首字节/帧类型区分,见 §D。

---

## D. WebSocket 协议 / Message protocol(前后端契约,贯穿所有 phase)

连接地址:`ws://<backend-host>:8000/ws`。文本帧 = JSON 控制消息;二进制帧 = 音频。

### D.1 Client → Server

| 消息 | 帧类型 | 载荷 | 何时发 |
| --- | --- | --- | --- |
| `start` | text | `{ "type":"start", "config": { "speed":1.0, "model":"llama3.1:8b", "mode":"ptt"\|"vad" } }` | 开始一次会话 |
| (audio) | **binary** | PCM s16le 16k mono, 20ms/frame | 持续上行 mic |
| `stop_turn` | text | `{ "type":"stop_turn" }` | push-to-talk 松手(用户说完) |
| `interrupt` | text | `{ "type":"interrupt" }` | 主动打断(也可由 VAD 触发) |
| `end` | text | `{ "type":"end" }` | 结束会话 |

### D.2 Server → Client

| 消息 | 帧类型 | 载荷 | 含义 |
| --- | --- | --- | --- |
| `ready` | text | `{ "type":"ready" }` | 会话已就绪 |
| `state` | text | `{ "type":"state", "value":"idle"\|"listening"\|"thinking"\|"speaking" }` | 状态机变化 → 驱动 UI 状态灯 / `isSpeaking` |
| `user_transcript` | text | `{ "type":"user_transcript", "text":"...", "final":true }` | STT 结果(对应 UI 的 `role:"user"`) |
| `agent_transcript` | text | `{ "type":"agent_transcript", "text":"...", "final":false\|true }` | LLM 文本(对应 `role:"agent"`;可流式) |
| (audio) | **binary** | PCM s16le 24k mono | TTS 音频帧 |
| `agent_done` | text | `{ "type":"agent_done" }` | 本轮 GAEY 说完 |
| `interrupted` | text | `{ "type":"interrupted" }` | 服务端已停 TTS(barge-in 生效) |
| `error` | text | `{ "type":"error", "code":"...", "message":"..." }` | 错误 → UI toast |

### D.3 映射到现有 UI / Mapping to `ConvAI.tsx`

现有 `useConversation()` 暴露:`status` / `isSpeaking` / `startSession` /
`endSession` / `onMessage({ role, message })`。新 hook **一一对齐**:

| ElevenLabs hook | local hook 来源 |
| --- | --- |
| `status: 'connecting'\|'connected'` | WS 连接状态 |
| `isSpeaking` | `state == 'speaking'` |
| `onMessage({role:'user', message})` | `user_transcript.final == true` |
| `onMessage({role:'agent', message})` | `agent_transcript.final == true` |
| `startSession({overrides:{tts:{speed}}})` | 发 `start` 带 `config.speed` |
| `endSession()` | 发 `end` + 关 WS |

> 这张表是 **Phase 7** 的核心:只要新 hook 产出同样的事件,`ConvAI.tsx` 的
> transcript / 波形 / 语速滑块 / 状态灯**一行都不用改**。

---

## E. 配置与环境变量 / Config & env

**Frontend (`.env`):**
```
# Which conversation backend to use
NEXT_PUBLIC_CONV_PROVIDER=local           # 'elevenlabs' | 'local'
# Where the local voice backend lives (browser connects here)
NEXT_PUBLIC_LOCAL_WS_URL=ws://localhost:8000/ws
# (ElevenLabs path still works when PROVIDER=elevenlabs)
AGENT_ID=...
XI_API_KEY=...
```

**Backend (`local-backend/.env`):**
```
OLLAMA_HOST=http://localhost:11434
LLM_MODEL=llama3.1:8b
WHISPER_MODEL=base.en
WHISPER_DEVICE=auto                        # cpu | cuda | auto
KOKORO_VOICE=af_heart
TTS_SAMPLE_RATE=24000
VAD_SILENCE_MS=700                         # 静默多久算说完
ALLOW_ORIGINS=http://localhost:3000        # CORS for the browser
```

---

## F. 测试基础设施 / Testing infrastructure（一次建好,所有 phase 复用）

### F.1 后端 / Backend
- **命令(Makefile 目标):** `make setup` · `make run` · `make test` ·
  `make lint` · `make fmt` · `make test-live`(需真模型,默认不在 CI 跑)。
- **mock 策略:** `tests/conftest.py` 提供 fixtures:
  - `mock_ollama`(respx 拦截 `:11434`,回放预设 streaming chunks)
  - `fake_whisper`(monkeypatch,返回固定 transcript)
  - `fake_kokoro`(返回一段确定的正弦波 PCM,长度随文本)
  - `fake_vad`(按预设时间轴产生 speech/silence 事件)
- **音频 fixtures:** `tests/fixtures/` 放 committed 小 WAV(几秒,16k mono)。
  Phase 3 跑通 Kokoro 后,用它**生成**确定性语音 fixture 供 Phase 4 STT 测试。
- **标记:** `@pytest.mark.live` 标注"需要真模型"的测试;`make test` 跳过它们,
  `make test-live` 才跑(你在真机上跑)。

### F.2 前端 / Frontend
- 现有:`pnpm lint` · `pnpm build` · `tsc --noEmit`。
- 新增:**vitest** 测 hook 的纯逻辑(WS 消息 → 事件/状态 的 reducer),用一个
  fake WebSocket,不碰真后端。
- (可选,Phase 7+)一个 Playwright headless smoke:能加载页面、点按钮、断言
  状态文案变化(用 mock WS server)。

### F.3 Claude 能真跑什么 / What Claude actually runs（重要)
- ✅ 能真跑:`ruff` / `mypy` / `pytest`(mock 版)/ `vitest` / `tsc` /
  `pnpm build` / `docker compose config`。
- ⚠️ 视容器而定(可能跑不了,会如实告诉你):真 `ollama` 守护进程、下载
  Whisper/Kokoro 权重、`faster-whisper` 实跑、`docker build`。
- ❌ 永远跑不了(只能你测):**麦克风输入、扬声器输出、真实语音自然度、端到端
  延迟体感、GPU 上的大模型、回声消除效果**。

---

## G. Phase 路线图总览 / Roadmap at a glance

```
基础设施 ──▶ 三个模型各自跑通 ──▶ 串成管线(push-to-talk)──▶ 接进浏览器
   P0          P2 LLM                  P6 server                P7 frontend
               P3 TTS                                              │
               P4 STT                                              ▼
               P5 VAD                                       实时化 & 体验
                                                     P8 流式 ─ P9 免提 ─ P10 打断
                                                          │
                                                          ▼
                                                   打磨 & 交付
                                          P11 健壮 ─ P12 语速 ─ P13 质量档
                                                   P14 打包 ─ P15 部署
```

依赖关系:P0 → P1 → {P2, P3, P4, P5 可并行} → P6 → P7 →(P8 → P9 → P10 顺序)
→ {P11, P12, P13 可穿插}→ P14 → P15。

---

## Phase 0 — Prerequisites & scaffold / 环境与脚手架

**目标 / Goal:** 把"地基"打好——装好 Ollama + 模型 + Python 环境,建好
`local-backend/` 目录骨架、Makefile、lint/type/test 配置、feature flag。**这一
phase 不实现任何语音功能**,只保证"环境能装上、骨架能跑空测试、构建不破"。

**前置 / Depends on:** 无(起点)。

### 做什么 / Tasks
1. 新建 `local-backend/` 目录骨架(见 §A.1),先放**空壳**模块(每个 `*.py` 里
   先只有类型签名 + `raise NotImplementedError`),保证 import 不报错。
2. 写 `requirements.txt`(fastapi, uvicorn[standard], pydantic, pydantic-settings,
   numpy)和 `requirements-dev.txt`(pytest, pytest-asyncio, respx, ruff, mypy)。
   **模型依赖**(faster-whisper, kokoro, silero-vad, ollama)先列进 requirements
   但用注释标注"installed in their own phase",避免 Phase 0 就被大依赖卡住。
3. 写 `pyproject.toml`:ruff + mypy + pytest 配置(`testpaths`, `asyncio_mode`)。
4. 写 `Makefile`:`setup` / `run` / `test` / `lint` / `fmt` / `test-live`。
5. 写 `config.py`:用 pydantic-settings 读 §E 的后端 env(带默认值)。
6. 写 `scripts/check-prereqs.sh`:检测 `ollama`、`python3.11`、(可选)`nvidia-smi`
   / Apple Silicon,打印每项 ✅/❌ 与修复建议。
7. 前端:加 `NEXT_PUBLIC_CONV_PROVIDER` / `NEXT_PUBLIC_LOCAL_WS_URL` 到
   `.env.example`;**先不动 `ConvAI.tsx`**(保持 ElevenLabs 可用)。
8. 写 `local-backend/README.md`(English):如何 setup/run/test。

### 交付物 / Deliverables
`local-backend/` 全套骨架 + 配置;`.env.example` 更新;`scripts/check-prereqs.sh`。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
# in local-backend/
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt          # dev-only deps (no heavy models yet)
make lint                                     # ruff: clean
make fmt -- --check                           # formatting: clean
mypy app                                       # types: clean (stubs/NotImplementedError ok)
pytest -q                                      # collects; a trivial test_scaffold.py passes
bash scripts/check-prereqs.sh || true         # prints status (may show ❌ in container)
# frontend untouched but must still build:
cd .. && pnpm build                            # green
```
**Pass 标准:** lint/type/build 全绿;`pytest` 至少 1 个 scaffold 测试通过;
`check-prereqs.sh` 能运行并打印结果(容器里 Ollama/GPU 显 ❌ 是**预期**的,不算失败)。
**被 mock / 跳过:** 无真模型安装(`make test-live` 不在此 phase 跑)。
**Claude 容器局限:** 重依赖(faster-whisper 等)可能装不上 → 本 phase **只装
dev 依赖**,重依赖留到各自 phase;若连 dev 依赖都装不上,Claude 会如实报告并改用
`pip install --dry-run` 验证可解析。

### 自动 commit / Auto-commit
`chore(plan-a): phase 0 — backend scaffold, tooling, feature flag`(更新状态表 P0 → 🤖)

### 🧑 你的手动测试 / Your manual test —— 详细步骤

> 目标:确认**你的真机**能装好 Ollama + 模型 + Python 后端环境。预计 15–30 分钟
> (大头是下模型)。

**Step 1 — 装 Ollama**
- macOS:`brew install ollama` 或从 https://ollama.com/download 下载 app。
- Linux:`curl -fsSL https://ollama.com/install.sh | sh`
- Windows:下载安装包(或用 WSL2 跑 Linux 版)。
- 启动守护:macOS app 会自动起;命令行用 `ollama serve`(若未自动运行)。
- ✅ 预期:`ollama --version` 打印版本号。

**Step 2 — 拉默认模型并验证**
```bash
ollama pull llama3.1:8b           # ~4.7 GB 下载,耐心等
ollama run llama3.1:8b "say hi in one short sentence"
```
- ✅ 预期:终端打印一句问候。**记下首 token 大概多久出现**(这是你 CPU/GPU 的
  延迟基线;Phase 8 会用到)。
- ⏱️ 若每秒只蹦几个字 → 说明在用 CPU,后面实时体验会吃力(Phase 13 再谈大模型)。

**Step 3 — 装 Python 3.11 + 建后端环境**
```bash
python3.11 --version              # 没有就先装(brew install python@3.11 / apt / winget)
cd local-backend
python3.11 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
```
- ✅ 预期:pip 安装无报错。

**Step 4 — 跑环境自检脚本**
```bash
bash scripts/check-prereqs.sh
```
- ✅ 预期:看到类似
  ```
  [✅] ollama found (v0.x.x), daemon reachable at :11434
  [✅] llama3.1:8b present
  [✅] python 3.11.x
  [✅] CUDA GPU: NVIDIA ... (或 [ℹ️] Apple Silicon / [⚠️] CPU-only)
  ```
- 如果某项 ❌,脚本会给修复建议,照着补。

**Step 5 — 跑空骨架测试 + 前端构建**
```bash
make test           # 应输出 1 passed
cd .. && pnpm build # 应 build 成功(前端这阶段没改)
```

### ✅ 验收标准 / Acceptance
- [ ] `ollama run llama3.1:8b "..."` 能回话
- [ ] `check-prereqs.sh` 各项 ✅(GPU 项 ⚠️ 可接受)
- [ ] `make test` 通过、`pnpm build` 通过
- [ ] 你知道自己的 LLM 大概延迟(CPU 还是 GPU)

### 进入下一阶段 / Gate
你确认环境就绪 → "Phase 0 过了" → 进 Phase 1。

### 常见问题 / Troubleshooting
| 现象 | 原因 | 解决 |
| --- | --- | --- |
| `ollama: command not found` | 没装/没进 PATH | 重装,或重开终端 |
| 拉模型卡住/失败 | 网络/磁盘 | 换网络;`df -h` 看磁盘(8B 需 ~5 GB) |
| `:11434 connection refused` | 守护没起 | `ollama serve` |
| `python3.11` 不存在 | 系统是 3.12/3.10 | 装 3.11(部分模型库对版本敏感) |
| pip 装不上 `onnxruntime` 等 | 平台 wheel | 升级 pip;mac 用 `onnxruntime`,有 GPU 用 `onnxruntime-gpu`(留到对应 phase) |

---

## Phase 1 — Backend WebSocket skeleton / WS 骨架 + 健康检查

**目标 / Goal:** 一个能跑的 FastAPI 服务:`/health` 返回 ok;`/ws` 能握手、收发
**协议控制消息**(先实现 `start`/`end`/`ping`→`pong`/`state` 这几条,不接任何模
型)。把 §D 的协议用 pydantic 定义出来。

**前置 / Depends on:** Phase 0。

### 做什么 / Tasks
1. `protocol.py`:用 pydantic 定义 §D 全部 client/server 消息的 schema +
   一个 `parse_client_message()` 和 `dump_server_message()`。
2. `main.py`:FastAPI app;`GET /health` → `{"status":"ok","version":...}`;
   `WS /ws`:握手后发 `ready`;收到 `start` 回 `state:listening`;收到 `ping` 回
   `pong`;收到 `end` 关闭。CORS 用 `ALLOW_ORIGINS`。
3. 二进制帧:先**收下并计数**(打印 "got N audio frames"),不处理。
4. `pipeline.py`:先放一个 `Pipeline` 空状态机(idle/listening/thinking/speaking
   的枚举 + 转换函数),Phase 6 再填血肉。

### 交付物 / Deliverables
`protocol.py`、`main.py`(/health + /ws)、`pipeline.py`(状态机骨架)。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 包含:
# test_health.py        : TestClient GET /health == 200 {"status":"ok"}
# test_ws_handshake.py  : 连 /ws → 收到 {"type":"ready"}
# test_ws_ping.py       : 发 {"type":"ping"} → 收到 {"type":"pong"}
# test_ws_start.py      : 发 start → 收到 state:listening
# test_protocol.py      : 非法 JSON / 未知 type → 收到 error frame (不崩)
# test_ws_binary.py     : 发 2 个 binary frame → 服务端计数=2 (日志/计数器)
make lint && mypy app
```
**Pass 标准:** 上述全绿。**真跑(无 mock 需要)**:这一 phase 不依赖模型,Claude
能 100% 真实测到。

### 自动 commit / Auto-commit
`feat(plan-a): phase 1 — FastAPI WS skeleton, health, protocol schemas`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**Step 1 — 起服务**
```bash
cd local-backend && source .venv/bin/activate
make run        # = uvicorn app.main:app --reload --port 8000
```
- ✅ 预期:看到 `Uvicorn running on http://127.0.0.1:8000`。

**Step 2 — 测 /health(另开一个终端)**
```bash
curl -s http://localhost:8000/health
```
- ✅ 预期:`{"status":"ok","version":"..."}`

**Step 3 — 测 WebSocket**(用 `websocat`;没有就 `brew install websocat` /
`cargo install websocat`,或用我们提供的 `scripts/ws_smoke.py`)
```bash
# 方式 A: websocat
websocat ws://localhost:8000/ws
# 连上后你会立刻看到服务端推来:{"type":"ready"}
# 手动粘贴这行回车:
{"type":"ping"}
# ✅ 预期收到:{"type":"pong"}
{"type":"start","config":{"speed":1.0,"model":"llama3.1:8b","mode":"ptt"}}
# ✅ 预期收到:{"type":"state","value":"listening"}

# 方式 B: 我们的脚本(更省事)
python scripts/ws_smoke.py        # 自动跑完上面的握手并打印每步结果
```

**Step 4 — 看错误处理**
```bash
# 在 websocat 里粘一行非法内容:
not-json
# ✅ 预期:{"type":"error",...} 且服务不崩(还能继续 ping/pong)
```

### ✅ 验收标准 / Acceptance
- [ ] `/health` 返回 ok
- [ ] WS 连上即收到 `ready`
- [ ] `ping→pong`、`start→state:listening` 正常
- [ ] 非法消息回 `error` 且服务不崩
- [ ] `--reload` 改代码自动热重启

### 进入下一阶段 / Gate
"Phase 1 过了" → 进 Phase 2。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| `Address already in use :8000` | 改端口 `make run PORT=8001` 或杀掉占用进程 |
| 浏览器/工具连 WS 失败 | 确认 `ws://`(非 `http://`);确认 CORS `ALLOW_ORIGINS` |
| `websocat` 没有 | 用 `python scripts/ws_smoke.py` 代替 |

---

## Phase 2 — LLM via Ollama (text-only, streaming) / 接 Ollama

**目标 / Goal:** 后端能把一段**文本**问 Ollama,并**流式**拿回 GAEY 人设的回复。
注入 GAEY system prompt(`PLAN.md` §7),维护多轮对话历史。**仍然纯文本,无音频。**

**前置 / Depends on:** Phase 1;你已 `ollama pull llama3.1:8b`。

### 做什么 / Tasks
1. `llm_ollama.py`:`async def stream_chat(messages) -> AsyncIterator[str]`,
   调用 Ollama `/api/chat`(`"stream": true`),逐 chunk yield token 文本。
   超时、连接错误 → 抛清晰异常。
2. GAEY persona:把 `PLAN.md` §7 的 system prompt 放进 `config.py` /
   `prompts.py`(English),作为 messages[0]。
3. 会话历史:`pipeline.py` 里维护 `List[{role, content}]`,每轮追加 user/assistant。
4. 临时把 WS `start` 后收到的**文本** ping 当 user 输入,流式回
   `agent_transcript`(final=false 逐 chunk,最后 final=true)。**(临时通道,
   Phase 6 接 STT 后替换。)**

### 交付物 / Deliverables
`llm_ollama.py`、`prompts.py`、`pipeline.py`(接 LLM 的最小闭环)。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 用 respx mock 掉 :11434:
# test_llm_stream.py     : mock 返回 3 个 chunk → stream_chat 依次 yield, 拼接正确
# test_llm_systemprompt.py: 断言请求体 messages[0].role=="system" 且含 GAEY 关键词
# test_llm_history.py    : 两轮对话 → 第二次请求带上了第一轮的 user+assistant
# test_llm_error.py      : mock 500 / 超时 → 抛出可读异常, WS 回 error frame
make lint && mypy app
```
**Pass 标准:** mock 版全绿。
**⚠️ 被 mock:** 真 Ollama 不在 Claude 这跑(容器多半没有)。真实回复质量/速度
**你来测**(下面 test-live)。Claude 会写 `@pytest.mark.live test_llm_real.py`
但**不**在自动测试里跑它。

### 自动 commit / Auto-commit
`feat(plan-a): phase 2 — Ollama streaming chat with GAEY persona`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**Step 1 — 确认 Ollama 在跑**
```bash
curl -s http://localhost:11434/api/tags | head    # 应列出 llama3.1:8b
```

**Step 2 — 跑文本对话 REPL(我们提供的脚本)**
```bash
cd local-backend && source .venv/bin/activate
python scripts/chat_repl.py
# 然后输入:
> what's up?
```
- ✅ 预期:看到**逐字蹦出**的回复(流式),且口吻像 GAEY(friendly、美式、PG、
  会用/解释 slang)。例如:"Yo! Not much, just chillin'. What's good with you?"
- ✅ 多问一句,确认它**记得上一轮**(历史生效):
  ```
  > what does "no cap" mean?
  > and use it in a sentence
  ```
  第二句应承接第一句的话题。

**Step 3 —(可选)跑 live 测试**
```bash
make test-live    # 会真连 Ollama 跑 test_llm_real.py;断言能拿到非空回复
```

**Step 4 — 主观验收 persona**:回复是不是**友好、地道、PG、爱用并解释俚语**?
不满意的话,persona prompt 在 `prompts.py`,告诉我怎么调。

### ✅ 验收标准 / Acceptance
- [ ] 流式逐字输出
- [ ] 口吻符合 GAEY(见 `PLAN.md` §7)
- [ ] 多轮记忆生效
- [ ] Ollama 挂掉时 REPL 报可读错误(不是堆栈炸裂)

### 进入下一阶段 / Gate
"Phase 2 过了" → 进 Phase 3。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 回复很慢/逐字很卡 | CPU 在跑;Phase 13 谈换更快/更小模型或上 GPU |
| persona 不够地道 | 调 `prompts.py` 的 system prompt(给我反馈) |
| `model not found` | `ollama pull llama3.1:8b` |
| 偶尔输出乱码/不停 | 设置 `num_predict`/stop;调 temperature |

---

## Phase 3 — TTS via Kokoro (text → audio) / 接 Kokoro

**目标 / Goal:** 后端能把**文本**合成成**自然美音**的音频(Kokoro),支持 `speed`
参数,输出 §C 约定的 24k PCM。**这是 Plan A 学习体验的关键一环。**

**前置 / Depends on:** Phase 1。

### 做什么 / Tasks
1. `tts_kokoro.py`:`def synthesize(text, voice, speed) -> np.ndarray`(float32
   24k mono);再加 `to_pcm16_frames(audio, frame_ms=40) -> Iterator[bytes]`。
2. 模型加载放进**单例 / lazy load**,避免每次请求重载。
3. `scripts/say.py "<text>" out.wav [speed]`:命令行合成并存 WAV,供你试听。
4. 用 Kokoro 生成一个**确定性 fixture** `tests/fixtures/hello_16k.wav`(降采样到
   16k),供 Phase 4 的 STT 测试复用。

### 交付物 / Deliverables
`tts_kokoro.py`、`scripts/say.py`、`tests/fixtures/hello_16k.wav`(committed)。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 默认用 fake_kokoro(返回确定正弦波), 测包装逻辑:
# test_tts_frames.py  : to_pcm16_frames 切帧长度/采样率/字节数正确
# test_tts_speed.py   : speed 参数被传入合成调用(mock 断言)
# test_tts_empty.py   : 空文本/超长文本的边界处理
make lint && mypy app
# 若容器能装上 kokoro(它只有 ~82M),Claude 会尝试真跑一次冒烟:
make smoke-tts   # 真合成 "hello" → 断言返回非空、采样率=24000、时长合理
```
**Pass 标准:** 包装逻辑测试全绿。
**⚠️ 视容器:** Kokoro 较小,Claude **会尝试**真装真跑 `make smoke-tts`(并把
生成的 fixture 提交);若容器装不上(无网络/无 wheel),则只跑 mock 版并**如实
告诉你**:"音质需你试听验收"。**音色是否自然只能你听。**

### 自动 commit / Auto-commit
`feat(plan-a): phase 3 — Kokoro TTS wrapper, framing, say.py, audio fixture`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**Step 1 — 装 Kokoro(若 Phase 0 没装)**
```bash
cd local-backend && source .venv/bin/activate
pip install kokoro soundfile        # 具体包名以 README 为准
```

**Step 2 — 合成并试听**
```bash
python scripts/say.py "Hey, what's good? No cap, your English is fire." out.wav
```
播放(按你的系统):
- macOS:`afplay out.wav`
- Linux:`aplay out.wav`(或 `ffplay out.wav`)
- Windows:`start out.wav`
- ✅ 预期:听到**自然的美式英语**,吐字清楚,像个年轻美国朋友。

**Step 3 — 试不同语速**
```bash
python scripts/say.py "Let's slow this down a bit." slow.wav 0.7
python scripts/say.py "And speed it up!" fast.wav 1.2
```
- ✅ 预期:`slow.wav` 明显更慢、`fast.wav` 更快,且都还能听清。

**Step 4 — 试不同 voice(可选)**:改 `.env` 的 `KOKORO_VOICE`(如 `af_heart`/
`am_*`),挑一个最像"友好年轻美国朋友"的。挑好告诉我设为默认。

### ✅ 验收标准 / Acceptance
- [ ] 能合成出**清楚、自然**的美音(主观:像真人朋友)
- [ ] `speed` 0.7 / 1.0 / 1.2 听感正确
- [ ] 至少选定一个满意的默认 voice
- [ ] 合成延迟可接受(记下"合成 1 句大概多久",Phase 8 用)

### 进入下一阶段 / Gate
"Phase 3 过了" → 进 Phase 4。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 安装失败(espeak/phonemizer) | 按 Kokoro README 装系统依赖(如 `espeak-ng`) |
| 音色机械/不满意 | 换 voice;或评估备选 Piper(更快)/ 之后考虑 XTTS(更像但更重) |
| 合成很慢 | 句子太长 → Phase 8 会按句切流式;或确认没在每次重载模型 |
| 播放无声 | 确认系统音量/输出设备;换 `ffplay` |

---
## Phase 4 — STT via Whisper (audio → text) / 接 Whisper

**目标 / Goal:** 后端能把一段**音频**(16k PCM/WAV)转成文本(faster-whisper)。
**先做"整段转写"**(一句说完再转),真正的流式 partial 留到后面(非必须)。

**前置 / Depends on:** Phase 1;Phase 3 产出的 `hello_16k.wav` fixture。

### 做什么 / Tasks
1. `stt_whisper.py`:`def transcribe(pcm16_16k: bytes|np.ndarray) -> str`,封装
   faster-whisper(`WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE)`);模型
   lazy 单例。可选返回 `language`/`avg_logprob`(置信度)。
2. `scripts/transcribe.py <wav>`:命令行转写一个 WAV,打印文本。
3. `scripts/record.py [seconds] out.wav`:用 `sounddevice` 录一段 16k mono WAV
   (供你自录自测)。

### 交付物 / Deliverables
`stt_whisper.py`、`scripts/transcribe.py`、`scripts/record.py`。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 默认 fake_whisper(monkeypatch 返回固定串)测包装/格式转换:
# test_stt_format.py : bytes/ndarray 输入都能处理; 16-bit→float32 缩放正确
# test_stt_wav.py    : 读 fixtures/hello_16k.wav 走通(用 fake 模型断言被调用)
make lint && mypy app
# 若容器能装 faster-whisper 并下 tiny 模型,Claude 尝试真跑:
make smoke-stt     # 真转写 fixtures/hello_16k.wav, 断言文本里含 "hello"(模糊匹配)
```
**Pass 标准:** 包装逻辑 mock 测试全绿。
**⚠️ 视容器:** faster-whisper + `tiny` 模型不大,Claude **会尝试**真跑
`make smoke-stt`(对 Phase 3 生成的确定性 fixture 转写,断言关键词命中);若容器
下不了模型,只跑 mock 版并告知。**用你真实口音/真麦克风的识别率只能你测。**

### 自动 commit / Auto-commit
`feat(plan-a): phase 4 — faster-whisper STT wrapper + transcribe/record scripts`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**Step 1 — 装 faster-whisper(若没装)**
```bash
pip install faster-whisper sounddevice
```

**Step 2 — 转写已知音频(用 Phase 3 的合成结果)**
```bash
python scripts/transcribe.py out.wav
```
- ✅ 预期:打印的文本和你 Phase 3 合成的句子基本一致。

**Step 3 — 录你自己的声音再转写(关键!测真实口音)**
```bash
python scripts/record.py 5 me.wav     # 对着麦克风说 5 秒英文,比如自我介绍
python scripts/transcribe.py me.wav
```
- ✅ 预期:文本能较准确地还原你说的话。
- 📝 记下识别质量:有没有把关键词听错?中式口音影响大不大?(影响后续模型选择)

**Step 4 — 试不同模型大小(可选)**:改 `.env` `WHISPER_MODEL=small.en` 再转一次,
对比准确率 vs 速度,挑一个平衡点。

### ✅ 验收标准 / Acceptance
- [ ] 已知合成音频转写正确
- [ ] **你自己的英文**能被较准确识别
- [ ] 选定一个准确率/速度平衡的 `WHISPER_MODEL`
- [ ] 记下"转写 5 秒大概多久"(Phase 8 用)

### 进入下一阶段 / Gate
"Phase 4 过了" → 进 Phase 5。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| `sounddevice` 录不到/无设备 | 装 PortAudio(`brew install portaudio`/`apt install libportaudio2`);检查系统麦克风权限 |
| 识别很烂 | 升到 `small.en`/`distil-large-v3`;确认采样率=16k;录音别太小声 |
| 首次很慢 | 在下/转模型权重;之后会快 |
| 中文被识别成英文乱码 | 这是英语学习 app,STT 设定 `language="en"` 即可 |

---

## Phase 5 — VAD / endpointing (Silero) / 断句

**目标 / Goal:** 后端能从**连续音频流**里判断"用户开始说话 / 用户说完了"(静默
超过阈值即 endpoint)。这是后面"免提对话"和"打断"的基础。

**前置 / Depends on:** Phase 1。

### 做什么 / Tasks
1. `vad_silero.py`:`class Endpointer`,喂 20ms 帧,产出事件
   `speech_start` / `speech_end`(基于 silero-vad 概率 + `VAD_SILENCE_MS` 静默
   计时 + 最短语音时长去抖)。
2. `scripts/vad_demo.py`:从麦克风实时跑,终端打印 `▶ speech start` / `⏹ speech
   end (Xs)`,让你直观看到断句。
3. 暴露一个 `reset()`(每轮结束清状态)。

### 交付物 / Deliverables
`vad_silero.py`、`scripts/vad_demo.py`。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 用合成时间轴(噪声/静音/正弦)+ fake_vad 或真 silero(很小):
# test_vad_segments.py  : [silence, speech 1.5s, silence 1s] → 恰好 1 个 speech_end
# test_vad_silence.py   : 调 VAD_SILENCE_MS, endpoint 触发时机随之变化
# test_vad_debounce.py  : 极短 50ms 杂音脉冲不应触发一整轮(去抖)
make lint && mypy app
```
**Pass 标准:** 上述全绿。
**✅ Claude 可信度较高:** silero-vad 很小(onnx),Claude **大概率能真装真跑**对
合成音频做断句断言(确定性,不需要麦克风)。**但"边说话边停顿的真实手感"只能你
用麦克风测。**

### 自动 commit / Auto-commit
`feat(plan-a): phase 5 — Silero VAD endpointer + vad_demo`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
```bash
pip install silero-vad onnxruntime    # 有 NVIDIA GPU 可换 onnxruntime-gpu
python scripts/vad_demo.py
```
然后:
1. **说一句话再停** → ✅ 预期:说话时打印 `▶ speech start`,你停下约
   `VAD_SILENCE_MS` 后打印 `⏹ speech end (1.8s)`。
2. **说话中间短暂停顿(<阈值)** → ✅ 预期:**不**误判结束(去抖/静默阈值生效)。
3. **调 `.env` 的 `VAD_SILENCE_MS`**(如 400 vs 1000)再试 → 感受"它多快认为你
   说完了"。挑一个对你舒服的值(太短会抢话,太长会迟钝)。

### ✅ 验收标准 / Acceptance
- [ ] 正常说话→停顿能正确 endpoint
- [ ] 句中短停顿不误触发
- [ ] 找到你舒服的 `VAD_SILENCE_MS`
- [ ] 背景噪声下不疯狂误报(差的话记下环境)

### 进入下一阶段 / Gate
"Phase 5 过了" → 进 Phase 6。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 总是太早/太晚判定说完 | 调 `VAD_SILENCE_MS` 与语音概率阈值 |
| 安静时也报 speech | 调高概率阈值;远离风扇/空调;用降噪麦克风 |
| onnxruntime 装不上 | 对齐 Python 3.11;CPU 用 `onnxruntime` |

---

## Phase 6 — Server pipeline, push-to-talk (non-streaming) / 串成管线

**目标 / Goal:** 把 STT+LLM+TTS 在**服务端串成一条完整管线**,跑通 §D 全协议的
**push-to-talk** 模式:浏览器(或脚本)上行一段音频 → `stop_turn` → 服务端
转写→思考→合成 → 下行 transcript + 音频 + `agent_done`。**先不追求低延迟**(整段
处理),但**状态机与协议要完整正确**。

**前置 / Depends on:** Phase 2 (LLM)、Phase 3 (TTS)、Phase 4 (STT)。

### 做什么 / Tasks
1. `pipeline.py`:实现真正的状态机
   `idle → listening →(stop_turn)→ thinking → speaking →(agent_done)→ listening`,
   每次转换发 `state` 帧。
2. WS handler:
   - 收 binary audio → 累积到本轮 buffer(listening 态)。
   - 收 `stop_turn` → STT(整段)→ 发 `user_transcript(final)` → 喂 LLM(整段,
     非流式也可)→ 发 `agent_transcript(final)` → TTS → 下行音频帧 → `agent_done`。
   - 维护对话历史(Phase 2)。
3. 错误任一环失败 → 发 `error` 并回到 `listening`,不崩。

### 交付物 / Deliverables
完整 `pipeline.py` + WS handler;`scripts/ptt_client.py`(录音→发→收→存→播)。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test    # 端到端集成测试, 全程 mock 三个模型 (conftest fixtures):
# test_pipeline_ptt.py :
#   连 /ws → start → 灌 fixtures 音频帧 → stop_turn
#   断言依次收到: state:thinking, user_transcript(final),
#                 agent_transcript(final), >=1 binary audio frame,
#                 state:speaking, agent_done, state:listening
# test_pipeline_states.py : 状态机非法转换被拒; 顺序正确
# test_pipeline_error.py  : STT 抛错 → error frame + 回 listening (不崩)
# test_pipeline_history.py: 连续两轮, 第二轮 LLM 收到第一轮历史
make lint && mypy app
```
**Pass 标准:** 集成测试全绿(**这是 Claude 能高质量覆盖的核心** —— 协议、状态
机、编排、错误处理都用 mock 模型确定性地测到)。
**⚠️ 被 mock:** 三个模型都是 mock;**真实"说一句→听到回复"必须你测。**

### 自动 commit / Auto-commit
`feat(plan-a): phase 6 — end-to-end push-to-talk pipeline over WS`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
> 还没接浏览器,用脚本当客户端(浏览器在 Phase 7)。

**Step 1 — 起后端(确保 Ollama 在跑)**
```bash
cd local-backend && source .venv/bin/activate && make run
```
**Step 2 — 跑 push-to-talk 客户端脚本(另开终端)**
```bash
python scripts/ptt_client.py
# 提示 "Press Enter, then speak..." → 回车 → 说一句英文 → 再回车结束
```
- ✅ 预期(终端):
  ```
  you said:  "what does no cap mean?"
  GAEY says: "No cap just means 'for real' / 'I'm not lying'. ..."
  [playing reply.wav]   ← 自动播放 GAEY 的语音
  ```
- ✅ 你应**听到** GAEY 用语音回答,且**字幕**(user/GAEY 两行)正确。

**Step 3 — 多轮**:脚本循环,连说两三轮,确认**上下文连续**且每轮都有语音。

**Step 4 — 故意制造错误**:把 Ollama 停掉再说一句 → ✅ 预期:脚本收到 `error`、
后端不崩、Ollama 恢复后还能继续。

### ✅ 验收标准 / Acceptance
- [ ] 录一句 → 听到 GAEY 语音回复 + 看到双方字幕
- [ ] 多轮上下文连续
- [ ] 任一模型出错时优雅报错、可恢复
- [ ] 记下"端到端总延迟"(说完→开始出声),作为 Phase 8 优化的基线

### 进入下一阶段 / Gate
"Phase 6 过了" → 进 Phase 7(接浏览器)。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 延迟很大(好几秒) | 正常!本 phase 是整段处理;Phase 8 流式化会大幅改善 |
| 播放的音频有杂音/变速 | 检查 §C 采样率(24k 下行)与 WAV header |
| 字幕乱序 | 检查状态机发帧顺序;看 test_pipeline_states |
| WS 中途断 | 看后端日志异常;音频帧过大可分片 |

---
## Phase 7 — Frontend integration, push-to-talk / 接进浏览器

**目标 / Goal:** 在浏览器里把 GAEY 跑通(push-to-talk):写 `useLocalConversation()`
顶替 hook(接口与 ElevenLabs 版一致),用 feature flag 切换。**复用现有
`ConvAI.tsx` 的全部 UI**(字幕/波形/状态/语速滑块)。第一次能在网页上对它说话!

**前置 / Depends on:** Phase 6;后端能跑。

### 做什么 / Tasks
1. `lib/useLocalConversation.ts`:
   - 连 `NEXT_PUBLIC_LOCAL_WS_URL`;暴露与 ElevenLabs 同款的
     `{ status, isSpeaking, startSession, endSession, onMessage }`。
   - 麦克风:`getUserMedia` + **AudioWorklet** 把音频降到 16k mono PCM16,按 20ms
     帧走 WS binary 上行。
   - 播放:收下行 24k PCM 帧 → 入**播放队列**(AudioWorklet / AudioBufferQueue),
     `state:speaking` 时 `isSpeaking=true`。
   - 把 `user_transcript`/`agent_transcript`(final)转成 `onMessage({role,message})`。
   - push-to-talk:提供"按住说话"或"点一下开始/再点结束";松手发 `stop_turn`。
2. `lib/useConversationProvider.ts`:按 `NEXT_PUBLIC_CONV_PROVIDER` 选 ElevenLabs
   或 local hook。**`ConvAI.tsx` 只改一行**:从 provider 取 hook。
3. push-to-talk 的 UI:加一个"Hold to talk"按钮(或复用现有按钮 + 录音态)。

### 交付物 / Deliverables
`useLocalConversation.ts`、`useConversationProvider.ts`、`ConvAI.tsx`(一行切换 +
PTT 按钮)、AudioWorklet processor 文件。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm build      # 全绿
pnpm test    # vitest, 用 fake WebSocket:
# useLocalConversation.test.ts :
#   注入假 WS → 推 ready/state/user_transcript/agent_transcript/agent_done
#   断言: status 流转, isSpeaking 随 state:speaking 翻转,
#         onMessage 收到 {role:'user'} 和 {role:'agent'} 各一次
# provider.test.ts : flag=elevenlabs/local 各自返回正确 hook
# (SSR) ConvAI 渲染不报错; 切到 local 不引入 ElevenLabs
```
**Pass 标准:** lint/type/build/vitest 全绿。
**⚠️ 永远 mock:** WebSocket 是假的、没有真麦克风/扬声器。**"在浏览器里点一下能
说话、能听到、字幕对"必须你测。** Claude 也会写一个**可选**的 Playwright headless
smoke(mock WS server)断言"点按钮→状态文案变化",但真实音频仍靠你。

### 自动 commit / Auto-commit
`feat(plan-a): phase 7 — useLocalConversation hook + provider flag (push-to-talk)`

### 🧑 你的手动测试 / Your manual test —— 详细步骤(浏览器,重头戏)
**Step 1 — 配 env**
```bash
# 项目根 .env
NEXT_PUBLIC_CONV_PROVIDER=local
NEXT_PUBLIC_LOCAL_WS_URL=ws://localhost:8000/ws
```
**Step 2 — 同时起后端 + 前端**(两个终端)
```bash
# 终端 A
cd local-backend && source .venv/bin/activate && make run
# 终端 B
pnpm dev      # http://localhost:3000
```
**Step 3 — 浏览器测试**
1. 打开 http://localhost:3000 ,**用 Chrome**。
2. 顶部状态灯应从 Disconnected → 点 "Start conversation" → **Connected**(绿点)。
3. 浏览器弹**麦克风授权** → 允许。
4. **按住 "Hold to talk"**(或点开始),说:"Hey GAEY, what does 'lowkey' mean?",
   松手。
5. ✅ 预期:
   - 状态变 "GAEY is speaking"(青色脉冲),你**听到**语音回答;
   - 字幕里出现**你那句(右,You)** 和 **GAEY 的回答(左,GAEY)**;
   - 波形在你说话时有反应。
6. 再来一轮,确认连续。
7. 点 "End conversation" → 回到 Disconnected。

**Step 4 — DevTools 自检(可选但推荐)**
- F12 → Network → WS:看到 `/ws` 连接;Messages 里有 JSON 控制帧 + binary 帧。
- Console:无红色报错。

**Step 5 — 回滚验证 feature flag**:把 `.env` 改回
`NEXT_PUBLIC_CONV_PROVIDER=elevenlabs` 重启 `pnpm dev` → ✅ 老的 ElevenLabs 路径
仍正常(证明随时可回滚)。

### ✅ 验收标准 / Acceptance
- [ ] 网页上能"按住说话"→ 听到 GAEY 语音 + 看到双向字幕
- [ ] 状态灯/波形/语速滑块 UI 都在且响应
- [ ] flag 切回 elevenlabs 仍可用
- [ ] Console 无报错;WS 帧正常

### 进入下一阶段 / Gate
"Phase 7 过了" → 进 Phase 8(流式提速)。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 点 Start 连不上 | 后端没起 / `NEXT_PUBLIC_LOCAL_WS_URL` 错 / CORS `ALLOW_ORIGINS` 不含 3000 |
| 无麦克风权限 | 浏览器地址栏允许;`localhost` 才给麦克风(非 https 的局域网 IP 会被拒) |
| 听不到声音 | 检查播放队列采样率;系统输出设备;先用 `say.py` 确认 TTS 本身没问题 |
| 上行音频是 48k | AudioWorklet 要重采样到 16k;核对 §C |
| 字幕不显示 | onMessage 没收到 final;看 WS Messages 是否有 `*_transcript final:true` |

---

## Phase 8 — Streaming pipeline (low latency) / 流式提速

**目标 / Goal:** 把"说完要等好几秒"降到"**说完很快就开口**"。做法:LLM **token
流** → **按句切分** → **逐句 TTS** → **边合成边下行音频**;浏览器**边收边播**。
目标 **time-to-first-audio < ~1.5s**(取决于你硬件)。

**前置 / Depends on:** Phase 6 (pipeline)、Phase 7 (前端播放队列)。

### 做什么 / Tasks
1. LLM:Phase 2 的 `stream_chat` 改为真正驱动管线(逐 token)。
2. `sentence_chunker.py`:把 token 流增量切成"可合成的句子/子句"(遇 `. ! ? …`
   或足够长的逗号停顿即出一块;处理 "Mr."/"U.S." 等缩写不误切)。
3. pipeline:每出一块文本 → 立刻 TTS → 立刻下行音频帧;同时增量发
   `agent_transcript(final=false)`,整轮结束发一次 `final=true`。
4. 前端:播放队列支持"陆续到达的音频帧无缝衔接";`isSpeaking` 在第一帧音频时即
   置真。
5. 加 `scripts/latency_probe.py`:打时间戳测 stop_turn→first audio frame。

### 交付物 / Deliverables
`sentence_chunker.py`、流式版 `pipeline.py`、前端播放队列增强、`latency_probe.py`。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_chunker.py        : 各种标点/缩写/长句 → 期望的分块边界
# test_stream_order.py   : mock LLM 吐 5 token (含 2 句) → 断言 "第一块音频在 LLM
#                          尚未吐完时就已下行"(用事件时间线断言流式, 不是整段)
# test_stream_partial.py : agent_transcript 增量 final=false 多次 + 末尾 final=true
pnpm test  # 前端: 播放队列按 seq 无缝拼接; 中途到帧不卡死
make lint && mypy app
```
**Pass 标准:** 上述全绿(**流式顺序**用确定性 mock 时间线能真测到)。
**⚠️ 被 mock:** 真实延迟数字(秒)取决于你的 CPU/GPU,**只能你测**;Claude 只能
保证"是流式架构、顺序正确"。

### 自动 commit / Auto-commit
`feat(plan-a): phase 8 — streaming LLM→sentence→TTS pipeline, low latency`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**Step 1 — 浏览器对话,体感延迟**
- 起后端 + `pnpm dev`,说一句话。
- ✅ 预期:相比 Phase 6/7,**明显更快开口**;GAEY 是"边想边说"的感觉。

**Step 2 — 量化延迟(可选)**
```bash
python scripts/latency_probe.py     # 自动录一句、发出、计时到第一帧音频
# ✅ 目标: time-to-first-audio < ~1.5s (GPU 上更低; 纯 CPU 可能更高)
```
- 📝 记下你机器上的数字。CPU 太慢的话,Phase 13 可换更小/更快模型。

**Step 3 — 长回答测试**:问一个会让它说很长的问题(如 "explain 5 slang words")
→ ✅ 预期:它**说着说着继续出后面的句子**,而不是憋很久才一次性蹦出来。

### ✅ 验收标准 / Acceptance
- [ ] 体感"说完很快开口"
- [ ] 长回答是"陆续说出",不是一次性
- [ ] time-to-first-audio 在你硬件上可接受(记下数字)
- [ ] 音频无明显卡顿/拼接爆音

### 进入下一阶段 / Gate
"Phase 8 过了" → 进 Phase 9(免提)。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 首句还是慢 | LLM 首 token 慢(CPU)→ Phase 13 换模型/上 GPU;或缩短 system prompt |
| 句子切得太碎/太长 | 调 chunker 的最小/最大块长与标点规则 |
| 音频拼接有"咔哒" | 帧边界淡入淡出;确保 seq 顺序播放 |
| 字幕一次性出现 | 确认 agent_transcript 增量 final=false 有发 |

---

## Phase 9 — Real-time turn-taking (hands-free) / 免提实时对话

**目标 / Goal:** 不用按按钮——**一直在听**,你说完(VAD endpoint)它**自动**接话。
把 Phase 5 的 VAD 接进实时管线,`mode:"vad"`。

**前置 / Depends on:** Phase 5 (VAD)、Phase 8 (streaming)。

### 做什么 / Tasks
1. pipeline `mode:"vad"`:listening 态下持续把上行帧喂 VAD;`speech_start` →
   开始累积;`speech_end` → 自动触发(等价于 Phase 6 的 `stop_turn`)。
2. 前端:`mode:"vad"` 时**不**显示"按住说话",改为"开始对话后一直听";加"麦克风
   静音"切换。
3. 处理边界:GAEY 说话时用户也在说 → 进入 Phase 10 的打断逻辑(此 phase 先简单:
   GAEY 说话期间不收新轮,或排队)。

### 交付物 / Deliverables
VAD 驱动的 pipeline 分支、前端免提 UI、mute 切换。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_vad_turn.py : 灌入 [speech 2s, silence 0.8s, speech 1.5s, silence 0.8s]
#                    → 断言自动产生 2 个完整轮次 (无需 stop_turn)
# test_vad_min.py  : 太短的杂音不触发一整轮
pnpm test          # 前端 mode=vad 时不渲染 PTT 按钮; mute 阻止上行
make lint && mypy app
```
**Pass 标准:** 用合成音频时间线断言"自动断句成轮"——Claude 能确定性测到。
**⚠️ 你测:** 真实"自然说话、停顿、它接话"的手感(尤其抢话/迟钝)只能你体验。

### 自动 commit / Auto-commit
`feat(plan-a): phase 9 — VAD-driven hands-free turn-taking`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
1. `.env` 或 UI 选 `mode=vad`,起后端 + `pnpm dev`,点 "Start conversation"。
2. **直接说话**(不按任何键),说完**停顿** → ✅ 预期:约 `VAD_SILENCE_MS` 后
   GAEY **自动**开口回答。
3. **连续多轮自然对话** → ✅ 预期:像打电话,你一句它一句。
4. **调 `VAD_SILENCE_MS`**:太小→它抢话;太大→它反应慢。挑舒服值。
5. 点 **mute** → ✅ 预期:它不再接收你的话。

### ✅ 验收标准 / Acceptance
- [ ] 免提:说完它自动接话
- [ ] 多轮自然,不需要按键
- [ ] `VAD_SILENCE_MS` 调到舒服
- [ ] mute 生效

### 进入下一阶段 / Gate
"Phase 9 过了" → 进 Phase 10(打断)。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 老抢话 | 调大 `VAD_SILENCE_MS`;调高 VAD 阈值 |
| 它把自己的声音当成你说话 | 戴耳机(Phase 11 做回声消除前的临时方案) |
| 反应慢 | 调小 `VAD_SILENCE_MS`;提速 LLM(Phase 13) |

---
## Phase 10 — Barge-in / interruption / 打断

**目标 / Goal:** GAEY 说话时,你一开口它**立刻停下来听你**(像真人对话)。

**前置 / Depends on:** Phase 9。

### 做什么 / Tasks
1. 服务端:`speaking` 态下仍跑 VAD;检测到用户 `speech_start` → **取消**当前 LLM/
   TTS 任务、停止下行音频、发 `interrupted` + `state:listening`,开始新一轮。
2. 前端:收到 `interrupted` → **立刻清空播放队列**(别把残留音频放完)。
3. 取消要干净:用 `asyncio.Task` 取消 + 标志位,避免"已生成的句子还在往外吐"。
4. 防误触:可设一个很短的"宽限期/最小用户语音时长"避免一个气音就打断。

### 交付物 / Deliverables
pipeline 打断逻辑、前端队列 flush、取消测试。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_bargein.py :
#   进入 speaking (mock TTS 正在吐帧) → 注入用户 speech_start
#   → 断言: 收到 interrupted, 下行音频停止, state→listening, 新轮开始
# test_bargein_cancel.py : 被取消的 LLM/TTS 任务确实停止 (无泄漏/无后续帧)
# test_bargein_grace.py  : 极短气音不触发打断
pnpm test  # 前端: 收到 interrupted 立刻清空队列, isSpeaking=false
make lint && mypy app
```
**Pass 标准:** 用 mock 的"正在说话"状态注入打断,断言取消与状态——Claude 能测到
逻辑。**⚠️ 你测:** 真实"插嘴它就停"的顺滑度(含回声导致的误打断)。

### 自动 commit / Auto-commit
`feat(plan-a): phase 10 — barge-in (interrupt TTS on user speech)`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
1. 起后端 + 前端,免提模式,问一个长问题让它说很久。
2. **在它说话中途插嘴**说点别的 → ✅ 预期:它**马上闭嘴**,转去听你,然后回应
   你的新话(不是把旧话说完)。
3. **戴耳机测**(排除回声)和**外放测**各一次,对比。外放时若它老打断自己→说明
   回声把它自己的声音当成你了,Phase 11 修。

### ✅ 验收标准 / Acceptance
- [ ] 说话中插嘴,GAEY 及时停下
- [ ] 残留音频不会放完
- [ ] 戴耳机时不自我打断
- [ ] 轻微杂音不误打断

### 进入下一阶段 / Gate
"Phase 10 过了" → 进 Phase 11。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 插嘴后它还说几句才停 | 取消没生效;检查 task cancel + 队列 flush |
| 外放时自我打断 | 回声 → Phase 11 AEC;先戴耳机 |
| 太敏感,喘气就停 | 调大最小用户语音时长/宽限期 |

---

## Phase 11 — Robustness (echo, reconnect, errors) / 健壮性

**目标 / Goal:** 让它"能长时间稳定用":回声消除(外放可用)、断线自动重连、错误
友好提示、资源不泄漏、音频背压不爆内存。

**前置 / Depends on:** Phase 10。

### 做什么 / Tasks
1. **回声消除 / AEC**:
   - 首选浏览器内置:`getUserMedia({ audio: { echoCancellation:true,
     noiseSuppression:true, autoGainControl:true } })`。
   - 不够再考虑服务端 AEC(`speexdsp`/WebRTC APM),或推荐**戴耳机**作兜底。
2. **重连**:WS 掉线 → 前端指数退避重连;UI 显示"reconnecting…";恢复后可继续。
3. **错误**:所有 `error` 帧 → sonner toast(用户可读);后端结构化日志。
4. **背压**:下行音频队列设上限;打断时清队列;防止慢客户端拖垮内存。
5. **资源**:会话结束/断开时释放 buffer、取消任务、关流。

### 交付物 / Deliverables
AEC 约束、重连逻辑、错误 toast、背压限制、清理逻辑。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_reconnect.py  : 模拟 WS 断 → 客户端重连逻辑(前端 vitest 假 WS)
# test_error_toast.py: error frame → 触发 toast (mock)
# test_backpressure.py: 灌入超量音频 → 队列被裁剪/丢旧, 不无限增长
# test_cleanup.py    : end/断开后 任务取消、buffer 释放(无悬挂 task)
pnpm test && make lint && mypy app
```
**Pass 标准:** 上述全绿。
**❌ 注意:回声消除(AEC)效果 Claude 完全测不了**(没有麦克风/扬声器/真实声学
环境)。Claude 只能保证"AEC 约束被正确设置"。**AEC 实际好不好,只能你外放着测。**

### 自动 commit / Auto-commit
`feat(plan-a): phase 11 — AEC constraints, reconnect, error toasts, backpressure`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
1. **外放回声测**:不戴耳机,正常对话几轮 → ✅ 预期:GAEY **不**把自己的声音当
   成你在说话(不自我打断、不自言自语)。效果不行就记下设备/环境给我。
2. **断线重连**:对话中**杀掉后端**(Ctrl-C)→ ✅ UI 显示断开/重连中 → **重启
   后端** → ✅ 能自动恢复连接(或一键重连)。
3. **错误提示**:停掉 Ollama 说一句 → ✅ 看到友好 toast,不是白屏/崩溃。
4. **长时间跑**:连续聊 10 分钟 → ✅ 内存稳定(看任务管理器),不越用越卡。

### ✅ 验收标准 / Acceptance
- [ ] 外放可用(回声可接受;最差也有"建议戴耳机"提示)
- [ ] 断线能重连
- [ ] 错误有友好提示
- [ ] 长时间不泄漏/不爆内存

### 进入下一阶段 / Gate
"Phase 11 过了" → 进 Phase 12。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 外放回声严重 | 开浏览器 AEC;降扬声器音量;终极方案服务端 AEC 或耳机 |
| 重连后状态错乱 | 重连时重置状态机 + 清队列 |
| 内存涨 | 检查背压上限与 buffer 释放 |

---

## Phase 12 — Speech-rate control wiring / 语速控制接通

**目标 / Goal:** 把现有 UI 的**语速滑块**真正接到 Kokoro 的 `speed`。复用
`ConvAI.tsx` 已有滑块(0.7×–1.2×),开始会话时把值带进 `start.config.speed`。

**前置 / Depends on:** Phase 3 (Kokoro speed)、Phase 7 (前端)。

### 做什么 / Tasks
1. 前端:`startSession` 时把滑块值放进 `start` 的 `config.speed`(provider=local)。
2. 后端:`config.speed` 透传到每次 `tts_kokoro.synthesize(..., speed=...)`。
3. (可选)支持**会话中改速**:发一个 `set_speed` 控制帧,下一句起生效。

### 交付物 / Deliverables
滑块→start.config→Kokoro 的打通;(可选)`set_speed`。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_speed_flow.py : start.config.speed=0.7 → 断言 synthesize 收到 speed=0.7
pnpm test            # 前端: 滑块值进入 start payload
make lint && mypy app
```
**Pass 标准:** 全绿(参数透传可确定性测到)。**⚠️ 你测:** 实际听感快慢。

### 自动 commit / Auto-commit
`feat(plan-a): phase 12 — wire speech-rate slider to Kokoro speed`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
1. 滑块拉到 **0.7×**,开始对话,说一句 → ✅ GAEY 明显**说得慢**(适合初学者听清)。
2. 滑块拉到 **1.2×**,重开会话 → ✅ 明显**更快**。
3. (若做了会话中改速)对话中改滑块 → ✅ 下一句起变速。

### ✅ 验收标准 / Acceptance
- [ ] 0.7×/1.0×/1.2× 听感正确
- [ ] 语速变化不破坏音质/字幕

### 进入下一阶段 / Gate
"Phase 12 过了" → 进 Phase 13。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 滑块不起作用 | 确认 provider=local 且值进了 start.config;后端有透传 |
| 变速后失真 | Kokoro speed 范围内调;极端值会怪 |

---
## Phase 13 — Quality mode / model switching / 质量档

**目标 / Goal:** 让你能在"快(小模型)"和"聪明(大模型)"之间切换——你说过**大
参数模型也有 access**。默认 8B 保延迟,需要更地道/更会解释时切大模型。

**前置 / Depends on:** Phase 8(流式,便于感知大模型延迟)。

### 做什么 / Tasks
1. 后端:`LLM_MODEL` 支持任意 Ollama 模型名;`start.config.model` 可覆盖。
2. (可选)STT/TTS 档位:`WHISPER_MODEL` small↔distil-large;voice 切换。
3. 前端:一个"Quality"下拉/开关(Fast / Smart),映射到 `config.model`。
4. 文档:§H.4 / Appendix E 的显存对照,告诉你哪台机器能跑多大。

### 交付物 / Deliverables
模型可配置/可覆盖、前端质量开关、显存对照文档。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
make test
# test_model_override.py : start.config.model="qwen2.5:32b" → 断言请求用了该模型
# test_model_default.py  : 不传则用 .env LLM_MODEL
pnpm test                # 前端开关改变 start.config.model
make lint && mypy app
```
**Pass 标准:** 全绿(选择逻辑可测)。**⚠️ 你测:** 大模型在你硬件上的**真实质量
与延迟**、显存够不够——Claude 容器跑不了大模型。

### 自动 commit / Auto-commit
`feat(plan-a): phase 13 — model switching (fast/smart) + quality toggle`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
1. 先拉大模型(按你显存,见 Appendix E):
   ```bash
   ollama pull qwen2.5:32b        # 或 llama3.1:70b 等你有 access 的
   nvidia-smi                     # 看显存占用(或 Apple 用活动监视器看内存)
   ```
2. 前端把 Quality 切到 **Smart**(或 `.env` 设 `LLM_MODEL`),问一个考验"地道
   俚语解释"的问题,对比 8B:
   - ✅ 预期:回答更细腻/更地道;
   - 📝 代价:延迟更高、显存占用更大——记下是否可接受。
3. 切回 **Fast(8B)** 确认随时能回到低延迟。

### ✅ 验收标准 / Acceptance
- [ ] Fast/Smart 切换生效
- [ ] 大模型在你机器上能跑(显存够)
- [ ] 你清楚每档的"质量 vs 延迟"取舍

### 进入下一阶段 / Gate
"Phase 13 过了" → 进 Phase 14。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 大模型 OOM | 换更小量化(Q4_K_M)、更小模型;或多卡;见 Appendix E |
| 大模型太慢 | 接受为"Smart 档";日常用 Fast |
| 切换不生效 | 确认 config.model 透传 + Ollama 已有该模型 |

---

## Phase 14 — Packaging & one-command run / 打包

**目标 / Goal:** 让"非开发者也能跑起来":尽量一条命令把后端 + 模型 + 前端拉起来,
并写清运行文档。

**前置 / Depends on:** 前面功能完成。

### 做什么 / Tasks
1. **Docker Compose**:`ollama` + `backend`(+ 可选 `frontend`)三服务;首启自动
   `ollama pull`(entrypoint 脚本);GPU passthrough 说明(NVIDIA `--gpus all`;
   Apple 因 Docker 无法直透 GPU → 提供"原生跑"路径)。
2. **原生一键脚本** `run.sh` / `run.ps1`:检测依赖→建 venv→装包→拉模型→并行起
   后端+前端(给不想用 Docker 的人,尤其 Apple Silicon)。
3. **`local-backend/README.md` + 根 `RUNNING.zh-CN.md` 补一节**:Plan A 怎么跑。
4. 健康自检并入启动流程(Phase 0 的 check-prereqs)。

### 交付物 / Deliverables
`docker-compose.yml`、entrypoint 脚本、`run.sh`/`run.ps1`、运行文档。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
docker compose config         # compose 文件合法
bash -n run.sh                # 脚本语法检查
make lint && mypy app && pnpm build
# 若容器允许: docker build backend 镜像(CPU 版)是否能 build 成功(可能受限)
```
**Pass 标准:** compose/脚本语法 + 构建通过。
**⚠️ 你测:** **真正在干净机器上一键拉起**(下载模型、GPU 直透、端到端)只能你测
——这正是打包要验证的核心。

### 自动 commit / Auto-commit
`chore(plan-a): phase 14 — docker-compose, one-command run scripts, docs`

### 🧑 你的手动测试 / Your manual test —— 详细步骤(最好找一台"干净"机器/新用户)
**路径 A — Docker(有 NVIDIA GPU 的 Linux/Win 推荐)**
```bash
git clone <repo> && cd GAEY
cp .env.example .env           # 按需改
docker compose up              # 首次会拉镜像 + 拉模型(慢, 耐心)
# 打开 http://localhost:3000
```
- ✅ 预期:三服务起来,网页能正常语音对话。

**路径 B — 原生一键(Apple Silicon 推荐,GPU 性能最好)**
```bash
./run.sh        # macOS/Linux   (Windows: ./run.ps1)
```
- ✅ 预期:脚本自检→装环境→拉模型→起服务→自动打开浏览器。

**通用验收**:走一遍完整对话(免提、打断、语速、字幕)确认打包版功能不缺。

### ✅ 验收标准 / Acceptance
- [ ] 干净机器上**一条命令**(或很少几步)能跑起来
- [ ] 文档照着做不踩坑
- [ ] GPU 被正确利用(Docker 直透 / 原生)
- [ ] 完整功能在打包版可用

### 进入下一阶段 / Gate
"Phase 14 过了" → 进 Phase 15。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| Docker 里 GPU 没用上 | 装 nvidia-container-toolkit;`--gpus all`;Apple 用原生路径 |
| 首启拉模型超时 | 重试;或先手动 `ollama pull` |
| 端口冲突 | compose 里改映射 |

---

## Phase 15 — Deployment (local / Vercel hybrid) / 部署

**目标 / Goal:** 定下"怎么给真人用"。**重申:这套后端跑不了 Vercel**(serverless
无 GPU、有时长上限、不能常驻 Ollama)。两种现实部署:

- **15A 全本地 / all-local(推荐起步):** 后端 + Ollama + 前端都在你机器;自己
  用,或同局域网设备访问。
- **15B 前端上 Vercel + 后端本地 + 隧道(hybrid):** 前端 Vercel 托管;后端在你
  机器跑;用 **Cloudflare Tunnel / ngrok** 把本地 WS 暴露成一个公网 `wss://`,前端
  用 `NEXT_PUBLIC_LOCAL_WS_URL` 指过去。

**前置 / Depends on:** Phase 14。

### 做什么 / Tasks
1. **15A**:写"局域网访问"说明(`pnpm build && pnpm start`;后端绑 `0.0.0.0`;
   注意非 localhost 下浏览器要 **https/wss** 才给麦克风——给本地 TLS 方案,如
   `mkcert`)。
2. **15B**:
   - 前端 `vercel.json`/env:`NEXT_PUBLIC_CONV_PROVIDER=local` +
     `NEXT_PUBLIC_LOCAL_WS_URL=wss://<your-tunnel>`。
   - 后端隧道脚本(cloudflared)说明 + CORS/Origin 收紧到你的 Vercel 域名。
   - 安全:隧道加访问控制(token/Cloudflare Access),别把本地 LLM 裸奔公网。
3. 文档:两条路径的完整步骤 + 安全注意 + "为什么后端不能在 Vercel"。

### 交付物 / Deliverables
部署文档(15A/15B)、`vercel.json`/env 模板、tunnel 脚本与安全说明。

### 🤖 Claude 自动化测试 / How Claude tests
```bash
pnpm build                         # 前端可构建(指向外部 WS URL)
# 校验: 当 provider=local 时不需要 XI_API_KEY 也能 build
# 校验: vercel.json / env 模板格式
make lint
```
**Pass 标准:** 前端针对外部 WS 的构建通过。
**❌ Claude 不做真实部署/不连你的隧道**(那是你的账号/机器/域名)。Claude 只能
保证"构建与配置正确",**真实公网联通、TLS、麦克风在 https 下可用 只能你测。**

### 自动 commit / Auto-commit
`docs(plan-a): phase 15 — deployment guide (all-local + Vercel hybrid)`

### 🧑 你的手动测试 / Your manual test —— 详细步骤
**15A 全本地**
1. `pnpm build && pnpm start`(前端 prod);后端 `make run`(绑 0.0.0.0)。
2. 本机 http://localhost:3000 走通。
3. (可选)同局域网手机访问你电脑 IP:需 https/wss(用 mkcert 自签)否则麦克风
   被拒——按文档配。

**15B Vercel 混合**
1. 后端本地起 + `cloudflared tunnel --url http://localhost:8000` 拿到一个
   `https://xxx.trycloudflare.com`(对应 `wss://xxx.trycloudflare.com/ws`)。
2. Vercel 项目 env 设 `NEXT_PUBLIC_LOCAL_WS_URL=wss://xxx.../ws`,部署。
3. 打开你的 `*.vercel.app` → ✅ 预期:网页在公网,但语音其实跑在你本地机器;能
   正常对话。
4. ✅ 安全检查:后端 CORS/Origin 只放行你的 Vercel 域名;隧道有访问控制。

### ✅ 验收标准 / Acceptance
- [ ] 15A 本地/局域网可用(麦克风在 https/localhost 下正常)
- [ ] (如需)15B:Vercel 前端 + 本地后端经隧道打通
- [ ] 安全:后端不对公网裸奔
- [ ] 文档清楚解释"后端为何不能上 Vercel"

### 进入下一阶段 / Gate
全部 phase 完成 🎉 → Plan A 可用。后续进入"日常使用 + 按需优化"。

### 常见问题 / Troubleshooting
| 现象 | 解决 |
| --- | --- |
| 局域网/公网下点不了麦克风 | 浏览器要求 https(或 localhost);配 mkcert/真证书 |
| Vercel 前端连不上后端 | 隧道挂了/URL 错/CORS 没放行 vercel 域名;用 `wss://` |
| 隧道暴露有风险 | 加 Cloudflare Access / token;限流;别放敏感数据 |
| 想完全公网托管后端 | 那就不是"免费本地"了 → 租 GPU VM(脱离 Plan A 初衷,见 cost 文档) |

---
## Appendix A — 命令速查 / Command cheat-sheet

**Backend (`local-backend/`, venv activated):**
```bash
make setup        # create venv + install deps
make run          # uvicorn app.main:app --reload --port 8000
make test         # pytest (mocks; no real models)         ← Claude's gate
make test-live    # pytest -m live (needs real Ollama/models) ← you run
make lint         # ruff check
make fmt          # ruff format
make smoke-tts    # real Kokoro smoke (if installable)
make smoke-stt    # real Whisper smoke on fixture
# demo scripts:
python scripts/check-prereqs.sh
python scripts/say.py "<text>" out.wav [speed]
python scripts/transcribe.py <wav>
python scripts/record.py [sec] out.wav
python scripts/vad_demo.py
python scripts/chat_repl.py
python scripts/ptt_client.py
python scripts/ws_smoke.py
python scripts/latency_probe.py
```

**Frontend (repo root):**
```bash
pnpm dev          # dev server :3000
pnpm build        # prod build                              ← Claude's gate
pnpm start        # serve prod build
pnpm lint         # eslint
pnpm exec tsc --noEmit   # type-check                       ← Claude's gate
pnpm test         # vitest (hook logic, fake WS)            ← Claude's gate
```

---

## Appendix B — 硬件选型 / Hardware sizing reference

> 经验值,实际随量化/上下文长度浮动。**对话场景:延迟体验 > 模型再大一点。**

**LLM (Ollama, Q4_K_M 量化):**
| 模型 | 磁盘 | 运行内存/显存 | 适合 |
| --- | --- | --- | --- |
| `llama3.1:8b` / `qwen2.5:7b` | ~4.7 GB | ~6–8 GB | **默认**,延迟好;8GB 显存 / Apple M1+ 16GB |
| `qwen2.5:14b` | ~9 GB | ~12–14 GB | 更聪明,仍可实时 |
| `qwen2.5:32b` | ~20 GB | ~20–24 GB | Smart 档;24GB 卡(4090/3090) |
| `llama3.1:70b` / `qwen2.5:72b` | ~40 GB | ~40–48 GB | 接近云端;1×48GB 或 2×24GB / A100 |

**STT (faster-whisper):** `tiny/base` CPU 实时;`small.en` CPU 勉强/GPU 流畅;
`distil-large-v3`/`large-v3` 建议 GPU。**TTS (Kokoro):** 82M,CPU 近实时,几乎不挑卡。
**VAD (Silero):** 极小,CPU 无压力。

**最低可用 / Minimum:** 纯 CPU + 8B + base.en + Kokoro 能跑,但延迟偏高。
**舒适 / Comfortable:** 一张 ≥8GB NVIDIA 卡,或 Apple Silicon(M1 Pro/Max 16–32GB)。
**爽 / Great:** 24GB 卡跑 14b/32b。

---

## Appendix C — 提交与状态规范 / Commit & status conventions

- **分支 / Branch:** `gaey-free`(默认)。**改完即 commit,不 push 除非你说 push。**
- **署名 / Attribution:**
  `--author="aevum-orrin <272573266+aevum-orrin@users.noreply.github.com>"`;
  committer = `Claude <noreply@anthropic.com>`(Verified);trailer
  `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **每个 phase 两类 commit:**
  1. 实现 + 🤖 自动测试通过 → `feat/chore/docs(plan-a): phase N — ...`
  2. 同一 commit 里更新 §0.2 状态表(该 phase → 🤖)。
- **你验收后:** 你说"Phase N 过了",Claude 把状态表该 phase → ✅ 并开始 N+1。
- **commit message 全英文**;只描述事实与测试结果(失败就如实写)。

---

## Appendix D — 回滚 / 安全网 / Rollback & safety net

- **永远有绿色可用态:** `NEXT_PUBLIC_CONV_PROVIDER=elevenlabs` 一键切回原版。
- 每个 phase 自成 commit → 可 `git revert` 单个 phase。
- 后端是**独立目录 `local-backend/`** + 独立依赖,不污染现有 Next.js 构建;不启用
  时对现有 app 零影响。
- `.env` 不提交;`.env.example` 跟随更新。

---

## Appendix E — 待你拍板的决策 / Open decisions（先不阻塞,做到相应 phase 再定）

1. **后端语言:** 计划用 **Python**(模型生态最好)。你若强烈想要全 TS/Node 栈,
   告诉我(代价:STT/TTS/VAD 绑定更折腾)。
2. **默认 voice:** Phase 3 你试听后选一个 Kokoro voice 作默认。
3. **默认模型档:** 默认 `llama3.1:8b`;你有大模型 access,要不要把 "Smart 档"
   默认设成某个具体大模型?(看你常用机器显存)
4. **STT 语言锁定:** 学英语 → 默认 `language="en"`(更准)。是否也想支持中文提问?
5. **部署形态:** 起步 **15A 全本地**?还是要直接做 **15B Vercel 混合**?
6. **PTT vs 免提:** 先交付到 Phase 7(PTT)就够你早期试用,还是一口气做到 Phase 9
   免提再给你大测?(建议:Phase 7 先体验一次,早反馈)

> 这些不影响现在开工。**Phase 0 不依赖任何一条决策。** 我会在相应 phase 前用
> 一句话跟你确认。

---

## Appendix F — 整套完成的标准 / Definition of done (whole Plan A)

- [ ] 浏览器里**免提**和 GAEY 自然语音对话(听得清的美音、可调速)。
- [ ] **打断**顺滑;延迟可接受(说完 ~1.5s 内开口,视硬件)。
- [ ] 双向**字幕**;状态/波形 UI 复用原版。
- [ ] **零按量费用**(本地模型);可离线;数据不出本机。
- [ ] 一条命令在干净机器上跑起来;有清晰中英文档。
- [ ] feature flag 可随时切回 ElevenLabs。
- [ ] 全部 16 个 phase 你都已 ✅ 验收。

---

## Appendix G — 术语表 / Glossary

| 术语 | 含义 |
| --- | --- |
| **STT** | Speech-to-Text,语音转文字(Whisper) |
| **LLM** | 大语言模型(本地经 Ollama 跑 Llama/Qwen) |
| **TTS** | Text-to-Speech,文字转语音(Kokoro) |
| **VAD** | Voice Activity Detection,判断"有没有人在说话"(Silero) |
| **Endpointing** | 判断"用户这句说完了"(静默够久) |
| **Barge-in** | 打断:AI 说话时用户插嘴,AI 立即停 |
| **AEC** | Acoustic Echo Cancellation,回声消除(防麦克风听到自己喇叭) |
| **PTT** | Push-to-Talk,按住说话 |
| **Time-to-first-audio** | 用户说完到 AI 第一声的延迟(核心体验指标) |
| **Ollama** | 本地跑开源 LLM 的运行时(`:11434`) |
| **Feature flag** | `NEXT_PUBLIC_CONV_PROVIDER`,在 ElevenLabs / local 间切换 |

---

> **下一步 / Next:** 等你说"开始 Phase 0",我就实现 Phase 0、跑 🤖 自动测试、
> 自动 commit(不 push),然后把"你的手动测试步骤"再贴一遍给你执行。每个 phase
> 都这么走,直到你 ✅ 全部验收。
