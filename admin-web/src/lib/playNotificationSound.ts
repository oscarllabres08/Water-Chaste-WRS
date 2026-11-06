let audio: HTMLAudioElement | null = null;

function ensureAudio() {
  if (!audio) {
    audio = new Audio('/notification.wav');
    audio.preload = 'auto';
  }
  return audio;
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      const primed = ensureAudio();
      primed.muted = true;
      void primed.play().then(() => {
        primed.pause();
        primed.currentTime = 0;
        primed.muted = false;
      }).catch(() => {
        /* still locked until a later gesture */
      });
    },
    { once: true },
  );
}

export function playNotificationSound() {
  try {
    const player = ensureAudio();
    player.currentTime = 0;
    void player.play().catch(() => {
      /* Browser may block autoplay until user interaction */
    });
  } catch {
    /* ignore */
  }
}
