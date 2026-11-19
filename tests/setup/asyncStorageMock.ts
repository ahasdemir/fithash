import { vi } from 'vitest';

/**
 * In-memory AsyncStorage replacement so that `src/services/storage.ts` (and,
 * transitively, every service importing it) can load in a plain node
 * environment. Tests reset state between cases via `AsyncStorage.clear()`,
 * which the mock implements below.
 */
const asyncStorageStore = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string): Promise<string | null> => asyncStorageStore.get(key) ?? null,
    setItem: async (key: string, value: string): Promise<void> => {
      asyncStorageStore.set(key, String(value));
    },
    removeItem: async (key: string): Promise<void> => {
      asyncStorageStore.delete(key);
    },
    multiRemove: async (keys: readonly string[]): Promise<void> => {
      keys.forEach(key => asyncStorageStore.delete(key));
    },
    clear: async (): Promise<void> => {
      asyncStorageStore.clear();
    },
  },
}));
