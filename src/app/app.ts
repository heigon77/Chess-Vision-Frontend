import {
  AfterViewInit, Component, ElementRef, inject, signal, viewChild,
} from '@angular/core';
import { Chess } from 'chess.js';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Color, Key } from 'chessground/types';

import { ChessApiService } from './chess-api.service';

type Engine = 'cnn' | 'stockfish' | 'hybrid';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit {
  private api = inject(ChessApiService);
  private boardEl = viewChild<ElementRef<HTMLElement>>('board');

  private chess = new Chess();
  private cg?: Api;

  readonly digitized = signal('');        // placement-only FEN from /digitize
  readonly started = signal(false);
  readonly userColor = signal<Color>('white');
  readonly engine = signal<Engine>('hybrid');
  readonly status = signal('Upload a chess board image to begin.');
  readonly loading = signal(false);
  readonly thinking = signal(false);
  readonly lastAi = signal('');

  ngAfterViewInit(): void {}

  // ── upload + digitize ──
  async onFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading.set(true);
    this.status.set('Reading the board…');
    try {
      const res = await this.api.digitize(file);
      this.digitized.set(res.placement);
      const n = res.corrections.length;
      this.status.set(
        n > 0
          ? `Board detected (fixed ${n} digitization ${n === 1 ? 'issue' : 'issues'}). Pick your color.`
          : 'Board detected. Pick your color to start.',
      );
    } catch (e) {
      this.status.set('Could not read the board: ' + (e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  // ── start a game with the digitized position ──
  start(color: Color): void {
    this.userColor.set(color);
    try {
      this.chess.load(this.digitized() + ' w - - 0 1'); // white moves first
    } catch {
      this.status.set('That digitized position is not playable. Try another image.');
      return;
    }
    this.started.set(true);
    queueMicrotask(() => {
      this.mount();
      if (color === 'black') this.aiMove(); // AI is white → moves first
      else this.refresh();
    });
  }

  private mount(): void {
    const el = this.boardEl()?.nativeElement;
    if (!el) return;
    this.cg = Chessground(el, this.config());
  }

  private config(): Config {
    return {
      fen: this.chess.fen(),
      orientation: this.userColor(),
      turnColor: this.turnColor(),
      movable: {
        free: false,
        color: this.movableColor(),
        dests: this.dests(),
        events: { after: (orig, dest) => this.onUserMove(orig as string, dest as string) },
      },
      animation: { enabled: true, duration: 200 },
    };
  }

  private turnColor(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  private movableColor(): Color | undefined {
    return !this.chess.isGameOver() && this.turnColor() === this.userColor()
      ? this.userColor() : undefined;
  }

  private dests(): Map<Key, Key[]> {
    const m = new Map<Key, Key[]>();
    for (const mv of this.chess.moves({ verbose: true }) as { from: string; to: string }[]) {
      const arr = m.get(mv.from as Key);
      if (arr) arr.push(mv.to as Key);
      else m.set(mv.from as Key, [mv.to as Key]);
    }
    return m;
  }

  private refresh(): void {
    this.cg?.set({
      fen: this.chess.fen(),
      turnColor: this.turnColor(),
      check: this.chess.inCheck(),
      movable: { color: this.movableColor(), dests: this.dests() },
    });
    if (this.chess.isGameOver()) this.status.set(this.gameOverText());
  }

  // ── user makes a move → AI replies ──
  private async onUserMove(orig: string, dest: string): Promise<void> {
    const move = this.chess.move({ from: orig, to: dest, promotion: 'q' });
    if (!move) return;
    this.refresh();
    if (!this.chess.isGameOver()) await this.aiMove();
  }

  private async aiMove(): Promise<void> {
    if (this.chess.isGameOver()) {
      this.status.set(this.gameOverText());
      return;
    }
    this.thinking.set(true);
    this.status.set('The model is thinking…');
    try {
      const res = await this.api.predictMove(this.chess.fen(), 3);
      const moves = res[this.engine()];
      const uci = moves?.[0] ?? res.hybrid?.[0] ?? res.cnn?.[0];
      if (!uci) {
        this.status.set('No move returned.');
        return;
      }
      this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: (uci[4] as any) || 'q' });
      this.lastAi.set(uci);
      this.refresh();
      if (!this.chess.isGameOver()) this.status.set('Your move.');
    } catch (e) {
      this.status.set('Model error: ' + (e as Error).message);
    } finally {
      this.thinking.set(false);
    }
  }

  private gameOverText(): string {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
      return `Checkmate — ${winner} wins.`;
    }
    if (this.chess.isStalemate()) return 'Stalemate.';
    if (this.chess.isDraw()) return 'Draw.';
    return 'Game over.';
  }

  reset(): void {
    this.started.set(false);
    this.cg?.destroy();
    this.cg = undefined;
    this.lastAi.set('');
    this.status.set('Upload a chess board image to begin.');
    this.digitized.set('');
  }
}
