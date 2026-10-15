// Cursor shapes of the remote side: CursorData carries zstd-compressed RGBA, CursorId selects a
// shape sent before. Shapes become CSS cursors for the picture.
import { decompress } from 'fzstd'

const MAX_SIZE = 512
const MAX_SHAPES = 200
// Browsers ignore CSS cursors larger than this.
const MAX_CSS = 128

export class CursorStore {
  constructor () {
    this.shapes = new Map() // id -> { canvas, hotx, hoty, width, height, css: Map(scale -> css) }
  }

  // Returns the id of the decoded shape, or null for invalid data.
  add (cd) {
    const w = cd.width
    const h = cd.height
    if (!(w >= 1 && w <= MAX_SIZE && h >= 1 && h <= MAX_SIZE)) return null
    if (!(cd.hotx >= 0 && cd.hotx < w && cd.hoty >= 0 && cd.hoty < h)) return null
    const expected = w * h * 4
    // Generous bound on the compressed size (zstd never expands much).
    if (!cd.colors || cd.colors.length > expected + 1024) return null
    let rgba
    try {
      rgba = decompress(cd.colors, new Uint8Array(expected))
    } catch (e) {
      return null
    }
    if (rgba.length !== expected) return null
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, expected), w, h), 0, 0)
    const id = String(cd.id)
    if (this.shapes.size >= MAX_SHAPES && !this.shapes.has(id)) {
      this.shapes.delete(this.shapes.keys().next().value)
    }
    this.shapes.set(id, { canvas, hotx: cd.hotx, hoty: cd.hoty, width: w, height: h, css: new Map() })
    return id
  }

  has (id) {
    return this.shapes.has(String(id))
  }

  // CSS cursor value for a shape at a zoom factor (1 = actual size).
  css (id, scale = 1) {
    const s = this.shapes.get(String(id))
    if (!s) return ''
    const key = Math.round(scale * 100)
    let v = s.css.get(key)
    if (v) return v
    let w = Math.max(1, Math.round(s.width * scale))
    let h = Math.max(1, Math.round(s.height * scale))
    if (w > MAX_CSS || h > MAX_CSS) {
      const f = MAX_CSS / Math.max(w, h)
      w = Math.max(1, Math.floor(w * f))
      h = Math.max(1, Math.floor(h * f))
    }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(s.canvas, 0, 0, w, h)
    const hx = Math.min(w - 1, Math.round(s.hotx * w / s.width))
    const hy = Math.min(h - 1, Math.round(s.hoty * h / s.height))
    v = `url(${c.toDataURL('image/png')}) ${hx} ${hy}, default`
    s.css.set(key, v)
    return v
  }

  // Image and hotspot for drawing the remote cursor as an overlay.
  image (id) {
    const s = this.shapes.get(String(id))
    if (!s) return null
    if (!s.url) s.url = s.canvas.toDataURL('image/png')
    return { url: s.url, hotx: s.hotx, hoty: s.hoty, width: s.width, height: s.height }
  }

  clear () {
    this.shapes.clear()
  }
}
