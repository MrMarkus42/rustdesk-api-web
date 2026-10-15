// Session options, remembered per device in this browser (like the app keeps them per peer).
const PREFIX = 'remote-settings:'

const isMacBrowser = /Mac/i.test(navigator.platform || navigator.userAgent)

export const DEFAULTS = {
  viewStyle: 'adaptive', // original | adaptive | custom
  customScale: 100, // percent, view style "custom"
  scrollStyle: 'scrollbar', // scrollbar | scrollauto
  imageQuality: 'balanced', // best | balanced | low | custom
  customQuality: 50, // percent of the default bitrate
  customFps: 30,
  codec: 'auto', // auto | vp8 | vp9 | av1 | h264 | h265
  i444: false,
  showRemoteCursor: false,
  followRemoteCursor: false,
  followRemoteWindow: false,
  zoomCursor: false,
  showQualityMonitor: false,
  mute: false,
  disableClipboard: false,
  lockAfterSessionEnd: false,
  viewOnly: false,
  keyboardMode: 'map', // map | translate | legacy
  swapCtrlCmd: false,
  reverseWheel: false,
  swapMouseButtons: false,
  // German and most European Mac keyboards are ISO; US ones are ANSI.
  isoMac: isMacBrowser && !String(navigator.language || '').startsWith('en-US'),
  pinned: true,
  toolbarOffset: 0, // horizontal drag offset of the toolbar in px
}

export function loadSettings (id) {
  const s = { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (raw) {
      const saved = JSON.parse(raw)
      for (const k of Object.keys(DEFAULTS)) {
        if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k]
      }
    }
  } catch (e) { /* storage blocked or damaged: defaults */ }
  return s
}

export function saveSettings (id, s) {
  try {
    const out = {}
    for (const k of Object.keys(DEFAULTS)) out[k] = s[k]
    localStorage.setItem(PREFIX + id, JSON.stringify(out))
  } catch (e) { /* storage blocked */ }
}

export { isMacBrowser }
