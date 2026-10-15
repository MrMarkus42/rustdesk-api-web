// Keyboard: physical keys (KeyboardEvent.code) become the peer's own key codes ("map" mode),
// so the layout configured on the remote side applies, as when sitting in front of it.
// Codes per platform: Windows scan code set 1 (0xE0xx = extended), Linux evdev, macOS virtual key.
import { ControlKey, KeyboardMode } from './gen/message_pb.js'

// code: [windows, linux evdev, macOS]
const KEYS = {
  Escape: [0x01, 1, 0x35],
  Digit1: [0x02, 2, 0x12],
  Digit2: [0x03, 3, 0x13],
  Digit3: [0x04, 4, 0x14],
  Digit4: [0x05, 5, 0x15],
  Digit5: [0x06, 6, 0x17],
  Digit6: [0x07, 7, 0x16],
  Digit7: [0x08, 8, 0x1A],
  Digit8: [0x09, 9, 0x1C],
  Digit9: [0x0A, 10, 0x19],
  Digit0: [0x0B, 11, 0x1D],
  Minus: [0x0C, 12, 0x1B],
  Equal: [0x0D, 13, 0x18],
  Backspace: [0x0E, 14, 0x33],
  Tab: [0x0F, 15, 0x30],
  KeyQ: [0x10, 16, 0x0C],
  KeyW: [0x11, 17, 0x0D],
  KeyE: [0x12, 18, 0x0E],
  KeyR: [0x13, 19, 0x0F],
  KeyT: [0x14, 20, 0x11],
  KeyY: [0x15, 21, 0x10],
  KeyU: [0x16, 22, 0x20],
  KeyI: [0x17, 23, 0x22],
  KeyO: [0x18, 24, 0x1F],
  KeyP: [0x19, 25, 0x23],
  BracketLeft: [0x1A, 26, 0x21],
  BracketRight: [0x1B, 27, 0x1E],
  Enter: [0x1C, 28, 0x24],
  ControlLeft: [0x1D, 29, 0x3B],
  KeyA: [0x1E, 30, 0x00],
  KeyS: [0x1F, 31, 0x01],
  KeyD: [0x20, 32, 0x02],
  KeyF: [0x21, 33, 0x03],
  KeyG: [0x22, 34, 0x05],
  KeyH: [0x23, 35, 0x04],
  KeyJ: [0x24, 36, 0x26],
  KeyK: [0x25, 37, 0x28],
  KeyL: [0x26, 38, 0x25],
  Semicolon: [0x27, 39, 0x29],
  Quote: [0x28, 40, 0x27],
  Backquote: [0x29, 41, 0x32],
  ShiftLeft: [0x2A, 42, 0x38],
  Backslash: [0x2B, 43, 0x2A],
  KeyZ: [0x2C, 44, 0x06],
  KeyX: [0x2D, 45, 0x07],
  KeyC: [0x2E, 46, 0x08],
  KeyV: [0x2F, 47, 0x09],
  KeyB: [0x30, 48, 0x0B],
  KeyN: [0x31, 49, 0x2D],
  KeyM: [0x32, 50, 0x2E],
  Comma: [0x33, 51, 0x2B],
  Period: [0x34, 52, 0x2F],
  Slash: [0x35, 53, 0x2C],
  ShiftRight: [0x36, 54, 0x3C],
  NumpadMultiply: [0x37, 55, 0x43],
  AltLeft: [0x38, 56, 0x3A],
  Space: [0x39, 57, 0x31],
  CapsLock: [0x3A, 58, 0x39],
  F1: [0x3B, 59, 0x7A],
  F2: [0x3C, 60, 0x78],
  F3: [0x3D, 61, 0x63],
  F4: [0x3E, 62, 0x76],
  F5: [0x3F, 63, 0x60],
  F6: [0x40, 64, 0x61],
  F7: [0x41, 65, 0x62],
  F8: [0x42, 66, 0x64],
  F9: [0x43, 67, 0x65],
  F10: [0x44, 68, 0x6D],
  NumLock: [0x45, 69, 0x47],
  ScrollLock: [0x46, 70, null],
  Numpad7: [0x47, 71, 0x59],
  Numpad8: [0x48, 72, 0x5B],
  Numpad9: [0x49, 73, 0x5C],
  NumpadSubtract: [0x4A, 74, 0x4E],
  Numpad4: [0x4B, 75, 0x56],
  Numpad5: [0x4C, 76, 0x57],
  Numpad6: [0x4D, 77, 0x58],
  NumpadAdd: [0x4E, 78, 0x45],
  Numpad1: [0x4F, 79, 0x53],
  Numpad2: [0x50, 80, 0x54],
  Numpad3: [0x51, 81, 0x55],
  Numpad0: [0x52, 82, 0x52],
  NumpadDecimal: [0x53, 83, 0x41],
  IntlBackslash: [0x56, 86, 0x0A],
  F11: [0x57, 87, 0x67],
  F12: [0x58, 88, 0x6F],
  NumpadEqual: [0x59, 117, 0x51],
  IntlRo: [0x73, 89, 0x5E],
  IntlYen: [0x7D, 124, 0x5D],
  NumpadEnter: [0xE01C, 96, 0x4C],
  ControlRight: [0xE01D, 97, 0x3E],
  NumpadDivide: [0xE035, 98, 0x4B],
  PrintScreen: [0xE037, 99, 0x69],
  AltRight: [0xE038, 100, 0x3D],
  Home: [0xE047, 102, 0x73],
  ArrowUp: [0xE048, 103, 0x7E],
  PageUp: [0xE049, 104, 0x74],
  ArrowLeft: [0xE04B, 105, 0x7B],
  ArrowRight: [0xE04D, 106, 0x7C],
  End: [0xE04F, 107, 0x77],
  ArrowDown: [0xE050, 108, 0x7D],
  PageDown: [0xE051, 109, 0x79],
  Insert: [0xE052, 110, 0x72],
  Delete: [0xE053, 111, 0x75],
  MetaLeft: [0xE05B, 125, 0x37],
  MetaRight: [0xE05C, 126, 0x36],
  ContextMenu: [0xE05D, 127, 0x6E],
}

