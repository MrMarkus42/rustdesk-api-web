// Plays the peer's sound: Opus frames decoded by the browser (WebCodecs), scheduled on Web Audio
// with a small buffer that is dropped when it grows (low delay beats gapless sound here).
const TARGET_DELAY = 0.08 // seconds of buffer we aim for
const MAX_DELAY = 0.4

export function audioSupported () {
  return typeof AudioDecoder !== 'undefined' && typeof AudioContext !== 'undefined'
}

export class AudioPlayer {
  constructor () {
    this.ctx = null
    this.decoder = null
    this.format = null
    this.nextTime = 0
    this.muted = false
    this.ts = 0
    this.gain = null
  }

  // AudioFormat from the peer (sample rate, channels): starts a fresh decoder.
  async setFormat (sampleRate, channels) {
    if (!audioSupported()) return false
    this.closeDecoder()
    const config = { codec: 'opus', sampleRate, numberOfChannels: channels }
    try {
      const r = await AudioDecoder.isConfigSupported(config)
      if (!r.supported) return false
    } catch (e) {
      return false
    }
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' })
      this.gain = this.ctx.createGain()
      this.gain.connect(this.ctx.destination)
    }
    this.format = { sampleRate, channels }
    this.decoder = new AudioDecoder({
      output: (data) => this.play(data),
      error: () => this.closeDecoder(),
    })
    this.decoder.configure(config)
    this.nextTime = 0
    return true
  }

  // Browsers only start sound after a user action: called on clicks and key presses.
  resume () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
  }

  setMuted (m) {
    this.muted = m
    if (this.gain) this.gain.gain.value = m ? 0 : 1
  }

  feed (bytes) {
    if (!this.decoder || this.decoder.state !== 'configured' || this.muted) return
    if (this.decoder.decodeQueueSize > 20) return
    this.ts += 10000
    try {
      this.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: this.ts, data: bytes }))
    } catch (e) { /* skip a broken frame */ }
  }

  play (data) {
    try {
      if (!this.ctx || this.ctx.state !== 'running') return
      const n = data.numberOfFrames
      const ch = data.numberOfChannels
      const buf = this.ctx.createBuffer(ch, n, data.sampleRate)
      for (let c = 0; c < ch; c++) {
        const out = new Float32Array(n)
        data.copyTo(out, { planeIndex: c, format: 'f32-planar' })
        buf.copyToChannel(out, c)
      }
      const now = this.ctx.currentTime
      if (this.nextTime < now || this.nextTime - now > MAX_DELAY) this.nextTime = now + TARGET_DELAY
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.gain)
      src.start(this.nextTime)
      this.nextTime += buf.duration
    } catch (e) {
      /* format the browser cannot copy: skip */
    } finally {
      data.close()
    }
  }

  closeDecoder () {
    if (this.decoder) {
      try { this.decoder.close() } catch (e) { /* closed */ }
    }
    this.decoder = null
  }

  close () {
    this.closeDecoder()
    if (this.ctx) this.ctx.close().catch(() => {})
    this.ctx = null
  }
}
