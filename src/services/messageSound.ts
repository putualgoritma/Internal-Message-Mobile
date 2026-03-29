import Sound from 'react-native-sound';

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

let loadState: LoadState = 'idle';
let incomingSound: Sound | null = null;
let pendingPlay = false;

function playLoadedSound(sound: Sound): void {
  sound.stop(() => {
    sound.play(success => {
      if (!success) {
        sound.reset();
      }
    });
  });
}

function loadFromCandidates(candidates: string[], index: number): void {
  if (index >= candidates.length) {
    loadState = 'failed';
    incomingSound = null;
    console.warn('[Sound] Failed to load incoming message sound from bundle.');
    return;
  }

  const resourceName = candidates[index];

  incomingSound = new Sound(resourceName, Sound.MAIN_BUNDLE, error => {
    if (error) {
      loadFromCandidates(candidates, index + 1);
      return;
    }

    loadState = 'ready';
    incomingSound?.setVolume(1);

    if (pendingPlay && incomingSound) {
      pendingPlay = false;
      playLoadedSound(incomingSound);
    }
  });
}

function ensureLoaded(): void {
  if (loadState !== 'idle') {
    return;
  }

  Sound.setCategory('Playback');
  loadState = 'loading';

  // Android raw resources are typically resolved without extension.
  loadFromCandidates(['incoming_message', 'incoming_message.wav'], 0);
}

export function playIncomingMessageSound(): void {
  ensureLoaded();

  if (loadState === 'loading') {
    pendingPlay = true;
    return;
  }

  if (loadState !== 'ready' || !incomingSound) {
    return;
  }

  playLoadedSound(incomingSound);
}

export function preloadIncomingMessageSound(): void {
  ensureLoaded();
}
