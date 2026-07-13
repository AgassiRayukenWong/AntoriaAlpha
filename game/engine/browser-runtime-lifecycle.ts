import type { GameRuntime } from './game-runtime';

export interface RuntimeVisibilityDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface BrowserRuntimeLifecycleOptions {
  readonly document: RuntimeVisibilityDocument;
  readonly runtime: GameRuntime;
}

export class BrowserRuntimeLifecycle {
  private readonly document: RuntimeVisibilityDocument;
  private readonly runtime: GameRuntime;

  public constructor(options: BrowserRuntimeLifecycleOptions) {
    this.document = options.document;
    this.runtime = options.runtime;
  }

  public start(): void {
    this.document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    this.handleVisibilityChange();
  }

  public stop(): void {
    this.document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
  }

  private readonly handleVisibilityChange = (): void => {
    if (this.document.visibilityState === 'hidden') {
      this.runtime.pause();
      return;
    }

    this.runtime.resume();
  };
}
