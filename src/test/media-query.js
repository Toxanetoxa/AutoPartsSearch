/** Controllable matchMedia for responsive component tests; all queries share one match state. */
export function createMatchMedia(initial = false) {
  let matches = Boolean(initial);
  const records = [];

  function matchMedia(query) {
    const listeners = new Set();
    const mediaQuery = {
      media: query,
      get matches() {
        return matches;
      },
      onchange: null,
      addEventListener(type, listener) {
        if (type === 'change') listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type === 'change') listeners.delete(listener);
      },
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
      dispatchEvent(event) {
        if (event.type === 'change') {
          for (const listener of listeners) listener.call(mediaQuery, event);
          mediaQuery.onchange?.call(mediaQuery, event);
        }
        return !event.defaultPrevented;
      },
    };
    records.push({ mediaQuery, listeners });
    return mediaQuery;
  }

  function setMatches(value) {
    const next = Boolean(value);
    if (next === matches) return;
    matches = next;
    for (const { mediaQuery } of records) {
      const event = Object.assign(new Event('change'), { matches, media: mediaQuery.media });
      mediaQuery.dispatchEvent(event);
    }
  }

  function listenerCount() {
    return records.reduce((count, record) => count + record.listeners.size, 0);
  }

  return { matchMedia, setMatches, listenerCount };
}
