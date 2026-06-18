# ♟️ Chess Vision — Frontend

Angular UI for my MSc project: **upload a chess board image, digitize it to a
position, and play it against the move-prediction models** (CNN human-move
prediction + Stockfish).

Talks to the FastAPI backend on a Hugging Face Space.

## Flow
1. Upload a board image → `POST /digitize` → the detected position (FEN).
2. Pick your color (White / Black).
3. Play on the board (chessground + chess.js); after each of your moves the
   backend (`POST /predict-move`) replies with the model's move.
4. Switch the engine: **Hybrid** (human + engine), **CNN** (human-like), **Stockfish**.

The board is shown exactly as digitized (no editing). If the digitized position
isn't a legal chess position, it asks for another image.

## Configure the backend URL
`src/app/chess-api.service.ts`:
```ts
export const API_BASE = 'https://heigon77-chess-vision-backend.hf.space';
```

## Run locally
```bash
npm install
npm start            # http://localhost:4200
```

## Build & deploy (Cloudflare Pages)
```bash
npm run build        # outputs to dist/Chess-Vision-Frontend/browser
```
On Cloudflare → Pages → Connect to Git:
- **Framework preset:** Angular
- **Build command:** `npm run build`
- **Build output directory:** `dist/Chess-Vision-Frontend/browser`

Built with Angular 21 · [chessground](https://github.com/lichess-org/chessground) · [chess.js](https://github.com/jhlywa/chess.js).
