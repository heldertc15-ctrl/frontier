import cashRegisterUrl from '../assets/audio/cash-register.mp3';

let context: AudioContext | undefined;
let recording: Promise<AudioBuffer | null> | undefined;

function loadRecording(audio: AudioContext): Promise<AudioBuffer | null> {
  if (recording) return recording;
  const pending = fetch(cashRegisterUrl, { signal: AbortSignal.timeout(5000) })
    .then((response) => {
      if (!response.ok) throw new Error('Cash register audio unavailable');
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

/** Unlock silently during the confirmation gesture; play only when the server confirms the sale. */
export function prepareCashRegisterSound(): () => void {
  try {
    if (typeof AudioContext === 'undefined') return () => {};
    if (!context || context.state === 'closed') {
      context = new AudioContext();
      recording = undefined;
    }
    const audio = context;
    const ready =
      audio.state === 'running'
        ? Promise.resolve(true)
        : audio.resume().then(
            () => true,
            () => false,
          );
    const buffer = loadRecording(audio);
    let played = false;

    return () => {
      if (played) return;
      played = true;
      const requestedAt = performance.now();
      void Promise.all([ready, buffer])
        .then(([unlocked, decoded]) => {
          // Skip blocked or delayed playback; audio must never interrupt or hold up a trade.
          if (
            !unlocked ||
            !decoded ||
            audio.state !== 'running' ||
            performance.now() - requestedAt > 500
          )
            return;
          const source = audio.createBufferSource();
          const gain = audio.createGain();
          source.buffer = decoded;
          gain.gain.value = 0.65;
          source.connect(gain);
          gain.connect(audio.destination);
          const disconnect = () => {
            source.disconnect();
            gain.disconnect();
          };
          source.onended = disconnect;
          try {
            source.start();
          } catch {
            disconnect();
          }
        })
        .catch(() => {});
    };
  } catch {
    return () => {};
  }
}
