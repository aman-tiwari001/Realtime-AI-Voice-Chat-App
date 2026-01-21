# Aura Voice AI

A real-time voice to voice companion which speak naturally like humans.

<img width="160" height="400" alt="image" src="https://github.com/user-attachments/assets/150a834c-6eb4-44ff-8efd-f496ee055704" />
<img width="160" height="400" alt="image" src="https://github.com/user-attachments/assets/f27ab969-8b2a-4c1d-b1cf-333618cb517a" />



---

## 🚀 How to Run

### Prerequisites

- Node.js 18+
- Expo Go Mobile App
- API Keys: `GROQ_API_KEY`, `ELEVENLABS_API_KEY`

### Backend

```bash
cd backend
npm install
# Create .env file with:
# GROQ_API_KEY=your_key
# ELEVENLABS_API_KEY=your_key
# PORT=5000
npm run dev
```

### Mobile App

```bash
cd mobile-app
npm install
# Create .env file with:
# EXPO_PUBLIC_WEBSOCKET_URL=ws://localhost:5000
npm run start

# Open Expo Go app on your phone and scan the QR code from the terminal
# Start using the app!
```

---

## 🏗️ Architecture

```
┌─────────────────┐          WebSocket          ┌─────────────────────────────────┐
│   Mobile App    │◄──────────────────────────►│           Backend               │
│   (Expo/React   │      Binary Audio +         │       (Node.js + WS)            │
│    Native)      │      JSON Messages          │                                 │
└─────────────────┘                             └────────────┬────────────────────┘
                                                             │
                                    ┌────────────────────────┼────────────────────────┐
                                    │                        │                        │
                                    ▼                        ▼                        ▼
                            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
                            │  ElevenLabs  │        │     Groq     │        │  ElevenLabs  │
                            │     STT      │        │     LLM      │        │     TTS      │
                            │  (Scribe v2) │        │ (Llama 3.3/  │        │              │
                            │              │        │  GPT OSS)    │        │  (Streaming) │
                            └──────────────┘        └──────────────┘        └──────────────┘
```

**Flow:** User speaks → Audio is recorded and sent via WebSocket to server → STT transcribes → LLM generates response → TTS streams audio back → Audio is played on mobile app → User hears response

---

## ⚡ Latency Approach

### What is Optimized?

| Optimization                              | Why                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| **Groq LLM (Llama 3.3 70B)**              | Fastest inference provider (~200-400ms for short responses)            |
| **ElevenLabs Scribe v2**                  | Low-latency STT model optimized for real-time                          |
| **Streaming TTS**                         | Audio chunks sent as they're generated, not waiting for full synthesis |
| **WebSocket (persistent)**                | Eliminates HTTP connection overhead per request                        |
| **Raw WebSocket library (ws)**                | Eliminates the overhead and abstraction of higher-level libraries eg. Socket.io      |
| **Non-streaming LLM for short responses** | For voice AI, full response is often faster than streaming overhead    |
| **Binary audio over WebSocket**           | Minimal encoding overhead for audio data                               |
| **Low-quality recording preset**          | 16kHz mono @ 128kbps — fast to encode & transmit                       |

### Latency Breakdown

| Stage                           | Typical Time  |
| ------------------------------- | ------------- |
| Audio Recording + Send          | ~100-200ms    |
| STT (ElevenLabs Scribe)         | ~400-800ms    |
| LLM Response (Groq)             | ~200-500ms    |
| TTS First Chunk                 | ~500-2000ms   |
| **Total (Time to First Audio)** | **Upto 5s** |

##### Avg Latency: 2-3s
---

## 📊 Latency Measurement

Latency is measured **end-to-end** from recording stop to first audio playback programmatically in the mobile app:

**Displayed in UI:** Real-time latency shown after each interaction.

---

## 🔮 Future Improvements

Given more time, I would:

1. **Implement streaming LLM → TTS pipeline** — Stream sentences to TTS as LLM generates them (already have `groqChatStream` ready)
2. **Add VAD (Voice Activity Detection)** — Auto-detect speech end instead of push-to-talk
3. **Client-side audio chunking** — Stream audio during recording for faster STT start
4. **Optimize latency further** — Identify and reduce bottlenecks in each stage carefully
5. **Audio compression** — Implement more efficient audio codecs for lower bandwidth
6. **Preemptive TTS warming** — Pre-initialize TTS connection to reduce first-chunk latency
7. **Edge deployment** — Deploy backend closer to user for reduced network latency

---

## 📁 Project Structure

```
├── backend/                 # Node.js WebSocket server
│   └── src/
│       ├── index.ts         # WebSocket server & message handling
│       ├── constant.ts      # System prompt for Aura personality
│       └── services/
│           ├── stt.ts       # ElevenLabs Speech-to-Text
│           ├── llm.ts       # Groq LLM (Llama 3.3)
│           ├── tts.ts       # ElevenLabs Text-to-Speech (streaming)
│           └── context.ts   # Conversation history management
│
└── mobile-app/              # Expo React Native app
    └── app/
        └── index.tsx        # Main voice interface
```

---

## 🛠️ Tech Stack

- **Mobile:** Expo, React Native, expo-audio
- **Backend:** Node.js, WebSocket (ws), TypeScript
- **STT:** ElevenLabs Scribe v2
- **LLM:** Groq (Llama 3.3 70B / GPT OSS)
- **TTS:** ElevenLabs Multilingual v2 (Streaming)
