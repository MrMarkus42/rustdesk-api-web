// One WebSocket to the API proxy (/webclient/ws/id or /webclient/ws/relay). Every binary
// WebSocket message is one protobuf message, as hbbs/hbbr frame it.
const SUBPROTOCOL = 'rustdesk-web'

export function proxyUrl (kind) {
  const u = new URL(window.location.href)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.hash = ''
  u.search = ''
  // Like the admin API (/api/admin), the proxy sits at the root of the host serving /_admin/.
  u.pathname = `/webclient/ws/${kind}`
  return u.toString()
}

export class Channel {
  constructor () {
    this.ws = null
    this.queue = []
    this.waiters = []
    this.closed = false
    this.closeReason = ''
    this.onclose = null
    this.ondata = null
  }

  open (url, ticket, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      let settled = false
      const ws = new WebSocket(url, [SUBPROTOCOL, 't.' + ticket])
      ws.binaryType = 'arraybuffer'
      this.ws = ws
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          ws.close()
          reject(new Error('timeout'))
        }
      }, timeoutMs)
      ws.onopen = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      }
      ws.onerror = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error('connect failed'))
      }
      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer)) return
        const data = new Uint8Array(ev.data)
        if (this.ondata) {
          this.ondata(data)
          return
        }
        const w = this.waiters.shift()
        if (w) w.resolve(data)
        else this.queue.push(data)
      }
      ws.onclose = (ev) => {
        this.closed = true
        this.closeReason = ev.reason || ''
        for (const w of this.waiters.splice(0)) w.resolve(null)
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error('connect failed'))
        }
        if (this.onclose) this.onclose(ev)
      }
    })
  }

  send (bytes) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(bytes)
  }

  // Next message, or null on close or timeout.
  recv (timeoutMs) {
    if (this.queue.length) return Promise.resolve(this.queue.shift())
    if (this.closed) return Promise.resolve(null)
    return new Promise((resolve) => {
      const w = { resolve }
      this.waiters.push(w)
      if (timeoutMs) {
        setTimeout(() => {
          const i = this.waiters.indexOf(w)
          if (i >= 0) {
            this.waiters.splice(i, 1)
            resolve(null)
          }
        }, timeoutMs)
      }
    })
  }

  // Switches from recv() to a push handler; queued messages are delivered first.
  listen (handler) {
    this.ondata = handler
    for (const d of this.queue.splice(0)) handler(d)
  }

  // Bytes waiting to be sent: lets the sender skip mouse moves on a slow line.
  get buffered () {
    return this.ws ? this.ws.bufferedAmount : 0
  }

  close () {
    this.onclose = null
    this.ondata = null
    if (this.ws) {
      try { this.ws.close() } catch (e) { /* already closed */ }
    }
  }
}
