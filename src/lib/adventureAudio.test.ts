import { describe, expect, it, vi } from "vitest";
import { adventureMusicVolume, playAdventureMusic } from "./adventureAudio";

function track(play = vi.fn().mockResolvedValue(undefined)) {
  return { play, loop: false, muted: true, volume: 1 } as unknown as HTMLAudioElement;
}

describe("adventure soundtrack sequence", () => {
  it("keeps music soft under EVO and audible after she finishes", () => {
    expect(adventureMusicVolume(true, false)).toBe(0.1);
    expect(adventureMusicVolume(true, true)).toBe(0.35);
  });
  it("plays immediately when explicitly unmuted", async () => {
    const audio = track();
    expect(await playAdventureMusic(audio, false, true, true)).toBe(true);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBe(0.35);
  });
  it("respects the saved mute preference", async () => {
    const audio = track();
    expect(await playAdventureMusic(audio, true, true, true)).toBe(false);
    expect(audio.play).not.toHaveBeenCalled();
  });
  it("allows a blocked autoplay to be retried on interaction", async () => {
    const play = vi.fn().mockRejectedValueOnce(new Error("NotAllowedError")).mockResolvedValue(undefined);
    const audio = track(play);
    expect(await playAdventureMusic(audio, false, true, true)).toBe(false);
    expect(await playAdventureMusic(audio, false, true, true)).toBe(true);
  });
});
