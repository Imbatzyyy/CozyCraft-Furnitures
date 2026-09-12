import { localStore, sessionStore, storageKeys } from "@/lib/shared/browser-storage";

export function createCustomerAuthStorage(local: Storage, session: Storage, prefix = "cozycraft-customer-auth") {
  const modeKey = `${prefix}:persistence`;
  const selected = () => session.getItem(modeKey) === "session" ? session : local;
  return {
    getItem(key: string) { return selected().getItem(key); },
    setItem(key: string, value: string) {
      const target = selected();
      target.setItem(key, value);
      (target === local ? session : local).removeItem(key);
    },
    removeItem(key: string) { local.removeItem(key); session.removeItem(key); },
    setPersistent(remember: boolean) {
      const source = selected();
      const target = remember ? local : session;
      const values = storageKeys(source).filter(key => key.startsWith(prefix) && key !== modeKey)
        .map(key => [key, source.getItem(key)] as const);
      session.setItem(modeKey, remember ? "persistent" : "session");
      for (const [key, value] of values) {
        if (value !== null) target.setItem(key, value);
      }
      const other = target === local ? session : local;
      for (const key of storageKeys(other)) if (key.startsWith(prefix) && key !== modeKey) other.removeItem(key);
    },
  };
}
export const customerAuthStorage = createCustomerAuthStorage(localStore, sessionStore);
