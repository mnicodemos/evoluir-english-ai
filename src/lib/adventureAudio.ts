/** Start both channels in a gesture when necessary, but keep the welcome dominant. */
export const ADVENTURE_MUSIC_VOLUME = 0.35;
export const ADVENTURE_WELCOME_MUSIC_VOLUME = 0.1;

// Native element volume only: a Web Audio graph created before a gesture stays
// suspended on phones and can silence the soundtrack element for good.
export function prepareAdventureMusic(_audio: HTMLAudioElement) {}

export function setAdventureMusicVolume(audio: HTMLAudioElement, volume: number) {
  audio.volume = Math.max(0, Math.min(1, volume));
}

export function getAdventureMusicVolume(audio: HTMLAudioElement) {
  return audio.volume;
}

export function releaseAdventureMusic(audio: HTMLAudioElement) {
  audio.pause();
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
  audio.loop = true;
  setAdventureMusicVolume(audio, adventureMusicVolume(welcomeAvailable, welcomeFinished));
  audio.muted = false;
  return audio.play().then(() => true, () => false);
}
