/** Start both channels in a gesture when necessary, but keep the welcome dominant. */
export const ADVENTURE_MUSIC_VOLUME = 0.12;
export const ADVENTURE_WELCOME_MUSIC_VOLUME = 0.03;

// Lazily created in the browser: one graph per soundtrack element. GainNode
// supplies the volume control that HTMLMediaElement.volume lacks on iOS.
const musicGraphs = new WeakMap<HTMLAudioElement, { context: AudioContext; gain: GainNode }>();

export function prepareAdventureMusic(audio: HTMLAudioElement) {
  let graph = musicGraphs.get(audio);
  if (!graph && typeof window !== "undefined" && typeof window.AudioContext === "function") {
    let context: AudioContext | undefined;
    try {
      context = new window.AudioContext();
      const gain = context.createGain();
      const source = context.createMediaElementSource(audio);
      source.connect(gain);
      gain.connect(context.destination);
      graph = { context, gain };
      musicGraphs.set(audio, graph);
    } catch {
      if (context) void context.close().catch(() => undefined);
      // Older browsers retain their native media playback.
    }
  }
  // Must be called synchronously from the same gesture as both play() calls.
  if (graph?.context.state === "suspended") void graph.context.resume().catch(() => undefined);
}

export function setAdventureMusicVolume(audio: HTMLAudioElement, volume: number) {
  const graph = musicGraphs.get(audio);
  if (graph) {
    audio.volume = 1;
    graph.gain.gain.value = volume;
  } else audio.volume = volume;
}

export function getAdventureMusicVolume(audio: HTMLAudioElement) {
  return musicGraphs.get(audio)?.gain.gain.value ?? audio.volume;
}

export function releaseAdventureMusic(audio: HTMLAudioElement) {
  audio.pause();
  const graph = musicGraphs.get(audio);
  musicGraphs.delete(audio);
  if (graph) void graph.context.close().catch(() => undefined);
}

export function adventureMusicVolume(welcomeAvailable: boolean, welcomeFinished: boolean) {
  return welcomeAvailable && !welcomeFinished
    ? ADVENTURE_WELCOME_MUSIC_VOLUME
    : ADVENTURE_MUSIC_VOLUME;
}

export function playAdventureMusic(
  audio: HTMLAudioElement,
  muted: boolean,
  welcomeAvailable: boolean,
  welcomeFinished: boolean,
): Promise<boolean> {
  if (muted) return Promise.resolve(false);
  prepareAdventureMusic(audio);
  audio.loop = true;
  setAdventureMusicVolume(audio, adventureMusicVolume(welcomeAvailable, welcomeFinished));
  audio.muted = false;
  return audio.play().then(() => true, () => false);
}