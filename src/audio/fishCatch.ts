import fishCatchUrl from '../assets/audio/fish-catch.mp3';

let context: AudioContext | undefined;
let recording: Promise<AudioBuffer | null> | undefined;
let source: AudioBufferSourceNode | undefined;
let gain: GainNode | undefined;
let generation = 0;

function loadRecording(audio: AudioContext): Promise<AudioBuffer | null> {
  if (recording) return recording;
  const pending = fetch(fishCatchUrl, { signal: AbortSignal.timeout(5000) })
    .then((response) => {
      if (!response.ok) throw new Error('Fish catch audio unavailable');
      return response.arrayBuffer();
    })
    .then((bytes) => audio.decodeAudioData(bytes))
    .catch(() => {
      if (recording === pending) recording = undefined;
      return null;
    });
  recording = pending;
  return pending;
}

/** Unlock and cache silently on a player gesture so a later confirmed catch can play. */
export function prepareFishCatchSound(): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      recording = undefined;
    }
    if (context.state !== 'running') void context.resume().catch(() => {});
    void loadRecording(context);
  } catch {
    // The catch is still shown when audio is unavailable.
  }
}

export function stopFishCatchSound(): void {
  generation++;
  if (source) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The recording may already have ended.
    }
    source.disconnect();
    source = undefined;
  }
  gain?.disconnect();
  gain = undefined;
}

/** Play only for a freshly confirmed catch, never for a restored latest-catch card. */
export function playFishCatchSound(): void {
  stopFishCatchSound();
  const audio = context;
  if (!audio || audio.state !== 'running') return;
  const requestGeneration = generation;
  const requestedAt = performance.now();
  void loadRecording(audio)
    .then((buffer) => {
      if (
        !buffer ||
        generation !== requestGeneration ||
        audio.state !== 'running' ||
        performance.now() - requestedAt > 500
      )
        return;
      const nextSource = audio.createBufferSource();
      const nextGain = audio.createGain();
      nextSource.buffer = buffer;
      nextGain.gain.value = 0.5;
      nextSource.connect(nextGain);
      nextGain.connect(audio.destination);
      nextSource.onended = () => {
        nextSource.disconnect();
        nextGain.disconnect();
        if (source === nextSource) {
          source = undefined;
          gain = undefined;
        }
      };
      try {
        nextSource.start();
        source = nextSource;
        gain = nextGain;
      } catch {
        nextSource.disconnect();
        nextGain.disconnect();
      }
    })
    .catch(() => {});
}
