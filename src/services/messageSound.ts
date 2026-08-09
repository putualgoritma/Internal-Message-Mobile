import Sound from 'react-native-sound';

const SOUND_ENABLED = true;

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

let loadState: LoadState = 'idle';
let incomingSound: Sound | null = null;
let pendingPlay = false;
let isPlaying = false;
let runtimeSoundEnabled = true;

function disableRuntimeSound(reason: string, error?: unknown): void {
  runtimeSoundEnabled = false;
  console.error('[Sound] Disabled runtime sound:', reason, error ?? '');
}

function playLoadedSound(sound: Sound): void {
  if (!runtimeSoundEnabled) {
    return;
  }

  // Avoid overlapping calls; native stop() can crash on some devices.
  if (isPlaying) {
    return;
  }

  try {
    isPlaying = true;
    sound.play(success => {
      isPlaying = false;
      if (!success) {
        console.warn('[Sound] Playback failed for incoming message sound.');
      }
    });
  } catch (error) {
    isPlaying = false;
    disableRuntimeSound('play threw exception', error);
  }
}

function loadFromCandidates(candidates: string[], index: number): void {
  if (index >= candidates.length) {
    loadState = 'failed';
    incomingSound = null;
    console.warn('[Sound] Failed to load incoming message sound from bundle.');
    return;
  }

  const resourceName = candidates[index];

  try {
    incomingSound = new Sound(resourceName, Sound.MAIN_BUNDLE, error => {
      if (error) {
        loadFromCandidates(candidates, index + 1);
        return;
      }

      try {
        loadState = 'ready';
        incomingSound?.setVolume(1);
      } catch (setVolumeError) {
        console.error('[Sound] Error setting volume:', setVolumeError);
      }

      if (pendingPlay && incomingSound) {
        pendingPlay = false;
        playLoadedSound(incomingSound);
      }
    });
  } catch (error) {
    console.error('[Sound] Error creating Sound object:', error);
    loadFromCandidates(candidates, index + 1);
  }
}

function ensureLoaded(): void {
  if (loadState !== 'idle') {
    return;
  }

  try {
    Sound.setCategory('Playback');
  } catch (error) {
    console.warn('[Sound] Error setting audio category:', error);
  }

  loadState = 'loading';

  // Android raw resources are typically resolved without extension.
  loadFromCandidates(['incoming_message', 'incoming_message.wav'], 0);
}

export function playIncomingMessageSound(): void {
  if (!SOUND_ENABLED || !runtimeSoundEnabled) {
    return;
  }

  try {
    ensureLoaded();

    if (loadState === 'loading') {
      pendingPlay = true;
      return;
    }

    if (loadState !== 'ready' || !incomingSound) {
      return;
    }

    playLoadedSound(incomingSound);
  } catch (error) {
    console.error('[Sound] Error in playIncomingMessageSound:', error);
  }
}

export function preloadIncomingMessageSound(): void {
  if (!SOUND_ENABLED || !runtimeSoundEnabled) {
    return;
  }

  try {
    ensureLoaded();
  } catch (error) {
    console.error('[Sound] Error in preloadIncomingMessageSound:', error);
  }
}
