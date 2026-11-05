/**
 * Platform bridge.
 *
 * The product targets the Nitro by Overwolf overlay. Inside Overwolf the global
 * `overwolf` object exposes hotkey registration and logging; in a normal browser
 * (this preview) we fall back to a keyboard shortcut and console logging so the
 * same build stays testable. Nothing here fakes a native feature: the overlay
 * hotkey is only registered when the Overwolf API actually exists.
 */

type OverwolfHotkey = { name: string; key: string };

type OverwolfApi = {
  settings?: {
    registerHotKey?: (
      name: string,
      callback: () => void,
      success?: (result: unknown) => void,
      failure?: (error: unknown) => void,
    ) => void;
    unregisterHotKey?: (name: string) => void;
    [key: string]: unknown;
  };
  log?: { log?: (level: string, message: string) => void };
  [key: string]: unknown;
};

function overwolf(): OverwolfApi | null {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { overwolf?: OverwolfApi }).overwolf;
  return api && typeof api === 'object' ? api : null;
}

export const isOverwolfHost = (): boolean => overwolf() !== null;

export const OVERLAY_HOTKEY: OverwolfHotkey = { name: 'ramayana_toggle_overlay', key: 'Ctrl+Tab' };

/** Returns true when a real Overwolf hotkey was registered. */
export function registerOverlayHotkey(onToggle: () => void): boolean {
  const api = overwolf();
  if (!api?.settings?.registerHotKey) return false;
  try {
    api.settings.registerHotKey(OVERLAY_HOTKEY.name, onToggle);
    return true;
  } catch {
    return false;
  }
}

export function unregisterOverlayHotkey(): void {
  try {
    overwolf()?.settings?.unregisterHotKey?.(OVERLAY_HOTKEY.name);
  } catch {
    /* ignore */
  }
}

export function logError(message: string, detail?: unknown): void {
  const api = overwolf();
  if (api?.log?.log) {
    try {
      api.log.log('error', `${message}${detail ? ` :: ${String(detail)}` : ''}`);
      return;
    } catch {
      /* fall through */
    }
  }
  // eslint-disable-next-line no-console
  console.error(`[Ramayana] ${message}`, detail ?? '');
}