// For peers without map mode (Android, versions before 1.2.0): keys by meaning.
const LEGACY_CONTROL = {
  Alt: ControlKey.Alt,
  AltGraph: ControlKey.RAlt,
  Backspace: ControlKey.Backspace,
  CapsLock: ControlKey.CapsLock,
  Control: ControlKey.Control,
  Delete: ControlKey.Delete,
  ArrowDown: ControlKey.DownArrow,
  ArrowLeft: ControlKey.LeftArrow,
  ArrowRight: ControlKey.RightArrow,
  ArrowUp: ControlKey.UpArrow,
  End: ControlKey.End,
  Escape: ControlKey.Escape,
  Home: ControlKey.Home,
  Insert: ControlKey.Insert,
  Meta: ControlKey.Meta,
  PageDown: ControlKey.PageDown,
  PageUp: ControlKey.PageUp,
  Enter: ControlKey.Return,
  Shift: ControlKey.Shift,
  Tab: ControlKey.Tab,
  ' ': ControlKey.Space,
  F1: ControlKey.F1,
  F2: ControlKey.F2,
  F3: ControlKey.F3,
  F4: ControlKey.F4,
  F5: ControlKey.F5,
  F6: ControlKey.F6,
  F7: ControlKey.F7,
  F8: ControlKey.F8,
  F9: ControlKey.F9,
  F10: ControlKey.F10,
  F11: ControlKey.F11,
  F12: ControlKey.F12,
  ContextMenu: ControlKey.Apps,
  Pause: ControlKey.Pause,
  PrintScreen: ControlKey.Snapshot,
  NumLock: ControlKey.NumLock,
  ScrollLock: ControlKey.Scroll,
}

export function versionNumber (v) {
  const p = String(v || '').split('.').map((x) => parseInt(x, 10) || 0)
  return (p[0] || 0) * 1000000 + (p[1] || 0) * 1000 + (p[2] || 0)
}

export function peerOs (platform) {
  const p = String(platform || '').toLowerCase()
  if (p.startsWith('windows')) return 'windows'
  if (p.startsWith('mac')) return 'macos'
  if (p.startsWith('android')) return 'android'
  if (p.startsWith('linux')) return 'linux'
  return p
}

// Keyboard modes the peer understands (as the app decides it).
export function supportedKeyboardModes (peerInfo) {
  const v = versionNumber(peerInfo.version)
  const modes = []
  if (peerOs(peerInfo.platform) !== 'android' && v >= versionNumber('1.2.0')) modes.push('map')
  if (v >= versionNumber('1.2.0')) modes.push('translate')
  modes.push('legacy')
  return modes
}

export function supportsMapMode (peerInfo) {
  const os = peerOs(peerInfo.platform)
  return os !== 'android' && os !== '' && versionNumber(peerInfo.version) >= versionNumber('1.2.0')
}

function lockModifiers (ev) {
  const m = []
  if (ev.getModifierState && ev.getModifierState('CapsLock')) m.push(ControlKey.CapsLock)
  if (ev.getModifierState && ev.getModifierState('NumLock')) m.push(ControlKey.NumLock)
  return m
}

