import { Injectable } from '@angular/core';

// MSc chess backend on a Hugging Face Space.
export const API_BASE = 'https://heigon77-chess-vision-backend.hf.space';

export interface DigitizeResponse {
  raw_placement: string;
  placement: string; // sanitized (playable)
  fen: string;
  corrections: string[];
  valid: boolean;
}

export interface PredictResponse {
  fen: string;
  turn: 'white' | 'black';
  cnn: string[];
  stockfish: string[];
  hybrid: string[];
}

@Injectable({ providedIn: 'root' })
export class ChessApiService {
  /** Upload a board image → FEN of the detected position. */
  async digitize(file: File): Promise<DigitizeResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/digitize`, { method: 'POST', body: form });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => null))?.detail ?? `digitize ${res.status}`);
    }
    return res.json();
  }

  /** Ask the models for the moves to play from a position. */
  async predictMove(fen: string, topN = 3): Promise<PredictResponse> {
    const res = await fetch(`${API_BASE}/predict-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, top_n: topN }),
    });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => null))?.detail ?? `predict ${res.status}`);
    }
    return res.json();
  }
}
