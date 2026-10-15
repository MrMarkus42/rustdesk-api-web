// A remote control session: rendezvous (hbbs), relay (hbbr), end-to-end encryption, login and
// the message loop. Written for this client from the RustDesk protocol (src/remote/proto).
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  ConnType,
  IdPkSchema,
  NatType,
  PunchHoleResponse_Failure,
  RendezvousMessageSchema,
} from './gen/rendezvous_pb.js'
import {
  ClipboardFormat,
  ControlKey,
  ImageQuality,
  KeyboardMode,
  MessageSchema,
  OptionMessage_BoolOption,
} from './gen/message_pb.js'
import { Channel, proxyUrl } from './channel.js'
import { versionNumber } from './keyboard.js'
import {
  KX_VERSION_LATEST,
  SecretStream,
  createSessionKey,
  loginHash,
  openSigned,
  parseServerKey,
  passwordHash,
} from './crypto.js'

// Version the peer sees; it gates features on the peer side, so it names one we handle.
export const CLIENT_VERSION = '1.4.2'
const RENDEZVOUS_TIMEOUT = 30000
const HANDSHAKE_TIMEOUT = 15000
// The peer sends a TestDelay every few seconds; this long without anything means it is gone.
const IDLE_TIMEOUT = 30000

// Errors carry a code the UI translates (RemoteErr...).
export class RemoteError extends Error {
  constructor (code, detail = '') {
    super(detail || code)
    this.code = code
    this.detail = detail
  }
}

function randomU64 () {
  const b = new Uint32Array(2)
  crypto.getRandomValues(b)
  return (BigInt(b[0]) << 32n) | BigInt(b[1])
}

export class RemoteConnection {
  // config: {key, punch_token, username, name}; getTicket(): Promise<string>;
  // handlers: {onHash, onLoginError, onPeerInfo, onVideo, onMisc, onMessageBox, onClose}
  constructor (id, config, getTicket, handlers) {
    this.id = id
    this.config = config
    this.getTicket = getTicket
    this.h = handlers
    this.relay = null
    this.stream = null
    this.hash = null
    this.peerInfo = null
    this.closed = false
    this.lastRecv = 0
    this.idleTimer = null
    this.sessionId = randomU64()
    this.decodings = null
    this.bytesIn = 0
  }

  async openChannel (kind) {
    const ticket = await this.getTicket()
    const ch = new Channel()
    try {
      await ch.open(proxyUrl(kind), ticket)
    } catch (e) {
      throw new RemoteError('RemoteErrProxy', e.message)
    }
    return ch
  }

