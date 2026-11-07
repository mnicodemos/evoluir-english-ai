/** Start both channels in a gesture when necessary, but keep the welcome dominant. */
export const ADVENTURE_MUSIC_VOLUME = 0.12;
export const ADVENTURE_WELCOME_MUSIC_VOLUME = 0.03;

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
  audio.volume = adventureMusicVolume(welcomeAvailable, welcomeFinished);
  audio.muted = false;
  return audio.play().then(() => true, () => false);
}