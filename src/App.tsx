import { FormEvent, useEffect, useRef, useState } from 'react';
import { InventoryPanel } from './components/InventoryPanel';
import { LocationsPanel } from './components/LocationsPanel';
import { FishingAdminTools } from './components/FishingAdminTools';
import {
  defaultFishingSoundPreferences,
  fishingSoundStorageKey,
  readFishingSoundPreferences,
  saveFishingSoundPreferences,
  type FishingSoundPreferences,
} from './audio/fishingSoundPreferences';
import { prepareReelPromptSound, stopReelPromptSound } from './audio/reelPrompt';
import { prepareFishCatchSound, stopFishCatchSound } from './audio/fishCatch';
import type { PublicWorldSnapshot } from '../server/seaState';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

type ServerState = 'checking' | 'online' | 'offline';
interface Character {
  id: string;
  name: string;
  credits: number;
  hp: number;
  maxHp: number;
  characterXp: number;
  characterLevel: number;
  currentLocation: string;
  currentLocationId: string;
  activeStatus: string;
}
interface Session {
  authenticated: boolean;
  account?: { username: string };
  character?: Character | null;
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body
        ? (body as { error: { message: string } }).error.message
        : 'The request could not be completed.';
    throw new Error(message);
  }
  return body as T;
}

function NavigationIcon({
  name,
}: {
  name: 'world' | 'pack' | 'pin' | 'account' | 'atlas' | 'tools';
}) {
  const paths = {
    world: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.7 5.7l12.6 12.6M18.3 5.7 5.7 18.3" />
      </>
    ),
    pack: (
      <>
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2M4 12h16" />
      </>
    ),
    pin: (
      <>
        <path d="M8 3h8l-1 6 3 4H6l3-4-1-6ZM12 13v8" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    atlas: (
      <>
        <path d="m12 2 8 5v12l-8 3-8-3V7l8-5ZM12 2v20M4 7l8 4 8-4" />
      </>
    ),
    tools: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="10" cy="17" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg
      className="command-icon"
      data-icon={name}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function ResourceIcon({ name }: { name: 'health' | 'xp' | 'credits' | 'activity' | 'time' }) {
  const paths = {
    health: (
      <path d="M12 21s-8-4.7-8-10.4A4.6 4.6 0 0 1 12 7.5a4.6 4.6 0 0 1 8 3.1C20 16.3 12 21 12 21Z" />
    ),
    xp: <path d="m12 2 2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2Z" />,
    credits: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5c-1-1.2-5-1.5-6.4.2-2.4 3 4.9 2.2 5.4 4.7.5 2.5-3.1 3.7-6 2M12 5v14" />
      </>
    ),
    activity: <path d="M3 16c3-4 6 4 9 0s6 4 9 0M3 10c3-4 6 4 9 0s6 4 9 0" />,
    time: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  };
  return (
    <svg
      className={`resource-icon resource-icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function FishingSoundControls({
  preferences,
  onChange,
  placement,
}: {
  preferences: FishingSoundPreferences;
  onChange: (key: keyof FishingSoundPreferences, enabled: boolean) => void;
  placement: 'sidebar' | 'account';
}) {
  return (
    <fieldset className={`fishing-sound-controls is-${placement}`}>
      <legend>Fishing sounds</legend>
      <label>
        <input
          type="checkbox"
          checked={preferences.reelEvent}
          onChange={(event) => onChange('reelEvent', event.target.checked)}
        />
        Reel event sound
      </label>
      <label>
        <input
          type="checkbox"
          checked={preferences.fishCatch}
          onChange={(event) => onChange('fishCatch', event.target.checked)}
        />
        Fish caught sound
      </label>
      {placement === 'account' && <p>Saved on this browser for this character.</p>}
    </fieldset>
  );
}

export function App() {
  const [serverState, setServerState] = useState<ServerState>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [pinnedPlaces, setPinnedPlaces] = useState<string[]>([]);
  const [packCapacity, setPackCapacity] = useState<string>('…');
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [fishingAdminAccess, setFishingAdminAccess] = useState(false);
  const [worldState, setWorldState] = useState<PublicWorldSnapshot | null>(null);
  const [clockUnavailable, setClockUnavailable] = useState(false);
  const [soundPreferenceSelection, setSoundPreferenceSelection] = useState<{
    characterId: string;
    preferences: FishingSoundPreferences;
  } | null>(null);
  const accountDialog = useRef<HTMLDialogElement>(null);
  const inventoryDialog = useRef<HTMLDialogElement>(null);
  const quickTravelDialog = useRef<HTMLDialogElement>(null);
  const fishingToolsDialog = useRef<HTMLDialogElement>(null);
  const drawerOpener = useRef<HTMLElement | null>(null);
  const toolsPointer = useRef<{
    mode: 'move' | 'resize';
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [view, setView] = useState(() =>
    window.location.hash === '#inventory'
      ? 'inventory'
      : window.location.hash === '#account'
        ? 'account'
        : window.location.hash === '#quick-travel'
          ? 'quick-travel'
          : window.location.hash === '#fishing-tools'
            ? 'fishing-tools'
            : 'world',
  );
  useEffect(() => {
    const syncView = () =>
      setView(
        window.location.hash === '#inventory'
          ? 'inventory'
          : window.location.hash === '#account'
            ? 'account'
            : window.location.hash === '#quick-travel'
              ? 'quick-travel'
              : window.location.hash === '#fishing-tools'
                ? 'fishing-tools'
                : 'world',
      );
    window.addEventListener('hashchange', syncView);
    window.addEventListener('popstate', syncView);
    return () => {
      window.removeEventListener('hashchange', syncView);
      window.removeEventListener('popstate', syncView);
    };
  }, []);
  const character = session?.character ?? null;
  const characterId = character?.id;
  const soundPreferences =
    characterId && soundPreferenceSelection?.characterId === characterId
      ? soundPreferenceSelection.preferences
      : characterId
        ? readFishingSoundPreferences(characterId)
        : defaultFishingSoundPreferences;
  useEffect(() => {
    if (!characterId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === fishingSoundStorageKey(characterId))
        setSoundPreferenceSelection({
          characterId,
          preferences: readFishingSoundPreferences(characterId),
        });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [characterId]);
  function changeFishingSound(key: keyof FishingSoundPreferences, enabled: boolean) {
    if (!characterId) return;
    if (key === 'reelEvent') {
      if (enabled) prepareReelPromptSound();
      else stopReelPromptSound();
    } else if (enabled) prepareFishCatchSound();
    else stopFishCatchSound();
    const next = { ...soundPreferences, [key]: enabled };
    setSoundPreferenceSelection({ characterId, preferences: next });
    saveFishingSoundPreferences(characterId, next);
  }
  useEffect(() => {
    if (!characterId) return;
    let active = true;
    let inFlight = false;
    const applyWorldState = (state: PublicWorldSnapshot) => {
      if (!active || !state.gameTime || !state.conditions) return;
      setWorldState((current) =>
        current && current.serverTime > state.serverTime ? current : state,
      );
      setClockUnavailable(false);
    };
    async function refreshWorld() {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await api<PublicWorldSnapshot>('/api/world/state', {
          signal: AbortSignal.timeout(10_000),
        });
        applyWorldState(result);
      } catch {
        if (active) setClockUnavailable(true);
      } finally {
        inFlight = false;
      }
    }
    const start = window.setTimeout(() => void refreshWorld(), 0);
    // Polling also provides a fallback when a browser or proxy cannot keep the stream open.
    const interval = window.setInterval(() => void refreshWorld(), 10_000);
    const events = typeof EventSource === 'undefined' ? null : new EventSource('/api/world/events');
    if (events) {
      events.onmessage = (event) => {
        try {
          applyWorldState(JSON.parse(event.data) as PublicWorldSnapshot);
        } catch {
          // A malformed event is ignored; polling and reconnects recover the snapshot.
        }
      };
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshWorld();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearTimeout(start);
      window.clearInterval(interval);
      events?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [characterId, inventoryRevision]);
  const clockLabel = worldState
    ? `${String(worldState.gameTime.hour).padStart(2, '0')}:${String(worldState.gameTime.minute).padStart(2, '0')} · ${worldState.conditions.timeOfDay}`
    : clockUnavailable
      ? 'Unavailable'
      : 'Syncing…';
  useEffect(() => {
    if (!import.meta.env.DEV || !session?.authenticated || !characterId) return;
    let current = true;
    void api<{ authorized: boolean }>('/api/fishing/admin/access')
      .then((result) => {
        if (current) setFishingAdminAccess(result.authorized === true);
      })
      .catch(() => {
        if (current) setFishingAdminAccess(false);
      });
    return () => {
      current = false;
      setFishingAdminAccess(false);
    };
  }, [session?.authenticated, session?.account?.username, characterId]);
  useEffect(() => {
    if (!character) return;
    for (const [dialog, shouldOpen] of [
      [accountDialog.current, view === 'account'],
      [inventoryDialog.current, view === 'inventory'],
      [quickTravelDialog.current, view === 'quick-travel'],
      [fishingToolsDialog.current, view === 'fishing-tools' && fishingAdminAccess],
    ] as const) {
      if (!dialog) continue;
      if (shouldOpen && !dialog.open) {
        if (dialog === fishingToolsDialog.current && typeof dialog.show === 'function')
          dialog.show();
        else if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        window.setTimeout(
          () => dialog.querySelector<HTMLElement>('[data-drawer-heading]')?.focus(),
          0,
        );
      } else if (!shouldOpen && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        window.setTimeout(() => drawerOpener.current?.focus(), 0);
      }
    }
  }, [character, view, fishingAdminAccess]);
  function openDrawer(
    next: 'inventory' | 'account' | 'quick-travel' | 'fishing-tools',
    opener: HTMLElement,
  ) {
    if (!character || view === next || (next === 'fishing-tools' && !fishingAdminAccess)) return;
    drawerOpener.current = opener;
    window.history.pushState({ frontierDrawer: true }, '', `#${next}`);
    setView(next);
  }
  function closeDrawer() {
    if (window.history.state?.frontierDrawer) window.history.back();
    else {
      window.history.replaceState({}, '', '#places');
      setView('world');
    }
    window.setTimeout(() => drawerOpener.current?.focus(), 50);
  }

  function beginToolsPointer(event: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    if (event.button !== 0) return;
    if (mode === 'move' && (event.target as HTMLElement).closest('.drawer-close')) return;
    const dialog = fishingToolsDialog.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    dialog.style.left = `${rect.left}px`;
    dialog.style.top = `${rect.top}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.width = `${rect.width}px`;
    dialog.style.height = `${rect.height}px`;
    toolsPointer.current = {
      mode,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveToolsPointer(event: ReactPointerEvent<HTMLElement>) {
    const start = toolsPointer.current;
    const dialog = fishingToolsDialog.current;
    if (!start || !dialog || start.pointerId !== event.pointerId) return;
    const changeX = event.clientX - start.x;
    const changeY = event.clientY - start.y;
    if (start.mode === 'move') {
      dialog.style.left = `${Math.max(8, Math.min(window.innerWidth - start.width - 8, start.left + changeX))}px`;
      dialog.style.top = `${Math.max(8, Math.min(window.innerHeight - start.height - 8, start.top + changeY))}px`;
    } else {
      const minWidth = Math.min(300, window.innerWidth - start.left - 8);
      const minHeight = Math.min(260, window.innerHeight - start.top - 8);
      dialog.style.width = `${Math.max(minWidth, Math.min(window.innerWidth - start.left - 8, start.width + changeX))}px`;
      dialog.style.height = `${Math.max(minHeight, Math.min(window.innerHeight - start.top - 8, start.height + changeY))}px`;
    }
  }

  function endToolsPointer(event: ReactPointerEvent<HTMLElement>) {
    if (toolsPointer.current?.pointerId !== event.pointerId) return;
    toolsPointer.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function adjustToolsWithKeyboard(
    event: ReactKeyboardEvent<HTMLElement>,
    mode: 'move' | 'resize',
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const dialog = fishingToolsDialog.current;
    if (!dialog) return;
    event.preventDefault();
    const rect = dialog.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 10;
    const horizontal = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const vertical = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    if (mode === 'move') {
      dialog.style.left = `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, rect.left + horizontal))}px`;
      dialog.style.top = `${Math.max(8, Math.min(window.innerHeight - rect.height - 8, rect.top + vertical))}px`;
    } else {
      dialog.style.width = `${Math.max(Math.min(300, window.innerWidth - rect.left - 8), Math.min(window.innerWidth - rect.left - 8, rect.width + horizontal))}px`;
      dialog.style.height = `${Math.max(Math.min(260, window.innerHeight - rect.top - 8), Math.min(window.innerHeight - rect.top - 8, rect.height + vertical))}px`;
    }
  }

  useEffect(() => {
    const keepToolsVisible = () => {
      const dialog = fishingToolsDialog.current;
      if (!dialog?.open) return;
      const rect = dialog.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);
      const responsiveHeight =
        window.innerWidth <= 760
          ? Math.min(440, window.innerHeight * 0.62)
          : window.innerWidth <= 1000
            ? Math.min(540, window.innerHeight * 0.7)
            : window.innerHeight - 16;
      const height = Math.min(rect.height, responsiveHeight, window.innerHeight - 16);
      dialog.style.width = `${width}px`;
      dialog.style.height = `${height}px`;
      dialog.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))}px`;
      dialog.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, rect.top))}px`;
      dialog.style.right = 'auto';
      dialog.style.bottom = 'auto';
    };
    window.addEventListener('resize', keepToolsVisible);
    return () => window.removeEventListener('resize', keepToolsVisible);
  }, []);

  const loadSession = async () => {
    try {
      const next = await api<Session>('/api/session');
      setSession(next);
      setServerState('online');
    } catch {
      setServerState('offline');
    }
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const payload = {
      username: form.get('username'),
      password: form.get('password'),
      ...(mode === 'register' ? { characterName: form.get('characterName') } : {}),
    };
    try {
      const result = await api<{ account: { username: string }; character: Character }>(
        mode === 'register' ? '/api/auth/register' : '/api/auth/login',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      setSession({ authenticated: true, ...result });
      setNotice(
        mode === 'register'
          ? 'Character created. Welcome to Frontier.'
          : 'Signed in. Your character is ready.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/logout', { method: 'POST' });
      setSession({ authenticated: false });
      setWorldState(null);
      setClockUnavailable(false);
      setPinnedPlaces([]);
      setDevOpen(false);
      setFishingAdminAccess(false);
      setMode('login');
      setNotice('Signed out. Your character will be here when you return.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }
  async function saveDevelopmentState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ character: Character }>('/api/character/development-state', {
        method: 'PATCH',
        body: JSON.stringify({
          credits: Number(form.get('credits')),
          hp: Number(form.get('hp')),
          characterXp: Number(form.get('characterXp')),
        }),
      });
      setSession((current) => (current ? { ...current, character: result.character } : current));
      setNotice('Character state saved. Your summary is up to date.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to save development state.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`app-shell${character ? ` game-shell view-${view}` : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Frontier home">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-label">Frontier</span>
        </a>
        <nav className="top-navigation" aria-label="Main navigation">
          <a
            href="#places"
            aria-label="World"
            aria-current={view === 'world' ? 'page' : undefined}
            onClick={(event) => {
              if (character && view !== 'world') {
                event.preventDefault();
                drawerOpener.current = event.currentTarget;
                window.history.pushState({}, '', '#places');
                setView('world');
              }
            }}
          >
            <NavigationIcon name="world" />
            <span>World</span>
          </a>
          <a
            href="#inventory"
            aria-label="Inventory"
            data-drawer-trigger
            aria-current={view === 'inventory' ? 'page' : undefined}
            onClick={(event) => {
              if (character) {
                event.preventDefault();
                openDrawer('inventory', event.currentTarget);
              }
            }}
          >
            <NavigationIcon name="pack" />
            <span>Inventory</span>
          </a>
          {character && (
            <a
              href="#quick-travel"
              aria-label="Quick Travel"
              data-drawer-trigger
              aria-current={view === 'quick-travel' ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                openDrawer('quick-travel', event.currentTarget);
              }}
            >
              <NavigationIcon name="pin" />
              <span>Quick Travel</span>
              {pinnedPlaces.length > 0 && (
                <span className="quick-travel-count">{pinnedPlaces.length}</span>
              )}
            </a>
          )}
          <button
            disabled
            aria-label="Knowledge Atlas (coming soon)"
            title="The Knowledge Atlas is coming soon"
          >
            <NavigationIcon name="atlas" />
            <span>Atlas</span>
          </button>
        </nav>
        {serverState !== 'online' && (
          <div className={`server-status ${serverState}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {serverState === 'checking' ? 'Connecting…' : 'Connection unavailable'}
          </div>
        )}
        <a
          className="profile-trigger"
          href="#account"
          aria-label="Account"
          title="Account and profile"
          data-drawer-trigger
          aria-current={view === 'account' ? 'page' : undefined}
          onClick={(event) => {
            if (character) {
              event.preventDefault();
              openDrawer('account', event.currentTarget);
            }
          }}
        >
          <NavigationIcon name="account" />
          <span>Account</span>
        </a>
      </header>
      <aside
        className={`character-sidebar${character ? '' : ' guest-sidebar'}`}
        aria-label="Character summary"
      >
        <p className={character ? 'sr-only' : 'eyebrow'}>Your character</p>
        <div className="identity">
          <div className="portrait-placeholder" aria-hidden="true">
            {character
              ? character.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
              : '◇'}
          </div>
          <div>
            <h2>
              {character?.name ??
                (serverState === 'checking' ? 'Loading character…' : 'New arrival')}
            </h2>
            <span className="muted identity-level">
              {character ? `Level ${character.characterLevel}` : 'Sign in to begin'}
            </span>
          </div>
        </div>
        {!character && (
          <p className="sidebar-note">
            {serverState === 'checking'
              ? 'Checking for your saved character.'
              : 'Your name. Your choices. A life of your own.'}
          </p>
        )}
        <h3 className="sr-only">Character status</h3>
        <dl className="character-resources">
          <div className="health-stat">
            <dt>
              <ResourceIcon name="health" />
              Health
            </dt>
            <dd>
              <span>{character ? `${character.hp} / ${character.maxHp}` : '—'}</span>
              {character && (
                <div className="health-summary">
                  <progress
                    aria-label="Character health"
                    value={character.hp}
                    max={character.maxHp}
                  />
                </div>
              )}
            </dd>
          </div>
          <div className="hud-xp">
            <dt>
              <ResourceIcon name="xp" />
              Total XP
            </dt>
            <dd>{character ? character.characterXp.toLocaleString() : '—'}</dd>
          </div>
          <div className="hud-credits">
            <dt>
              <ResourceIcon name="credits" />
              Credits
            </dt>
            <dd>{character ? character.credits.toLocaleString() : '—'}</dd>
          </div>
          <div className="hud-activity">
            <dt>
              <ResourceIcon name="activity" />
              Activity
            </dt>
            <dd className="active-status">
              <span
                className={`activity-state-mark${character?.activeStatus.toLowerCase() === 'fishing' ? ' is-active' : ''}`}
                aria-hidden="true"
              />
              {character?.activeStatus.toLowerCase() ?? '—'}
            </dd>
          </div>
          {character && (
            <div className="hud-frontier-time">
              <dt>
                <ResourceIcon name="time" />
                Frontier time
              </dt>
              <dd aria-label={`Frontier time ${clockLabel}`}>
                {clockLabel}
                {clockUnavailable && worldState && (
                  <span className="sr-only"> awaiting refresh</span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {character && (
          <button
            className="button hud-pack-button"
            data-drawer-trigger
            onClick={(event) => openDrawer('inventory', event.currentTarget)}
          >
            <span className="hud-pack-label">
              <NavigationIcon name="pack" />
              Inventory
            </span>
            <span>{packCapacity}</span>
          </button>
        )}
        {character?.currentLocationId === 'fishing-pier' && (
          <FishingSoundControls
            placement="sidebar"
            preferences={soundPreferences}
            onChange={changeFishingSound}
          />
        )}
        {!character && (
          <div className="sidebar-footer">
            <span className="badge">{session?.authenticated ? 'Signed in' : 'Early preview'}</span>
            <p>
              {session?.authenticated
                ? 'Your character stays with your account.'
                : 'A world taking shape.'}
            </p>
          </div>
        )}
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="page-context">
          <span>Frontier / Overview</span>
          <span className="badge">Early preview</span>
        </div>
        <dialog
          className="game-drawer account-drawer"
          ref={accountDialog}
          open={!character || undefined}
          aria-labelledby="welcome-heading"
          onCancel={(event) => {
            event.preventDefault();
            closeDrawer();
          }}
        >
          {character && (
            <button className="drawer-close" aria-label="Close account" onClick={closeDrawer}>
              ×
            </button>
          )}
          <section className="welcome-panel" id="account" aria-labelledby="welcome-heading">
            <p className="eyebrow">
              {character
                ? 'Your frontier'
                : mode === 'login'
                  ? 'Continue your story'
                  : 'A place to begin'}
            </p>
            <h1 id="welcome-heading" tabIndex={-1} data-drawer-heading>
              {character ? `Welcome back, ${character.name}` : 'Welcome to Frontier'}
            </h1>
            {character && session?.account && (
              <p className="account-handle muted">@{session.account.username}</p>
            )}
            <p>
              {character
                ? 'A life of your own, one choice at a time. Your character is ready for your next visit.'
                : mode === 'login'
                  ? 'Sign in to return to your character, just as you left them.'
                  : 'Choose a name and make a place for yourself. One account, one persistent character.'}
            </p>
            {notice && (
              <p className="feedback success-feedback" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="feedback form-error" role="alert">
                {error}
              </p>
            )}
            {!session?.authenticated && (
              <form
                className="auth-form"
                onSubmit={submitAuth}
                aria-label={mode === 'register' ? 'Create account' : 'Sign in'}
                aria-busy={busy}
              >
                <div className="form-heading">
                  <h2>{mode === 'register' ? 'Create your character' : 'Sign in to Frontier'}</h2>
                  <p className="muted small">
                    {mode === 'register'
                      ? 'Start with your identity. No class or career to choose.'
                      : 'Use the username and password for your account.'}
                  </p>
                </div>
                {mode === 'register' && (
                  <label className="field-label">
                    Character name
                    <input
                      className="input"
                      name="characterName"
                      aria-label="Character name"
                      required
                      minLength={2}
                      maxLength={24}
                      disabled={busy}
                      aria-describedby="name-hint"
                    />
                    <span className="field-hint" id="name-hint">
                      2–24 characters. Start with a letter; spaces, numbers, apostrophes and hyphens
                      are welcome.
                    </span>
                  </label>
                )}
                <label className="field-label">
                  Username
                  <input
                    className="input"
                    name="username"
                    aria-label="Username"
                    required
                    minLength={3}
                    maxLength={24}
                    autoComplete="username"
                    disabled={busy}
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="username-hint"
                  />
                  <span className="field-hint" id="username-hint">
                    3–24 letters, numbers, underscores or hyphens.
                  </span>
                </label>
                <label className="field-label">
                  Password
                  <input
                    className="input"
                    name="password"
                    aria-label="Password"
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    disabled={busy}
                    aria-describedby="password-hint"
                  />
                  <span className="field-hint" id="password-hint">
                    8–128 characters.
                  </span>
                </label>
                <div className="welcome-actions">
                  <button className="button primary" disabled={busy || serverState !== 'online'}>
                    {busy
                      ? mode === 'register'
                        ? 'Creating your character…'
                        : 'Signing in…'
                      : mode === 'register'
                        ? 'Create character →'
                        : 'Sign in →'}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode(mode === 'register' ? 'login' : 'register');
                      setError('');
                    }}
                  >
                    {mode === 'register' ? 'I already have an account' : 'Create an account'}
                  </button>
                </div>
              </form>
            )}
            {session?.authenticated && !character && (
              <div className="feedback">
                <h2>Your character could not be loaded</h2>
                <p>Sign out and sign in again to reload your account.</p>
              </div>
            )}
            {session?.authenticated && (
              <div className="welcome-actions">
                <button className="button secondary" onClick={() => void logout()} disabled={busy}>
                  {busy ? 'Please wait…' : 'Sign out'}
                </button>
                {character && fishingAdminAccess && import.meta.env.DEV && (
                  <a
                    className="button secondary fishing-tools-nav"
                    href="#fishing-tools"
                    aria-label="Fishing test tools (development/admin)"
                    data-drawer-trigger
                    onClick={(event) => {
                      event.preventDefault();
                      openDrawer('fishing-tools', event.currentTarget);
                    }}
                  >
                    <NavigationIcon name="tools" />
                    <span>Fishing test tools</span>
                    <span className="nav-admin-label">DEV / ADMIN</span>
                  </a>
                )}
                {character && import.meta.env.DEV && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    aria-expanded={devOpen}
                    onClick={() => setDevOpen((value) => !value)}
                  >
                    Development state
                  </button>
                )}
              </div>
            )}
            {character?.currentLocationId === 'fishing-pier' && (
              <FishingSoundControls
                placement="account"
                preferences={soundPreferences}
                onChange={changeFishingSound}
              />
            )}
            <p className="muted small">
              <a href="/asset-credits.html" target="_blank" rel="noopener noreferrer">
                Asset credits
              </a>
            </p>
          </section>
          <div
            className={`connection-notice ${serverState}`}
            role="region"
            aria-label="Connection status"
          >
            <span className="status-dot" aria-hidden="true" />
            <div role="status" aria-live="polite">
              <strong>
                {serverState === 'checking'
                  ? 'Connecting to Frontier'
                  : serverState === 'online'
                    ? 'Connected to Frontier'
                    : 'Unable to connect'}
              </strong>
              <p>
                {serverState === 'offline'
                  ? 'The server could not be reached. You can retry the connection.'
                  : serverState === 'checking'
                    ? 'Loading your session. This should only take a moment.'
                    : session?.authenticated
                      ? 'Your account is connected.'
                      : 'Ready when you are. Create an account or sign in to continue.'}
              </p>
            </div>
            {serverState === 'offline' && (
              <button
                className="button secondary"
                onClick={() => {
                  setServerState('checking');
                  void loadSession();
                }}
              >
                Try again
              </button>
            )}
          </div>
          {character && devOpen && import.meta.env.DEV && (
            <section className="panel development-panel" aria-labelledby="development-heading">
              <div className="panel-heading">
                <h2 id="development-heading">Development state</h2>
                <span className="badge">Local development</span>
              </div>
              <p className="muted small">
                This server-validated editor exists for F01 persistence verification and is
                unavailable in production.
              </p>
              <form className="auth-form compact-form" onSubmit={saveDevelopmentState}>
                <label className="field-label">
                  Credits
                  <input
                    className="input"
                    name="credits"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={character.credits}
                  />
                </label>
                <label className="field-label">
                  HP
                  <input
                    className="input"
                    name="hp"
                    type="number"
                    min="0"
                    max={character.maxHp}
                    step="1"
                    defaultValue={character.hp}
                  />
                </label>
                <label className="field-label">
                  Character XP
                  <input
                    className="input"
                    name="characterXp"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={character.characterXp}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  Save state
                </button>
              </form>
            </section>
          )}
        </dialog>
        <dialog
          className="game-drawer fishing-tools-drawer"
          ref={fishingToolsDialog}
          aria-labelledby="fishing-tools-heading"
          onCancel={(event) => {
            event.preventDefault();
            closeDrawer();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeDrawer();
            }
          }}
        >
          <div
            className="fishing-tools-window-header"
            onPointerDown={(event) => beginToolsPointer(event, 'move')}
            onPointerMove={moveToolsPointer}
            onPointerUp={endToolsPointer}
            onPointerCancel={endToolsPointer}
          >
            <div>
              <p className="eyebrow">Development / admin</p>
              <h1 id="fishing-tools-heading" tabIndex={-1} data-drawer-heading>
                Fishing test tools
              </h1>
            </div>
            <button
              type="button"
              className="fishing-tools-move"
              aria-label="Move fishing test tools window with arrow keys"
              title="Drag the header or use arrow keys to move"
              onKeyDown={(event) => adjustToolsWithKeyboard(event, 'move')}
            >
              Move
            </button>
            <button
              className="drawer-close"
              aria-label="Close fishing test tools"
              onClick={closeDrawer}
            >
              ×
            </button>
          </div>
          <div className="fishing-tools-window-content">
            <p className="muted small">Changes affect your character’s real carried inventory.</p>
            {character && fishingAdminAccess && view === 'fishing-tools' && (
              <FishingAdminTools onMutation={() => setInventoryRevision((value) => value + 1)} />
            )}
          </div>
          <button
            type="button"
            className="fishing-tools-resize"
            aria-label="Resize fishing test tools window with arrow keys"
            title="Drag to resize or use arrow keys"
            onPointerDown={(event) => beginToolsPointer(event, 'resize')}
            onPointerMove={moveToolsPointer}
            onPointerUp={endToolsPointer}
            onPointerCancel={endToolsPointer}
            onKeyDown={(event) => adjustToolsWithKeyboard(event, 'resize')}
          >
            ◢
          </button>
        </dialog>
        <LocationsPanel
          key={`locations-${character?.id ?? 'guest'}`}
          character={character}
          busy={busy}
          onBusy={setBusy}
          onCharacter={(updated) =>
            setSession((current) => (current ? { ...current, character: updated } : current))
          }
          onPinnedPlaces={setPinnedPlaces}
          quickTravelDialog={quickTravelDialog}
          onCloseQuickTravel={closeDrawer}
          refreshRevision={inventoryRevision}
          worldState={worldState}
          onInventoryChange={() => setInventoryRevision((value) => value + 1)}
          onOpenPack={(opener) => openDrawer('inventory', opener)}
          fishingSoundPreferences={soundPreferences}
          adminAuthorized={fishingAdminAccess}
          modalOpen={view === 'inventory' || view === 'account' || view === 'quick-travel'}
        />
        <dialog
          className="game-drawer inventory-drawer"
          ref={inventoryDialog}
          aria-labelledby="possessions-heading"
          onCancel={(event) => {
            event.preventDefault();
            closeDrawer();
          }}
        >
          <button className="drawer-close" aria-label="Close inventory" onClick={closeDrawer}>
            ×
          </button>
          <InventoryPanel
            key={`inventory-${character?.id ?? 'guest'}`}
            character={character}
            busy={busy}
            onBusy={setBusy}
            onCapacity={(used, capacity) => setPackCapacity(`${used}/${capacity}`)}
            onCharacter={(updated) =>
              setSession((current) => (current ? { ...current, character: updated } : current))
            }
            refreshRevision={inventoryRevision}
            onInventoryMutation={() => setInventoryRevision((value) => value + 1)}
            adminAuthorized={fishingAdminAccess}
          />
        </dialog>
        <section className="activity-panel" aria-labelledby="activity-heading">
          <div>
            <h2 id="activity-heading">Activity</h2>
            <p className="muted">
              {character
                ? 'Your current status. Activities will be available in a future update.'
                : 'Sign in to see your character’s status.'}
            </p>
          </div>
          <span className="badge active-status">{character?.activeStatus ?? 'Not signed in'}</span>
        </section>
        <footer className="page-footer">Your pace. Your direction. Your frontier.</footer>
      </main>
    </div>
  );
}
