import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function audioFixture() {
  const buffer = { duration: 4 } as AudioBuffer;
  const source = {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const audio = {
    state: 'suspended',
    currentTime: 10,
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

it('stretches the supplied clip across the five-second offer and joins a late offer in progress', async () => {
  const { audio, source, gain, buffer } = audioFixture();
  const { prepareReelPromptSound, playReelPromptSound, stopReelPromptSound } =
    await import('./reelPrompt');
  prepareReelPromptSound();
  await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
  expect(source.start).not.toHaveBeenCalled();

  playReelPromptSound(4000, 5000);
  await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
  expect(source.buffer).toBe(buffer);
  expect(source.playbackRate.value).toBeCloseTo(0.8);
  expect(source.start).toHaveBeenCalledWith(0, expect.closeTo(0.8));
  expect(source.stop).toHaveBeenCalledWith(expect.closeTo(14, 2));
  expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.closeTo(14, 2));

  stopReelPromptSound();
  expect(source.disconnect).toHaveBeenCalledOnce();
  expect(gain.disconnect).toHaveBeenCalledOnce();
});

it('skips audio when decoding finishes after expiry or the prompt was dismissed', async () => {
  const { audio, source, buffer } = audioFixture();
  let finishDecode!: (decoded: AudioBuffer) => void;
  audio.decodeAudioData.mockReturnValueOnce(
    new Promise<AudioBuffer>((resolve) => {
      finishDecode = resolve;
    }),
  );
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const { prepareReelPromptSound, playReelPromptSound, stopReelPromptSound } =
    await import('./reelPrompt');
  prepareReelPromptSound();
  await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
  playReelPromptSound(5000, 5000);
  clock.mockReturnValue(5000);
  finishDecode(buffer);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(source.start).not.toHaveBeenCalled();

  clock.mockReturnValue(0);
  playReelPromptSound(5000, 5000);
  stopReelPromptSound();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(source.start).not.toHaveBeenCalled();
});

it('stays silent when browser audio is unavailable', async () => {
  audioFixture();
  vi.stubGlobal('AudioContext', undefined);
  const { prepareReelPromptSound, playReelPromptSound } = await import('./reelPrompt');
  expect(() => prepareReelPromptSound()).not.toThrow();
  expect(() => playReelPromptSound(5000, 5000)).not.toThrow();
});
