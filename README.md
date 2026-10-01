# Word Duel Online

Word Duel is a browser-based, two-player word-building game inspired by the classic QWERTY-style format. This repository contains the first online multiplayer prototype: one player creates a private room, receives a five-character room code, and a second player joins from another browser or device.

## Current features

- Two-device real-time multiplayer using Socket.IO
- Private five-character room codes
- 11 × 11 word board with bonus star squares
- Seven-tile player racks and blank/wild tiles
- Drag-and-drop placement in the browser
- Reposition unsubmitted tiles before playing a word
- Server-side turn, rack, tile-bag, scoring, and dictionary validation
- 10 points per letter in each newly formed word
- 50-point bonus for each newly covered star square
- Configurable winning score
- Optional 30-second, 60-second, 2-minute, or 5-minute turn timers
- Exchange and pass actions
- Large bundled English word list for offline/server-side validation

## Requirements

- Node.js 20 or newer recommended
- npm

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in a browser. To test multiplayer on one computer, open the site in two browser windows. Player 1 creates a room and Player 2 joins with the displayed room code.

The server also exposes a health endpoint at `GET /health`.

## Deploy to Railway

This repository includes `railway.json`. Railway can build and run it without a custom Dockerfile.

1. Create a new GitHub repository and upload/push all files in this folder.
2. In Railway, create a **New Project** and choose **Deploy from GitHub repo**.
3. Select the Word Duel repository.
4. Railway should detect Node.js and run `npm start` automatically. The included `railway.json` explicitly sets the start command and `/health` health check.
5. In the Railway service, open **Settings / Networking** and generate a public domain.
6. Open the generated `*.up.railway.app` address on two devices.
7. On Device 1, create a game. On Device 2, enter the room code and join.

No application environment variables are required. Railway supplies the `PORT` variable automatically.

## Repository structure

```text
.
├── public/
│   ├── app.js          # Browser multiplayer/game UI logic
│   ├── index.html      # Game page
│   └── style.css       # Game styling
├── english_words.txt   # Bundled validation word list
├── server.js           # Express + Socket.IO authoritative game server
├── package.json        # Node dependencies and start script
├── railway.json        # Railway build/deploy configuration
├── .env.example        # Optional local PORT example
└── .gitignore
```

## Multiplayer architecture

The browser sends proposed moves to the Node.js server over Socket.IO. The server owns the authoritative room state, tile bag, racks, board, scores, current turn, dictionary checks, and timer deadline. Each player receives only their own rack in the public game state.

Rooms currently live in server memory. A server restart will therefore end active games. Persistent rooms, reconnection tokens, accounts, matchmaking, and a database can be added in a later release.

## Dictionary note

The included word list is a broad English validation list, not a licensed copy of Merriam-Webster. Before a commercial release, the accepted-word policy and dictionary licensing/source should be reviewed and finalized.

## Production notes

This is a Version 1 multiplayer prototype. Before a public commercial launch, recommended additions include persistent game storage, reconnection handling, rate limiting, abuse protection, automated tests, stronger room-code entropy, monitoring, and a formal dictionary policy/license.
