import { FOCUS_PRESET_IDS, FOCUS_PRESETS, focusBreakMinutes, type FocusPresetId } from "@/lib/life";
import { readStorage, writeStorage } from "@/lib/safeStorage";

/**
 * The Focus timer's one state for the whole app (user request: a floating
 * window that keeps running while the student does other things): the /life
 * section, the floating window and the Dashboard button all read and change
 * this store, and FocusController (mounted by AppShell) ends each phase. The
 * state lives in localStorage, so changing page, reloading or locking the
 * phone never loses it.
 */
export type FocusState = {
  preset: FocusPresetId;
  phase: "idle" | "focus" | "break";
  /** When the running phase ends (ms since epoch); null while paused or idle. */
  endsAt: number | null;
  /** Time left of a paused phase. */
  left: number | null;
  /** Focus blocks finished in this run (a long break after every fourth). */
  blocks: number;
  taskId: string | null;
  /** Key of the focus block running now, so it joins the log once. */
  key: string | null;
  /** The task of the block just finished, asked about during the break. */
  lastTaskId: string | null;
};

/** The floating window: open or closed, minimized, and where it was dragged. */
export type FocusWidget = {
  open: boolean;
  minimized: boolean;
  x: number | null;
  y: number | null;
};

const STATE_KEY = "evoluir-focus";
const WIDGET_KEY = "evoluir-focus-widget";

export const FOCUS_IDLE: FocusState = {
  preset: "classic",
  phase: "idle",
  endsAt: null,
  left: null,
  blocks: 0,
  taskId: null,
  key: null,
  lastTaskId: null,
};
const WIDGET_CLOSED: FocusWidget = { open: false, minimized: false, x: null, y: null };

function readJson<T>(key: string): Partial<T> | null {
  try {
    const raw = readStorage(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

function readState(): FocusState {
  const parsed = readJson<FocusState>(STATE_KEY);
  if (!parsed || !FOCUS_PRESET_IDS.includes(parsed.preset as FocusPresetId)) return FOCUS_IDLE;
  return { ...FOCUS_IDLE, ...parsed };
}

function readWidget(): FocusWidget {
  return { ...WIDGET_CLOSED, ...readJson<FocusWidget>(WIDGET_KEY) };
}

type Snapshot = { state: FocusState; widget: FocusWidget };
const SERVER_SNAPSHOT: Snapshot = { state: FOCUS_IDLE, widget: WIDGET_CLOSED };
let snapshot: Snapshot = SERVER_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = { state: readState(), widget: readWidget() };
  // Another tab started or stopped the timer: follow it.
  window.addEventListener("storage", (event) => {
    if (event.key !== STATE_KEY && event.key !== WIDGET_KEY) return;
    snapshot = { state: readState(), widget: readWidget() };
    emit();
  });
}

export function subscribeFocus(listener: () => void) {
  const first = !hydrated;
  hydrate();
  listeners.add(listener);
  if (first) queueMicrotask(emit);
  return () => {
    listeners.delete(listener);
  };
}

export const getFocusSnapshot = () => snapshot;
export const getServerFocusSnapshot = () => SERVER_SNAPSHOT;

function setState(next: FocusState) {
  snapshot = { ...snapshot, state: next };
  writeStorage(STATE_KEY, JSON.stringify(next));
  emit();
}

function setWidget(next: FocusWidget) {
  snapshot = { ...snapshot, widget: next };
  writeStorage(WIDGET_KEY, JSON.stringify(next));
  emit();
}

/** Time left, the phase's length and the share done, for the ring and the clock. */
export function focusView(state: FocusState, now: number) {
  const preset = FOCUS_PRESETS[state.preset];
  const totalMs =
    (state.phase === "break" ? focusBreakMinutes(state.preset, state.blocks) : preset.focus) *
    60_000;
  const running = state.endsAt !== null;
  const leftMs =
    state.phase === "idle"
      ? preset.focus * 60_000
      : running
        ? Math.max(0, state.endsAt! - now)
        : (state.left ?? totalMs);
  return {
    running,
    totalMs,
    leftMs,
    share: state.phase === "idle" ? 0 : Math.min(1, Math.max(0, 1 - leftMs / totalMs)),
  };
}

// ------------------------------------------------------------------ Actions

export function focusStart() {
  const { state } = snapshot;
  setState({
    ...state,
    phase: "focus",
    endsAt: Date.now() + FOCUS_PRESETS[state.preset].focus * 60_000,
    left: null,
    key: crypto.randomUUID(),
  });
}

export function focusPause() {
  const { state } = snapshot;
  if (state.endsAt === null) return;
  setState({ ...state, endsAt: null, left: Math.max(0, state.endsAt - Date.now()) });
}

export function focusResume() {
  const { state } = snapshot;
  setState({ ...state, endsAt: Date.now() + (state.left ?? 0), left: null });
}

/** Stopping drops the running block unsaved; the run starts over. */
export function focusStop() {
  const { state } = snapshot;
  setState({ ...FOCUS_IDLE, preset: state.preset, taskId: state.taskId });
}

export function focusSkipBreak() {
  setState({ ...snapshot.state, phase: "idle", endsAt: null, left: null });
}

export function focusSetPreset(preset: FocusPresetId) {
  setState({ ...snapshot.state, preset, blocks: 0 });
}

export function focusSetTask(taskId: string | null) {
  setState({ ...snapshot.state, taskId });
}

export function focusClearLastTask() {
  setState({ ...snapshot.state, lastTaskId: null, taskId: null });
}

export type FocusEnded =
  { kind: "focus"; minutes: number; key: string; endedAt: number } | { kind: "break" };

/**
 * Ends the running phase once its time is up: a focus block turns into its
 * break (the caller logs the block), a break turns back to idle. Returns null
 * when nothing was due, so calling it twice never ends a phase twice.
 */
export function focusCompleteDue(now: number): FocusEnded | null {
  const { state } = snapshot;
  if (state.endsAt === null || now < state.endsAt) return null;
  const ended = state.endsAt;
  if (state.phase === "focus") {
    const blocks = state.blocks + 1;
    setState({
      ...state,
      phase: "break",
      blocks,
      endsAt: ended + focusBreakMinutes(state.preset, blocks) * 60_000,
      left: null,
      key: null,
      lastTaskId: state.taskId,
    });
    return {
      kind: "focus",
      minutes: FOCUS_PRESETS[state.preset].focus,
      key: state.key ?? String(ended),
      endedAt: ended,
    };
  }
  setState({ ...state, phase: "idle", endsAt: null, left: null });
  return { kind: "break" };
}

// ------------------------------------------------------------ Floating window

export function openFocusWidget() {
  setWidget({ ...snapshot.widget, open: true, minimized: false });
}

export function closeFocusWidget() {
  setWidget({ ...snapshot.widget, open: false });
}

export function minimizeFocusWidget(minimized: boolean) {
  setWidget({ ...snapshot.widget, minimized });
}

export function moveFocusWidget(x: number, y: number) {
  setWidget({ ...snapshot.widget, x, y });
}
