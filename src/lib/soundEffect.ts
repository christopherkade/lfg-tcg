"use client";

// Web Audio API playback, instead of HTMLAudioElement, avoids iOS Safari's
// Dynamic Island "now playing" pill that appears when an <audio> element
// plays — even for short UI sound effects like button clicks and chimes.
const bufferCache = new Map<string, Promise<AudioBuffer>>();
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!sharedContext) {
    sharedContext = new AudioContextCtor();
  }
  return sharedContext;
}

function loadBuffer(context: AudioContext, src: string): Promise<AudioBuffer> {
  let cached = bufferCache.get(src);
  if (!cached) {
    cached = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data));
    bufferCache.set(src, cached);
  }
  return cached;
}

export function playSound(
  src: string,
  { volume = 1, playbackRate = 1 }: { volume?: number; playbackRate?: number } = {},
) {
  const context = getAudioContext();
  if (!context) return;

  const play = () => {
    void loadBuffer(context, src)
      .then((buffer) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;

        const gain = context.createGain();
        gain.gain.value = volume;

        source.connect(gain).connect(context.destination);
        source.start();
      })
      .catch(() => {});
  };

  if (context.state === "suspended") {
    void context.resume().then(play).catch(() => {});
  } else {
    play();
  }
}
