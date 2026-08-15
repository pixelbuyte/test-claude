/**
 * The browser storage adapter.
 *
 * This is the only file that names localStorage. SaveManager takes an adapter
 * rather than importing one, which is what keeps it inside the purity rule and
 * testable against quota, corruption and outright failure.
 *
 * Every call is guarded: localStorage throws on access in some private-browsing
 * modes, before you have even written anything.
 */

export function localStorageAdapter() {
  return {
    read(key) {
      return window.localStorage.getItem(key);
    },
    write(key, value) {
      window.localStorage.setItem(key, value);
    },
    remove(key) {
      window.localStorage.removeItem(key);
    },
  };
}

/**
 * Returns a working adapter, falling back to an in-memory one when storage is
 * unavailable. The game stays playable; only persistence is lost.
 */
export function bestAvailableAdapter() {
  try {
    const probe = '__vertigo_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return { adapter: localStorageAdapter(), persistent: true };
  } catch {
    let value = null;
    return {
      adapter: {
        read: () => value,
        write: (_key, v) => { value = v; },
        remove: () => { value = null; },
      },
      persistent: false,
    };
  }
}
