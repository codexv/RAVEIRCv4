// Channels flagged to auto-join on connect, persisted as channelKey()s
// ("network/#channel"). Shared by the Channel Manager (edits) and the store
// (joins them when a matching server registers).

const AUTOJOIN_KEY = "raveirc.autojoinChannels";

export function loadAutojoin(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(AUTOJOIN_KEY) ?? "");
    if (Array.isArray(r)) return r;
  } catch {
    /* ignore */
  }
  return [];
}

export function saveAutojoin(list: string[]) {
  localStorage.setItem(AUTOJOIN_KEY, JSON.stringify(list));
}
