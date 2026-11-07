import { describe, expect, it, vi } from "vitest";
import { adventureMusicVolume, playAdventureMusic, prepareAdventureMusic, setAdventureMusicVolume } from "./adventureAudio";

function track(play = vi.fn().mockResolvedValue(undefined)) {
  return { play, loop: false, muted: true, volume: 1 } as unknown as HTMLAudioElement;
}

describe("adventure soundtrack sequence", () => {
  it("unlocks the audio graph and raises gain after the welcome on mobile", () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const connect = vi.fn();
    class AudioContextStub {
      state = "suspended";
      destination = {};
      resume = resume;
      createGain = () => gain;
      createMediaElementSource = () => ({ connect });
    }
    vi.stubGlobal("window", { AudioContext: AudioContextStub });
    try {
      const audio = track();
      prepareAdventureMusic(audio);
      setAdventureMusicVolume(audio, 0.03);
      expect(resume).toHaveBeenCalledOnce();
      expect(gain.gain.value).toBe(0.03);
      setAdventureMusicVolume(audio, 0.12);
      expect(gain.gain.value).toBe(0.12);
      expect(audio.volume).toBe(1);
      prepareAdventureMusic(audio);
      expect(connect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("restores the soundtrack after EVO finishes, even though welcome was started", () => {
    expect(adventureMusicVolume(true, false)).toBe(0.03);
    expect(adventureMusicVolume(true, true)).toBe(0.12);
  });
  it("plays immediately when explicitly unmuted", async () => {
    const audio = track();
    expect(await playAdventureMusic(audio, false, true, true)).toBe(true);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBe(0.12);
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
    expect(play).toHaveBeenCalledTimes(2);
  });
});