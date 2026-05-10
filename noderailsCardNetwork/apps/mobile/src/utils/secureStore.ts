// Lightweight compatibility shim for expo-secure-store with web fallback.
// Exports the same async API used by the app: setItemAsync, getItemAsync, deleteItemAsync.
//
// Expo Web bundles expo-secure-store with no native implementation (getValueWithKeyAsync is
// missing). On web we use localStorage only and never call into that module.
import { Platform } from 'react-native';

const isFunction = (v: unknown): v is (...args: unknown[]) => unknown => typeof v === 'function';

function webSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new Error('Secure storage not available');
  }
}

function webGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webDelete(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    throw new Error('Secure storage not available');
  }
}

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    webSet(key, value);
    return;
  }

  try {
    const mod = await import('expo-secure-store');
    if (isFunction(mod.setItemAsync)) return mod.setItemAsync(key, value) as Promise<void>;
    if (mod.default && isFunction(mod.default.setItemAsync))
      return mod.default.setItemAsync(key, value) as Promise<void>;
  } catch {
    /* fall through */
  }

  throw new Error('Secure storage not available');
};

export const getItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return webGet(key);
  }

  try {
    const mod = await import('expo-secure-store');
    if (isFunction(mod.getItemAsync)) return mod.getItemAsync(key) as Promise<string | null>;
    if (mod.default && isFunction(mod.default.getItemAsync))
      return mod.default.getItemAsync(key) as Promise<string | null>;
  } catch {
    /* fall through */
  }

  return null;
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    webDelete(key);
    return;
  }

  try {
    const mod = await import('expo-secure-store');
    if (isFunction(mod.deleteItemAsync)) return mod.deleteItemAsync(key) as Promise<void>;
    if (mod.default && isFunction(mod.default.deleteItemAsync))
      return mod.default.deleteItemAsync(key) as Promise<void>;
  } catch {
    /* fall through */
  }

  throw new Error('Secure storage not available');
};

export default { setItemAsync, getItemAsync, deleteItemAsync };
