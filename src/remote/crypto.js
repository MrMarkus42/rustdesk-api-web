// Cryptography of the RustDesk connection, written for this client from the protocol:
// NaCl signatures (ed25519), sealed boxes (x25519 + xsalsa20-poly1305) and secretbox streams.
import nacl from 'tweetnacl'
import { blake2b } from '@noble/hashes/blake2.js'
import { sha256 } from '@noble/hashes/sha2.js'

const enc = new TextEncoder()

// Newest key exchange version this client speaks (1: separate keys per direction).
export const KX_VERSION_LATEST = 1
const KX_SPLIT_CONTEXT = enc.encode('rdkx-spl')
const KX_SPLIT_INITIATOR = 1
const KX_SPLIT_RESPONDER = 2

export function b64decode (s) {
  const bin = atob(s.trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function b64encode (bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

// The server key as configured (base64 of the 32-byte ed25519 public key).
export function parseServerKey (key) {
  try {
    const pk = b64decode(key || '')
    return pk.length === nacl.sign.publicKeyLength ? pk : null
  } catch (e) {
    return null
  }
}

// Returns the signed payload, or null if the signature does not verify.
export function openSigned (signed, publicKey) {
  if (!signed || !publicKey || signed.length < nacl.sign.signatureLength) return null
  return nacl.sign.open(signed, publicKey)
}

function u32le (n) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

// Session key sealed to the peer's ephemeral box key (zero nonce: the key pair is new each time).
export function createSessionKey (theirBoxPk) {
  if (!theirBoxPk || theirBoxPk.length !== nacl.box.publicKeyLength) {
    throw new Error('invalid peer key')
  }
  const ours = nacl.box.keyPair()
  const key = nacl.randomBytes(nacl.secretbox.keyLength)
  const sealed = nacl.box(key, new Uint8Array(nacl.box.nonceLength), theirBoxPk, ours.secretKey)
  ours.secretKey.fill(0)
  return { ourPk: ours.publicKey, sealed, key }
}

function deriveSubkey (key, direction, t) {
  const h = blake2b.create({ key, dkLen: 32 })
  h.update(KX_SPLIT_CONTEXT)
  h.update(new Uint8Array([direction]))
  h.update(u32le(t.advertised))
  h.update(u32le(t.picked))
  h.update(t.initiatorPk)
  h.update(t.responderPk)
  return h.digest()
}

// Encrypted message stream. Each side counts its messages; the counter is the nonce.
export class SecretStream {
  constructor (sendKey, recvKey) {
    this.sendKey = sendKey
    this.recvKey = recvKey
    this.sendSeq = 0
    this.recvSeq = 0
  }

  // We started the exchange (we sent the sealed key), so we are the initiator.
  static negotiate (key, t) {
    if (t.picked === 0) return new SecretStream(key, key)
    const initiator = deriveSubkey(key, KX_SPLIT_INITIATOR, t)
    const responder = deriveSubkey(key, KX_SPLIT_RESPONDER, t)
    key.fill(0)
    return new SecretStream(initiator, responder)
  }

  static nonce (seq) {
    const n = new Uint8Array(nacl.secretbox.nonceLength)
    const v = new DataView(n.buffer)
    v.setUint32(0, seq % 0x100000000, true)
    v.setUint32(4, Math.floor(seq / 0x100000000), true)
    return n
  }

  seal (plain) {
    this.sendSeq++
    return nacl.secretbox(plain, SecretStream.nonce(this.sendSeq), this.sendKey)
  }

  // Messages of at most one byte travel unencrypted (as the peer does it).
  open (data) {
    if (data.length <= 1) return data
    this.recvSeq++
    const out = nacl.secretbox.open(data, SecretStream.nonce(this.recvSeq), this.recvKey)
    if (!out) throw new Error('decryption failed')
    return out
  }
}

function concat (a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

// What the peer stores and what an address book keeps: sha256(password + salt).
export function passwordHash (password, salt) {
  return sha256(concat(enc.encode(password), enc.encode(salt)))
}

// What goes into the login request: sha256(sha256(password + salt) + challenge).
export function loginHash (storedHash, challenge) {
  return sha256(concat(storedHash, enc.encode(challenge)))
}
