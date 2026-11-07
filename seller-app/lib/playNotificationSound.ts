import { Platform } from 'react-native';

// Bundled copy of the repo-root notification.wav (web playback).
const notificationWav = require('../assets/notification.wav') as string | { uri?: string };

let webAudio: HTMLAudioElement | null = null;

function webSoundUri() {
  if (typeof notificationWav === 'string') return notificationWav;
  return notificationWav?.uri ?? '';
}

let lastPlayedAt = 0;

function playWeb() {
  if (typeof Audio === 'undefined') return;
  const uri = webSoundUri();
  if (!uri) return;
  try {
    if (!webAudio) {
      webAudio = new Audio(uri);
      webAudio.preload = 'auto';
    }
    webAudio.currentTime = 0;
    void webAudio.play().catch(() => {
      /* Browser may block autoplay until a tap */
    });
  } catch {
    /* ignore */
  }
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    () => {
      const uri = webSoundUri();
      if (!uri || typeof Audio === 'undefined') return;
      const audio = webAudio ?? new Audio(uri);
      webAudio = audio;
      audio.muted = true;
      void audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }).catch(() => {});
    },
    { once: true },
  );
}

/**
 * Web plays notification.wav directly.
 * On the phone, sound comes from the real notification (title + message + channel).
 * A blank local alert only vibrates and shows an empty row in the shade.
 */
export function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;

  if (Platform.OS === 'web') playWeb();
}
