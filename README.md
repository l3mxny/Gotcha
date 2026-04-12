# Gotcha 

> **Empowering cameras to intervene intelligently, not just record.**

Small businesses and independent vendors are frequently left vulnerable to theft because they lack the budget and space for traditional, industrial-scale CCTV systems. We built Gotcha to bridge the gap between those expensive security networks and having no protection at all — providing every business owner with an accessible, affordable tool to secure their livelihood.

---

## Architecture

```
Camera (laptop webcam / IP cam)
    ↓ MJPEG frames
Backend (Flask + SocketIO) ← ngrok tunnel → Internet
    ↓ WebSocket
Frontend (React/Vite) ← deployed on Vercel → gotchalive.us
```

- **ML Model**: Roboflow `shoplifting-xwimk` v1 — returns class `0` (normal) or `1` (theft) with confidence score
- **Risk Score**: `class '1' → confidence`, `class '0' → 1 - confidence`
- **Alert threshold**: risk score > 0.50 in 2 of last 5 frames triggers evidence save + alert
- **TTS**: ElevenLabs generates MP3 → Twilio plays it on outbound phone call
- **Evidence**: SQLite DB + JPEG frames stored in `backend/evidence/`

---

## Project Structure

```
Gotcha/
├── backend/
│   ├── server.py              # Flask app, SocketIO, detection endpoint, evidence API
│   ├── detector.py            # Roboflow inference wrapper
│   ├── call911_api.py         # Blueprint: /api/call-911/start, /api/twilio/token, /api/twilio/voice
│   ├── call911_state.py       # In-memory session store for call audio URLs
│   ├── services/
│   │   ├── gemini_service.py  # Gemini AI — generates emergency message from evidence frames
│   │   ├── elevenlabs_service.py  # ElevenLabs TTS — synthesizes MP3
│   │   ├── twilio_service.py  # Twilio Voice access token generation
│   │   └── env_config.py      # Env var loading + validation
│   ├── evidence/              # Saved incident frame folders (auto-created)
│   ├── evidence.db            # SQLite database (auto-created)
│   ├── static/generated_audio/  # Temp MP3 files for Twilio (auto-cleaned)
│   └── .env                   # Environment variables (see below)
│
└── frontend/
    ├── src/
    │   ├── App.tsx            # Root: socket connection, page routing, alert logic
    │   ├── pages/
    │   │   ├── Home.tsx       # Live detection view: watchlist + video feed
    │   │   └── Evidence.tsx   # Evidence log: incident list, frame viewer, delete
    │   ├── components/
    │   │   ├── CustomerWatchlist.tsx   # Risk score table
    │   │   ├── ThreatVideoPanel.tsx    # Live canvas video overlay
    │   │   ├── EmergencyCallButton.tsx # Alert Security button
    │   │   └── WatchlistRow.tsx        # Single row in watchlist
    │   └── lib/
    │       ├── twilioVoice.ts          # Twilio Voice SDK browser client
    │       └── call911Api.ts           # API calls to /api/call-911 endpoints
    └── .env                   # VITE_BACKEND_URL (for local dev)
```

---

## Setup

### Prerequisites

- Python 3.11
- Node.js 18+
- ngrok account with a static domain
- Accounts: Roboflow, Twilio, ElevenLabs, Google Gemini

### Backend

```bash
cd backend
source ../.venv311/bin/activate   # NOTE: use .venv311, not .venv
pip install -r requirements.txt
```

Create `backend/.env`:

```env
ROBOFLOW_API_KEY=your_key
GEMINI_API_KEY=your_key

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_CALLER_ID=+1XXXXXXXXXX          # Your Twilio number
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

ELEVENLABS_API_KEY=sk_your_key
ELEVENLABS_VOICE_ID=your_voice_id

FRIEND_PHONE_NUMBER=+1XXXXXXXXXX       # Number to call on alert

PUBLIC_BASE_URL=https://your-ngrok-domain.ngrok-free.app
```

Run backend:

```bash
python server.py
```

### ngrok Tunnel

```bash
ngrok http --domain=your-static-domain.ngrok-free.app 5001
```

The static domain keeps the URL consistent across restarts.

### Frontend (local dev)

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=https://your-static-domain.ngrok-free.app
```

```bash
npm run dev
```

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import project in Vercel, set **Root Directory** to `frontend`
3. Add environment variable: `VITE_BACKEND_URL=https://your-ngrok-domain.ngrok-free.app`
4. Deploy

### Custom Domain (gotchalive.us via Porkbun)

DNS records to add in Porkbun:

| Type  | Host | Answer             |
|-------|------|--------------------|
| A     | (blank) | 76.76.21.21     |
| CNAME | www  | cname.vercel-dns.com |

Then in Vercel → Project Settings → Domains → add `gotchalive.us` and `www.gotchalive.us`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/detect` | Submit a camera frame for inference |
| GET | `/evidence` | List all recorded incidents |
| GET | `/evidence/<id>/frames` | Get base64 frames for an incident |
| DELETE | `/evidence/<id>` | Delete an incident and its frames |
| POST | `/trigger-alert` | Trigger outbound Twilio phone call |
| GET | `/api/call-911/status` | Check env config for call system |
| POST | `/api/call-911/start` | Generate TTS audio + return session ID |
| GET | `/api/twilio/token` | Issue Twilio Voice browser token |
| POST | `/api/twilio/voice` | TwiML webhook for outbound call leg |
| POST | `/api/twilio/callee-answer` | TwiML webhook — plays MP3 to callee |
| GET | `/health` | Health check |

WebSocket events (SocketIO):
- `detection` — emitted each frame: `{ predictions, alert, frame (base64) }`
- `alert` — emitted on new theft incident: `{ time, confidence, timestamp, description }`

---

## Demo Mode

Add `?demo=theft` to the URL to show a mock high-risk customer without a live camera feed. Useful for UI demos.

---

## Risk Score Color Coding

| Score | Color | Meaning |
|-------|-------|---------|
| 75–100% | Red | High theft risk |
| 50–74% | Yellow | Elevated risk |
| 0–49% | Green | Normal |
