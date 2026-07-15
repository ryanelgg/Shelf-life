import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { AvoConsentModal } from './AvoConsentModal';

/**
 * "Prompt-first" Avo-AI consent gate for the buttons that send data to the AI
 * outside of chat — receipt scan, fridge scan, and "Generate with Avo".
 *
 * Chat already blocks until consent is granted; these buttons used to skip the
 * toggle entirely, which broke the promise the Settings screen makes ("Avo AI"
 * covers scans too). `ensureConsent` closes that gap the same way chat does:
 * if consent is already granted the action runs immediately, otherwise it pops
 * the AvoConsentModal first and defers the action until the user accepts.
 * Declining cancels the action (nothing is sent).
 *
 * Consent is read from the store at call time (not via a captured value) so a
 * fresh grant is seen immediately without waiting for a re-render.
 */
export function useAiConsentGate() {
  const setAvoAiConsent = useStore(s => s.setAvoAiConsent);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const ensureConsent = useCallback((action: () => void) => {
    if (useStore.getState().avoAiConsent === 'granted') { action(); return; }
    setPending(() => action);
  }, []);

  const consentModal = pending ? (
    <AvoConsentModal
      onAccept={() => {
        setAvoAiConsent('granted');
        const action = pending;
        setPending(null);
        action();
      }}
      onDecline={() => {
        setAvoAiConsent('declined');
        setPending(null);
      }}
    />
  ) : null;

  return { ensureConsent, consentModal };
}
