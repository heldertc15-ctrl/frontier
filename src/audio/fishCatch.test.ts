import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function audioFixture() {
  const buffer = { duration: 5 } as AudioBuffer;
  const source = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const audio = {
    state: 'suspended',
    destination: {},
    decodeAudioData: vi.fn<(data: ArrayBuffer) => Promise<AudioBuffer>>(async () => buffer),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {
      audio.state = 'running';
    }),
  };
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return audio;
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })),
  );
  return { audio, source, gain, buffer };
}

it('preloads silently, plays on confirmation, and stops immediately when muted', async () => {
  const { audio, source, gain, buffer } = audioFixture();
  const { prepareFishCatchSound, playFishCatchSound, stopFishCatchSound } =
    await import('./fishCatch');
  prepareFishCatchSound();
  await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
  expect(source.start).not.toHaveBeenCalled();
  playFishCatchSound();
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
  expect(source.buffer).toBe(buffer);
  expect(gain.gain.value).toBe(0.5);
  stopFishCatchSound();
  expect(source.stop).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalledOnce();
});

it('skips a delayed catch sound rather than playing after its result', async () => {
  const { audio, source, buffer } = audioFixture();
  let finishDecode!: (decoded: AudioBuffer) => void;
  audio.decodeAudioData.mockReturnValueOnce(
    new Promise<AudioBuffer>((resolve) => {
      finishDecode = resolve;
    }),
  );
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const { prepareFishCatchSound, playFishCatchSound } = await import('./fishCatch');
  prepareFishCatchSound();
  await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
  playFishCatchSound();
  clock.mockReturnValue(600);
  finishDecode(buffer);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(source.start).not.toHaveBeenCalled();
});

it('does not interrupt a catch when browser audio is unavailable', async () => {
  audioFixture();
  vi.stubGlobal('AudioContext', undefined);
  const { prepareFishCatchSound, playFishCatchSound } = await import('./fishCatch');
  expect(() => prepareFishCatchSound()).not.toThrow();
  expect(() => playFishCatchSound()).not.toThrow();
});
