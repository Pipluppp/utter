import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef } from 'react';

const KEYS = {
  generate: 'utter_form_generate',
  design: 'utter_form_design',
} as const;

type FormKey = keyof typeof KEYS;

export async function loadFormState<T>(key: FormKey): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(KEYS[key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveFormState<T extends Record<string, unknown>>(key: FormKey, state: T): Promise<void> {
  await SecureStore.setItemAsync(KEYS[key], JSON.stringify(state));
}

export async function clearFormState(key: FormKey): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS[key]);
}

/**
 * Hook that returns a debounced save function for form state.
 * Call the returned function whenever form values change.
 */
export function useDebouncedFormSave<T extends Record<string, unknown>>(key: FormKey, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(
    (state: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void saveFormState(key, state);
      }, delay);
    },
    [key, delay],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return save;
}
