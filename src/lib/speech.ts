// Thin wrapper over the Web Speech API for one-shot dictation.
//
// On desktop Chrome/Edge and most Android WebViews this works out of the box.
// On iOS WKWebView the API is ABSENT — `isDictationSupported()` returns false
// and callers fall back to typed input (the natural-language parser in
// voiceParse.ts works either way). To get on-device speech inside the native
// iOS app, add `@capacitor-community/speech-recognition` and call it from
// `startDictation` behind a `Capacitor.isNativePlatform()` check.

interface SpeechAlternative { transcript: string }
interface SpeechResult { 0: SpeechAlternative; isFinal: boolean; length: number }
interface SpeechResultList { length: number; [index: number]: SpeechResult }
interface SpeechRecognitionEventLike { resultIndex: number; results: SpeechResultList }
interface SpeechRecognitionErrorLike { error: string }

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isDictationSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface DictationHandle {
  stop(): void;
}

export interface DictationCallbacks {
  /** Fired repeatedly with the best-so-far transcript while the user speaks. */
  onPartial?: (text: string) => void;
  /** Fired once with the final transcript when recognition ends. */
  onFinal: (text: string) => void;
  /** Fired on any error (including 'unsupported'). */
  onError?: (reason: string) => void;
}

export function startDictation(cb: DictationCallbacks): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    cb.onError?.('unsupported');
    return null;
  }
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0].transcript;
      if (result.isFinal) finalText += text;
      else interim += text;
    }
    cb.onPartial?.((finalText + interim).trim());
  };
  rec.onerror = (e) => cb.onError?.(e.error || 'error');
  rec.onend = () => {
    const t = finalText.trim();
    if (t) cb.onFinal(t);
  };

  try {
    rec.start();
  } catch {
    cb.onError?.('start-failed');
    return null;
  }
  return { stop: () => rec.stop() };
}
