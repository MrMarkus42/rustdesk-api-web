// Decodes the peer's video with the browser's own decoders (WebCodecs) and draws it.
const CODECS = {
  vp8s: { name: 'vp8', codec: 'vp8' },
  vp9s: { name: 'vp9', codec: 'vp09.00.10.08' },
  av1s: { name: 'av1', codec: 'av01.0.08M.08' },
  // Annex B streams: no description, as the peer sends them.
  h264s: { name: 'h264', codec: 'avc1.42E033' },
  h265s: { name: 'h265', codec: 'hev1.1.6.L153.B0' },
}

// 4:4:4 ("true color") streams use other profiles.
const CODECS_444 = {
  vp9s: 'vp09.01.10.08',
  av1s: 'av01.1.08M.08',
}

async function supported (codec) {
  try {
    const r = await VideoDecoder.isConfigSupported({ codec, optimizeForLatency: true })
    return !!r.supported
  } catch (e) {
    return false
  }
}

// Which codecs this browser can decode, for SupportedDecoding in the login request.
export async function detectDecodings () {
  const out = { i444: { vp9: false, av1: false } }
  if (typeof VideoDecoder === 'undefined') return out
  for (const c of Object.values(CODECS)) out[c.name] = await supported(c.codec)
  out.i444.vp9 = await supported(CODECS_444.vp9s)
  out.i444.av1 = await supported(CODECS_444.av1s)
  return out
}

export class VideoRenderer {
  // onSize(width, height) when the picture size changes; onNeedKeyframe() after an error.
  constructor (canvas, { onSize, onNeedKeyframe, onFirstFrame }) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    this.onSize = onSize
    this.onNeedKeyframe = onNeedKeyframe
    this.onFirstFrame = onFirstFrame
    this.decoder = null
    this.kind = ''
    this.waitKey = true
    this.ts = 0
    this.width = 0
    this.height = 0
    this.frames = 0
    this.codecName = ''
    this.lastKeyRequest = 0
    // true: the session asked for 4:4:4, so VP9/AV1 decoders are set up for it
    this.i444 = false
  }

  reset () {
    if (this.decoder) {
      try { this.decoder.close() } catch (e) { /* closed */ }
    }
    this.decoder = null
    this.kind = ''
    this.waitKey = true
  }

  requestKeyframe () {
    const now = Date.now()
    if (now - this.lastKeyRequest < 1000) return
    this.lastKeyRequest = now
    this.onNeedKeyframe && this.onNeedKeyframe()
  }

  createDecoder (kind) {
    this.reset()
    const c = CODECS[kind]
    if (!c) return false
    this.kind = kind
    this.codecName = c.name
    this.decoder = new VideoDecoder({
      output: (frame) => this.draw(frame),
      error: () => {
        // A broken stream: start again from the next key frame.
        this.decoder = null
        this.kind = ''
        this.waitKey = true
        this.requestKeyframe()
      },
    })
    const codec = (this.i444 && CODECS_444[kind]) || c.codec
    this.decoder.configure({ codec, optimizeForLatency: true })
    return true
  }

  draw (frame) {
    try {
      const w = frame.displayWidth
      const h = frame.displayHeight
      if (w !== this.width || h !== this.height) {
        this.width = w
        this.height = h
        this.canvas.width = w
        this.canvas.height = h
        this.onSize && this.onSize(w, h)
      }
      this.ctx.drawImage(frame, 0, 0, w, h)
      if (this.frames++ === 0) this.onFirstFrame && this.onFirstFrame()
    } finally {
      frame.close()
    }
  }

  // vf: VideoFrame message (one of vp8s/vp9s/av1s/h264s/h265s with EncodedVideoFrames).
  feed (vf) {
    const kind = vf.union.case
    if (!CODECS[kind]) return
    if (kind !== this.kind || !this.decoder || this.decoder.state === 'closed') {
      if (!this.createDecoder(kind)) return
    }
    for (const f of vf.union.value.frames) {
      if (this.waitKey) {
        if (!f.key) {
          this.requestKeyframe()
          continue
        }
        this.waitKey = false
      }
      // Far behind (slow machine or tab in the background): drop until the next key frame.
      if (this.decoder.decodeQueueSize > 30) {
        this.waitKey = true
        this.requestKeyframe()
        continue
      }
      this.ts += 16667
      try {
        this.decoder.decode(new EncodedVideoChunk({
          type: f.key ? 'key' : 'delta',
          timestamp: this.ts,
          data: f.data,
        }))
      } catch (e) {
        this.waitKey = true
        this.requestKeyframe()
      }
    }
  }

  close () {
    this.reset()
  }
}
