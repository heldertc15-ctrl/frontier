import reelPromptUrl from '../assets/audio/reel-prompt.m4a';

let context: AudioContext | undefined;
let recording: Promise<AudioBuffer | null> | undefined;
let source: AudioBufferSourceNode | undefined;
let gain: GainNode | undefined;
let generation = 0;

function loadRecording(audio: AudioContext): Promise<AudioBuffer | null> {
  if (recording) return recording;
  const pending = fetch(reelPromptUrl, { signal: AbortSignal.timeout(5000) })
    .then((response) => {
      if (!response.ok) throw new Error('Reel Pull audio unavailable');
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

/** Unlock and load silently during a player gesture, before an optional prompt is offered. */
export function prepareReelPromptSound(): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      recording = undefined;
    }
    if (context.state !== 'running') void context.resume().catch(() => {});
    void loadRecording(context);
  } catch {
    // Sound is optional; a blocked audio device must not affect Fishing.
  }
}

export function stopReelPromptSound(): void {
  generation++;
  if (source) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The source may already have reached the end of its buffer.
    }
    source.disconnect();
    source = undefined;
  }
  gain?.disconnect();
  gain = undefined;
}

/** Join the server's remaining window; never restart a full clip after a late poll. */
export function playReelPromptSound(remainingMs: number, windowMs: number): void {
  stopReelPromptSound();
  const audio = context;
  if (!audio || audio.state !== 'running' || remainingMs <= 0 || windowMs <= 0) return;
  const requestGeneration = generation;
  const requestedAt = performance.now();
  void loadRecording(audio)
    .then((buffer) => {
      if (!buffer || generation !== requestGeneration || audio.state !== 'running') return;
      const remaining = Math.min(windowMs, remainingMs - (performance.now() - requestedAt));
      if (remaining <= 0 || buffer.duration <= 0) return;

      const nextSource = audio.createBufferSource();
      const nextGain = audio.createGain();
      const seconds = remaining / 1000;
      const offset = buffer.duration * (1 - remaining / windowMs);
      nextSource.buffer = buffer;
      nextSource.playbackRate.value = buffer.duration / (windowMs / 1000);
      nextGain.gain.setValueAtTime(0.5, audio.currentTime);
      nextGain.gain.setValueAtTime(0.5, audio.currentTime + Math.max(0, seconds - 0.15));
      nextGain.gain.linearRampToValueAtTime(0, audio.currentTime + seconds);
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
        nextSource.start(0, offset);
        nextSource.stop(audio.currentTime + seconds);
        source = nextSource;
        gain = nextGain;
      } catch {
        nextSource.disconnect();
        nextGain.disconnect();
      }
    })
    .catch(() => {});
}
