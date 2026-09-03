import { Linking } from "react-native";
import { EMERGENCY_NUMBER, dialable } from "@mfc/shared";

/** Open the dialer with the number pre-filled (no CALL_PHONE permission needed). */
export async function callNumber(phone: string): Promise<boolean> {
  const number = dialable(phone);
  if (!number) return false;
  try {
    await Linking.openURL(`tel:${number}`);
    return true;
  } catch {
    return false;
  }
}

export const callEms = () => callNumber(EMERGENCY_NUMBER);
export { EMERGENCY_NUMBER };
