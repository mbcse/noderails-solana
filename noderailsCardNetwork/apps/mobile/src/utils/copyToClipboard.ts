import { setStringAsync } from 'expo-clipboard';

/** Native (iOS / Android): expo-clipboard. Web uses `copyToClipboard.web.ts`. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
