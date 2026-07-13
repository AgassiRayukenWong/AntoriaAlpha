import { describe, expect, it, vi } from 'vitest';

import {
  BrowserRuntimeLifecycle,
  type RuntimeVisibilityDocument,
} from '@/game/engine/browser-runtime-lifecycle';
import type { GameRuntime } from '@/game/engine/game-runtime';

const createRuntime = (): Pick<GameRuntime, 'pause' | 'resume'> => ({
  pause: vi.fn(),
  resume: vi.fn(),
});

describe('BrowserRuntimeLifecycle', () => {
  it('pauses the runtime when the document is hidden', () => {
    const runtime = createRuntime();
    const lifecycle = new BrowserRuntimeLifecycle({
      document: createDocument('hidden'),
      runtime: runtime as GameRuntime,
    });

    lifecycle.start();

    expect(runtime.pause).toHaveBeenCalledOnce();
    expect(runtime.resume).not.toHaveBeenCalled();
  });

  it('resumes the runtime when the document is visible', () => {
    const runtime = createRuntime();
    const lifecycle = new BrowserRuntimeLifecycle({
      document: createDocument('visible'),
      runtime: runtime as GameRuntime,
    });

    lifecycle.start();

    expect(runtime.resume).toHaveBeenCalledOnce();
    expect(runtime.pause).not.toHaveBeenCalled();
  });

  it('removes the visibility listener when stopped', () => {
    const document = createDocument('visible');
    const lifecycle = new BrowserRuntimeLifecycle({
      document,
      runtime: createRuntime() as GameRuntime,
    });

    lifecycle.start();
    lifecycle.stop();

    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});

const createDocument = (
  visibilityState: DocumentVisibilityState,
): RuntimeVisibilityDocument => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState,
});