  // Up to the login prompt: returns once the peer asked for the password (onHash).
  async start (decodings) {
    this.decodings = decodings
    const serverPk = parseServerKey(this.config.key)
    if (!serverPk) throw new RemoteError('RemoteErrNoKey')

    const rr = await this.rendezvous()
    if (rr.refuseReason) throw new RemoteError('RemoteErrRefused', rr.refuseReason)
    if (rr.union.case !== 'pk' || !rr.union.value.length) {
      // No signed peer key: the server runs without a key pair. The official client then
      // falls back to an unencrypted session; this one does not.
      throw new RemoteError('RemoteErrInsecure')
    }
    const idPkBytes = openSigned(rr.union.value, serverPk)
    if (!idPkBytes) throw new RemoteError('RemoteErrServerSignature')
    const idPk = fromBinary(IdPkSchema, idPkBytes)
    if (idPk.id !== this.id || idPk.pk.length !== 32) throw new RemoteError('RemoteErrServerSignature')

    this.relay = await this.openChannel('relay')
    this.relay.onclose = () => this.handleClose('RemoteClosedRelay')
    this.relay.send(toBinary(RendezvousMessageSchema, create(RendezvousMessageSchema, {
      union: {
        case: 'requestRelay',
        value: {
          id: this.id,
          uuid: rr.uuid,
          licenceKey: this.config.key,
          connType: ConnType.DEFAULT_CONN,
        },
      },
    })))
    await this.secure(idPk.pk)

    this.lastRecv = Date.now()
    this.relay.listen((data) => this.onData(data))
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastRecv > IDLE_TIMEOUT) this.handleClose('RemoteClosedTimeout')
    }, 5000)
  }

  async rendezvous () {
    const ch = await this.openChannel('id')
    try {
      ch.send(toBinary(RendezvousMessageSchema, create(RendezvousMessageSchema, {
        union: {
          case: 'punchHoleRequest',
          value: {
            id: this.id,
            // A symmetric NAT makes every peer version answer through the relay.
            natType: NatType.SYMMETRIC,
            licenceKey: this.config.key,
            connType: ConnType.DEFAULT_CONN,
            token: this.config.punch_token || '',
            version: CLIENT_VERSION,
            forceRelay: true,
          },
        },
      })))
      const deadline = Date.now() + RENDEZVOUS_TIMEOUT
      for (;;) {
        const left = deadline - Date.now()
        if (left <= 0) throw new RemoteError('RemoteErrNoAnswer')
        const data = await ch.recv(left)
        if (!data) throw new RemoteError(ch.closed ? 'RemoteErrServerClosed' : 'RemoteErrNoAnswer')
        let msg
        try {
          msg = fromBinary(RendezvousMessageSchema, data)
        } catch (e) {
          continue
        }
        if (msg.union.case === 'relayResponse') return msg.union.value
        if (msg.union.case === 'punchHoleResponse') {
          const p = msg.union.value
          if (p.otherFailure) throw new RemoteError('RemoteErrServer', p.otherFailure)
          switch (p.failure) {
            case PunchHoleResponse_Failure.OFFLINE: throw new RemoteError('RemoteErrOffline')
            case PunchHoleResponse_Failure.LICENSE_MISMATCH: throw new RemoteError('RemoteErrKeyMismatch')
            case PunchHoleResponse_Failure.LICENSE_OVERUSE: throw new RemoteError('RemoteErrServer', 'license overuse')
            default: throw new RemoteError('RemoteErrIdNotExist')
          }
        }
      }
    } finally {
      ch.close()
    }
  }

  // Verifies the peer with the key the server signed and agrees on a session key.
  async secure (peerSignPk) {
    const first = await this.relay.recv(HANDSHAKE_TIMEOUT)
    if (!first) throw new RemoteError(this.relay.closed ? 'RemoteErrRelay' : 'RemoteErrNoAnswer')
    let msg
    try {
      msg = fromBinary(MessageSchema, first)
    } catch (e) {
      throw new RemoteError('RemoteErrHandshake')
    }
    if (msg.union.case !== 'signedId') throw new RemoteError('RemoteErrInsecure')
    const signed = openSigned(msg.union.value.id, peerSignPk)
    if (!signed) throw new RemoteError('RemoteErrPeerSignature')
    const idPk = fromBinary(IdPkSchema, signed)
    if (idPk.id !== this.id || idPk.pk.length !== 32) throw new RemoteError('RemoteErrPeerSignature')

    const advertised = idPk.kxVersion || 0
    const picked = Math.min(advertised, KX_VERSION_LATEST)
    const { ourPk, sealed, key } = createSessionKey(idPk.pk)
    this.relay.send(toBinary(MessageSchema, create(MessageSchema, {
      union: {
        case: 'publicKey',
        value: { asymmetricValue: ourPk, symmetricValue: sealed, kxVersion: picked },
      },
    })))
    this.stream = SecretStream.negotiate(key, {
      advertised,
      picked,
      initiatorPk: ourPk,
      responderPk: idPk.pk,
    })
  }

  onData (data) {
    if (this.closed) return
    this.lastRecv = Date.now()
    this.bytesIn += data.length
    let msg
    try {
      msg = fromBinary(MessageSchema, this.stream.open(data))
    } catch (e) {
      this.handleClose('RemoteClosedCorrupt')
      return
    }
    const u = msg.union
    switch (u.case) {
      case 'hash':
        this.hash = u.value
        this.h.onHash && this.h.onHash()
        break
      case 'loginResponse':
        if (u.value.union.case === 'peerInfo') {
          this.peerInfo = u.value.union.value
          this.h.onPeerInfo && this.h.onPeerInfo(this.peerInfo, true)
        } else if (u.value.union.case === 'error') {
          this.h.onLoginError && this.h.onLoginError(u.value.union.value)
        }
        break
      case 'peerInfo':
        this.peerInfo = u.value
        this.h.onPeerInfo && this.h.onPeerInfo(u.value, false)
        break
      case 'testDelay':
        // The peer measures the delay and treats an unanswered connection as dead.
        if (!u.value.fromClient) this.sendMessage({ union: { case: 'testDelay', value: u.value } })
        this.h.onTestDelay && this.h.onTestDelay(u.value)
        break
      case 'videoFrame':
        this.h.onVideo && this.h.onVideo(u.value)
        break
      case 'misc':
        if (u.value.union.case === 'closeReason') {
          this.handleClose('RemoteClosedByPeer', u.value.union.value)
          return
        }
        this.h.onMisc && this.h.onMisc(u.value)
        break
      case 'messageBox':
        this.h.onMessageBox && this.h.onMessageBox(u.value)
        break
      default:
        // cursorData, cursorId, cursorPosition, audioFrame, clipboard, multiClipboards, ...
        this.h.onOther && this.h.onOther(u)
        break
    }
  }

  sendMessage (init) {
    if (this.closed || !this.stream) return
    this.relay.send(this.stream.seal(toBinary(MessageSchema, create(MessageSchema, init))))
  }

  get sendBacklog () {
    return this.relay ? this.relay.buffered : 0
  }

  // password: plain text; savedHash: sha256(password + salt) from the address book;
  // neither: ask the person at the device to accept.
  login ({ password, savedHash, option } = {}) {
    if (!this.hash) return
    let pw = new Uint8Array(0)
    if (password) pw = loginHash(passwordHash(password, this.hash.salt), this.hash.challenge)
    else if (savedHash) pw = loginHash(savedHash, this.hash.challenge)
    const d = this.decodings || {}
    this.sendMessage({
      union: {
        case: 'loginRequest',
        value: {
          username: this.id,
          password: pw,
          myId: 'web-' + (this.config.username || 'user'),
          myName: (this.config.name || this.config.username || 'Web') + ' (Web)',
          myPlatform: 'Web',
          sessionId: this.sessionId,
          version: CLIENT_VERSION,
          option: option || {
            imageQuality: ImageQuality.Balanced,
            disableAudio: OptionMessage_BoolOption.Yes,
            disableClipboard: OptionMessage_BoolOption.Yes,
            supportedDecoding: {
              abilityVp8: d.vp8 ? 1 : 0,
              abilityVp9: d.vp9 ? 1 : 0,
              abilityAv1: d.av1 ? 1 : 0,
              abilityH264: d.h264 ? 1 : 0,
              abilityH265: d.h265 ? 1 : 0,
            },
          },
        },
      },
    })
  }

  send2fa (code) {
    this.sendMessage({ union: { case: 'auth2fa', value: { code } } })
  }

  sendMouse (mask, x, y, modifiers = []) {
    this.sendMessage({ union: { case: 'mouseEvent', value: { mask, x, y, modifiers } } })
  }

  sendKey (value) {
    this.sendMessage({ union: { case: 'keyEvent', value } })
  }

  sendControlKey (key) {
    this.sendKey({ down: true, press: true, union: { case: 'controlKey', value: key }, mode: KeyboardMode.Legacy })
  }

  ctrlAltDel () {
    this.sendControlKey(ControlKey.CtrlAltDel)
  }

  lockScreen () {
    this.sendControlKey(ControlKey.LockScreen)
  }

  // Types text on the remote side (as key presses, independent of keyboard layouts).
  typeText (text) {
    this.sendKey({ press: true, union: { case: 'seq', value: text }, mode: KeyboardMode.Legacy })
  }

  sendMisc (kase, value) {
    this.sendMessage({ union: { case: 'misc', value: { union: { case: kase, value } } } })
  }

  // OptionMessage fields (session options) changed during the session.
  sendOption (option) {
    this.sendMisc('option', option)
  }

  refreshVideo (display) {
    // Peers from 1.2.4 refresh one display; older ones only know "refresh".
    if (display !== undefined && this.peerAtLeast('1.2.4')) this.sendMisc('refreshVideoDisplay', display)
    else this.sendMisc('refreshVideo', true)
  }

  switchDisplay (display) {
    this.sendMisc('switchDisplay', { display })
    if (this.peerAtLeast('1.2.4')) {
      this.sendMisc('captureDisplays', { set: [display] })
      this.sendMisc('refreshVideoDisplay', display)
    }
  }

  captureAllDisplays (count) {
    const all = [...Array(count).keys()]
    this.sendMisc('captureDisplays', { set: all })
    for (const d of all) this.sendMisc('refreshVideoDisplay', d)
  }

  setImageQuality (q) {
    this.sendOption({ imageQuality: q })
  }

  sendChat (text) {
    this.sendMisc('chatMessage', { text })
  }

  sendClipboardText (text) {
    this.sendMessage({ union: { case: 'clipboard', value: { compress: false, content: new TextEncoder().encode(text), format: ClipboardFormat.Text } } })
  }

  peerAtLeast (v) {
    return !!this.peerInfo && versionNumber(this.peerInfo.version) >= versionNumber(v)
  }

  handleClose (code, detail = '') {
    if (this.closed) return
    this.closed = true
    clearInterval(this.idleTimer)
    if (this.relay) this.relay.close()
    this.h.onClose && this.h.onClose(code, detail)
  }

  close () {
    if (this.closed) return
    if (this.stream) {
      // Tell the peer, so it ends the session at once instead of waiting for a timeout.
      this.sendMessage({ union: { case: 'misc', value: { union: { case: 'closeReason', value: 'Closed by web client' } } } })
    }
    this.closed = true
    clearInterval(this.idleTimer)
    const relay = this.relay
    // Let the close message leave before the socket goes.
    setTimeout(() => relay && relay.close(), 200)
  }
}
