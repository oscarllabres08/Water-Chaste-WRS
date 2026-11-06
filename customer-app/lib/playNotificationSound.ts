import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensureAndroidNotificationChannels, NOTIF_CHANNEL_SOUND, notificationContentSound } from './notificationChannels';

// Bundled copy of the repo-root notification.wav (also used by the native notification channel).
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

/** Play notification.wav. Native uses the bundled raw sound; web uses the asset file. */
export function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;

  if (Platform.OS === 'web') {
    playWeb();
    return;
  }

  void (async () => {
    try {
      await ensureAndroidNotificationChannels();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: ' ',
          body: ' ',
          sound: notificationContentSound(true),
          data: { soundOnly: '1' },
          ...(Platform.OS === 'android' ? { channelId: NOTIF_CHANNEL_SOUND } : {}),
        },
        trigger: null,
      });
    } catch {
      /* permission missing or notifications unsupported */
    }
  })();
}