function legacyModifiers (ev, swap = false) {
  const m = lockModifiers(ev)
  const ctrl = swap ? ev.metaKey : ev.ctrlKey
  const meta = swap ? ev.ctrlKey : ev.metaKey
  if (ev.altKey) m.push(ControlKey.Alt)
  if (ctrl) m.push(ControlKey.Control)
  if (ev.shiftKey) m.push(ControlKey.Shift)
  if (meta) m.push(ControlKey.Meta)
  return m
}

const SWAP_CTRL_CMD = {
  ControlLeft: 'MetaLeft',
  MetaLeft: 'ControlLeft',
  ControlRight: 'MetaRight',
  MetaRight: 'ControlRight',
}

// Keys that produce a character in translate mode (numpad keys stay positional, as in the app).
function translatedChar (ev) {
  if (!ev.key || [...ev.key].length !== 1 || /^Numpad/.test(ev.code || '')) return null
  if (ev.ctrlKey || ev.metaKey) return null
  // Alt without AltGr is a shortcut, not a character.
  if (ev.altKey && !(ev.getModifierState && ev.getModifierState('AltGraph'))) return null
  return ev.key
}

// Builds the KeyEvent for a browser key event, or null when the key cannot be sent.
// opts.mode: 'map' (keys by position), 'translate' (characters as typed here, other keys by
//   position) or 'legacy' (keys by meaning);
// opts.isoMac: the browser runs on a Mac with an ISO keyboard (the two keys left of "1" and
//   right of left Shift come out swapped there);
// opts.swapCtrlCmd: Ctrl and Cmd change places (between a Mac and another system).
// opts.translated: Set of codes sent as characters, so their release is not sent.
export function keyEventFor (ev, down, peerInfo, opts = {}) {
  const mode = opts.mode || 'map'
  if (mode !== 'legacy' && supportsMapMode(peerInfo)) {
    const os = peerOs(peerInfo.platform)
    const kbMode = mode === 'translate' ? KeyboardMode.Translate : KeyboardMode.Map
    if (mode === 'translate' && opts.translated) {
      if (down) {
        const ch = translatedChar(ev)
        if (ch !== null) {
          opts.translated.add(ev.code)
          return { down: true, union: { case: 'seq', value: ch }, modifiers: lockModifiers(ev), mode: kbMode }
        }
      } else if (opts.translated.has(ev.code)) {
        opts.translated.delete(ev.code)
        return null
      }
    }
    // Windows has no scan code of its own for Pause.
    if (ev.code === 'Pause' && os === 'windows') {
      return { down, union: { case: 'controlKey', value: ControlKey.Pause }, modifiers: legacyModifiers(ev), mode: KeyboardMode.Legacy }
    }
    let code = ev.code
    if (opts.swapCtrlCmd && SWAP_CTRL_CMD[code]) code = SWAP_CTRL_CMD[code]
    if (opts.isoMac && os !== 'macos') {
      if (code === 'Backquote') code = 'IntlBackslash'
      else if (code === 'IntlBackslash') code = 'Backquote'
    }
    const entry = KEYS[code]
    if (!entry) {
      // No physical key (on-screen keyboards, some phones): send the character itself.
      return down && ev.key && [...ev.key].length === 1
        ? { press: true, union: { case: 'seq', value: ev.key }, modifiers: lockModifiers(ev), mode: KeyboardMode.Legacy }
        : null
    }
    let chr
    if (os === 'windows') chr = entry[0]
    else if (os === 'macos') chr = entry[2]
    else chr = entry[1] + 8 // X11 key codes are evdev + 8 (also what Wayland peers expect)
    if (chr === null || chr === undefined) return null
    return { down, union: { case: 'chr', value: chr }, modifiers: lockModifiers(ev), mode: kbMode }
  }
  let key = ev.key
  if (opts.swapCtrlCmd && (key === 'Control' || key === 'Meta')) key = key === 'Control' ? 'Meta' : 'Control'
  const ck = LEGACY_CONTROL[key]
  if (ck !== undefined) {
    return { down, union: { case: 'controlKey', value: ck }, modifiers: legacyModifiers(ev, opts.swapCtrlCmd), mode: KeyboardMode.Legacy }
  }
  if (down && ev.key && [...ev.key].length === 1) {
    // Printable character: typed as it is, on key down only.
    return { press: true, union: { case: 'seq', value: ev.key }, modifiers: lockModifiers(ev), mode: KeyboardMode.Legacy }
  }
  return null
}

export function isModifierCode (code) {
  return /^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code)
}
