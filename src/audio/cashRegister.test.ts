import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function audioFixture(resumeFails = false) {
  const buffer = { duration: 1.8 } as AudioBuffer;
  const source = {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    onended: null,
  };
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const audio = {
    state: 'suspended',
    destination: {},
    decodeAudioData: vi.fn<(data: ArrayBuffer) => Promise<AudioBuffer>>(async () => buffer),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {
      if (resumeFails) throw new Error('Playback is blocked');
      audio.state = 'running';
    }),
  };
  const fetchAudio = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(16),
  }));
  vi.stubGlobal('fetch', fetchAudio);
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return audio;
    }),
  );
  return { audio, source, gain, buffer, fetchAudio };
}

// Allow decoding and playback promise chains to settle without waiting for real audio.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('cash register sound', () => {
  it('loads and unlocks silently, then plays the recording once per confirmed deal', async () => {
    const { audio, source, gain, buffer, fetchAudio } = audioFixture();
    const { prepareCashRegisterSound } = await import('./cashRegister');
    const play = prepareCashRegisterSound();
    expect(audio.resume).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
    expect(audio.createBufferSource).not.toHaveBeenCalled();

    play();
    play();
    await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
    expect(source.buffer).toBe(buffer);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(audio.destination);
    expect(gain.gain.value).toBeGreaterThan(0);
    expect(gain.gain.value).toBeLessThan(1);
    (source.onended as unknown as () => void)();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();

    prepareCashRegisterSound()();
    await vi.waitFor(() => expect(source.start).toHaveBeenCalledTimes(2));
    expect(fetchAudio).toHaveBeenCalledOnce();
    expect(audio.decodeAudioData).toHaveBeenCalledOnce();
  });

  it('ignores rejected browser audio permission without scheduling playback', async () => {
    const { audio } = audioFixture(true);
    const { prepareCashRegisterSound } = await import('./cashRegister');
    prepareCashRegisterSound()();
    await settle();
    expect(audio.createBufferSource).not.toHaveBeenCalled();
  });

  it('leaves unsupported browsers able to finish trades silently', async () => {
    const { fetchAudio } = audioFixture();
    vi.stubGlobal('AudioContext', undefined);
    const { prepareCashRegisterSound } = await import('./cashRegister');
    expect(() => prepareCashRegisterSound()()).not.toThrow();
    expect(fetchAudio).not.toHaveBeenCalled();
  });

  it.each(['network', 'HTTP', 'decode'] as const)(
    'stays silent after a %s failure and can load the recording on a later confirmation',
    async (failure) => {
      const { audio, source, fetchAudio } = audioFixture();
      if (failure === 'network') fetchAudio.mockRejectedValueOnce(new Error('Offline'));
      if (failure === 'HTTP')
        fetchAudio.mockResolvedValueOnce({
          ok: false,
          arrayBuffer: async () => new ArrayBuffer(0),
        });
      if (failure === 'decode')
        audio.decodeAudioData.mockRejectedValueOnce(new Error('Invalid audio'));
      const { prepareCashRegisterSound } = await import('./cashRegister');
      const play = prepareCashRegisterSound();
      // Loading can fail before a sale response arrives; no unhandled rejection should escape.
      await settle();
      play();
      await settle();
      expect(source.start).not.toHaveBeenCalled();

      prepareCashRegisterSound()();
      await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
      expect(fetchAudio).toHaveBeenCalledTimes(2);
    },
  );

  it('suppresses a recording that becomes ready too long after sale success', async () => {
    const { audio, source, buffer } = audioFixture();
    let finishDecode!: (decoded: AudioBuffer) => void;
    audio.decodeAudioData.mockReturnValueOnce(
      new Promise<AudioBuffer>((resolve) => {
        finishDecode = resolve;
      }),
    );
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { prepareCashRegisterSound } = await import('./cashRegister');
    const play = prepareCashRegisterSound();
    await vi.waitFor(() => expect(audio.decodeAudioData).toHaveBeenCalledOnce());
    play();
    clock.mockReturnValue(600);
    finishDecode(buffer);
    await settle();
    expect(source.start).not.toHaveBeenCalled();

    // The recording is still cached for a fresh, timely sale.
    prepareCashRegisterSound()();
    await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
  });

  it('cleans up a failed audio source without throwing into the completed sale', async () => {
    const { source, gain } = audioFixture();
    source.start.mockImplementation(() => {
      throw new Error('Audio device unavailable');
    });
    const { prepareCashRegisterSound } = await import('./cashRegister');
    expect(() => prepareCashRegisterSound()()).not.toThrow();
    await vi.waitFor(() => expect(source.start).toHaveBeenCalledOnce());
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
  });
});
