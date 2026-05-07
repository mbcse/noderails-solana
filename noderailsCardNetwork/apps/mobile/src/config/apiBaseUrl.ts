import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Default API TCP port when not overridden by `EXPO_PUBLIC_API_PORT`. */
const DEFAULT_LOCAL_API_PORT = 9080;

function apiPortString(): string {
  const n = Number(process.env.EXPO_PUBLIC_API_PORT ?? DEFAULT_LOCAL_API_PORT);
  return String(Number.isFinite(n) && n > 0 ? n : DEFAULT_LOCAL_API_PORT);
}

/**
 * Resolve the WallCard API origin for this runtime.
 *
 * - **Expo Web (browser):** uses the **same hostname as the page** + API port (default 9080), so
 *   `http://localhost:8090` → `http://localhost:9080` and `http://192.168.x.x:8090` → `http://192.168.x.x:9080`.
 *   This avoids timeouts when `.env` pins a stale `EXPO_PUBLIC_API_URL` LAN IP while you open the app on localhost.
 *   Set `EXPO_PUBLIC_API_WEB_USE_ENV_URL=true` to force `EXPO_PUBLIC_API_URL` on web instead.
 * - **Native (iOS/Android):** uses `EXPO_PUBLIC_API_URL` when set, else infers host from Expo debugger metadata / emulator rules.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const portStr = apiPortString();

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const forceEnv = process.env.EXPO_PUBLIC_API_WEB_USE_ENV_URL === 'true';
      if (!forceEnv) {
        const proto = window.location.protocol === 'https:' ? 'https' : 'http';
        return `${proto}://${window.location.hostname}:${portStr}`;
      }
    }
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    return `http://localhost:${portStr}`;
  }

  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (!__DEV__) {
    return `http://localhost:${portStr}`;
  }

  const dbg =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | undefined)?.debuggerHost;

  let host = dbg?.split(':')[0]?.trim();

  if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1' || !host)) {
    return `http://10.0.2.2:${portStr}`;
  }

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${portStr}`;
  }

  return `http://localhost:${portStr}`;
}
