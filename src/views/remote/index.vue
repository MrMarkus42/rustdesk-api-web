<template>
  <div class="remote" ref="rootEl" @pointerdown="audio.resume()">
    <div id="rd-menu-layer"></div>
    <Toolbar v-if="phase === 'connected'" ref="toolbarRef" :buttons="toolbarButtons"
             v-model:pinned="settings.pinned" v-model:offset="settings.toolbarOffset"/>
    <div v-else class="rd-topline">
      <span class="dot" :class="phase"></span>
      <span class="title">{{ title }}</span>
    </div>

    <div class="screen" ref="screenEl" :class="screenClass" @pointermove="onScreenPointerMove">
      <div class="stage" :style="stageStyle" v-show="phase === 'connected' && hasFrame">
        <div v-for="s in surfaces" :key="s.display" class="surface" :style="surfaceStyle(s)">
          <canvas :ref="(el) => setCanvas(s.display, el)" tabindex="0" :data-display="s.display"
                  :style="{ cursor: cursorCss }"
                  @pointermove="onPointerMove" @pointerdown="onPointerDown" @pointerup="onPointerUp"
                  @wheel.prevent="onWheel" @contextmenu.prevent></canvas>
          <img v-if="remoteCursor.visible && remoteCursor.display === s.display && remoteCursor.img"
               class="remote-cursor" :src="remoteCursor.img.url" :style="remoteCursorStyle(s)" alt="">
        </div>
      </div>

      <div class="quality-monitor" v-if="phase === 'connected' && settings.showQualityMonitor">
        <div><span>{{ T('RemoteQmSpeed') }}</span>{{ stats.speed }}</div>
        <div><span>FPS</span>{{ stats.fps }}</div>
        <div><span>{{ T('RemoteQmDelay') }}</span>{{ stats.delay }}</div>
        <div><span>{{ T('RemoteQmTarget') }}</span>{{ stats.target }}</div>
        <div><span>Codec</span>{{ stats.codec }}</div>
        <div><span>{{ T('RemoteQmChroma') }}</span>{{ stats.chroma }}</div>
      </div>

      <div class="rec-indicator" v-if="recording.active">● REC</div>

      <ChatPanel v-if="chat.open && phase === 'connected'" :messages="chat.messages" :peer-name="title"
                 @send="sendChat" @close="chat.open = false"/>

      <div class="overlay" v-if="phase !== 'connected' || !hasFrame">
        <div class="box" v-if="phase === 'connecting' || phase === 'waiting' || (phase === 'connected' && !hasFrame)">
          <div class="spinner"></div>
          <div>{{ statusText }}</div>
        </div>
        <div class="box error" v-else-if="phase === 'error' || phase === 'closed'">
          <div class="err-title">{{ phase === 'error' ? T('RemoteConnectionFailed') : T('RemoteConnectionClosed') }}</div>
          <div class="err-text">{{ errorText }}</div>
          <div class="actions">
            <el-button type="primary" @click="reconnect">{{ T('RemoteReconnect') }}</el-button>
            <el-button @click="closeWindow">{{ T('Close') }}</el-button>
          </div>
        </div>
        <div class="box login" v-else-if="phase === 'login'">
          <div class="err-text" v-if="loginError">{{ loginError }}</div>
          <template v-if="!need2fa">
            <div class="label">{{ T('RemotePasswordFor', { id: peerId }) }}</div>
            <el-input ref="pwEl" v-model="password" type="password" show-password autocomplete="off"
                      @keyup.enter="submitPassword" :placeholder="T('Password')"/>
            <div class="actions">
              <el-button type="primary" @click="submitPassword" :disabled="!password">{{ T('RemoteConnect') }}</el-button>
              <el-button v-if="savedHash" @click="useSaved">{{ T('RemoteUseSavedPassword') }}</el-button>
              <el-button @click="requestAccess">{{ T('RemoteRequestAccess') }}</el-button>
            </div>
          </template>
          <template v-else>
            <div class="label">{{ T('Remote2faCode') }}</div>
            <el-input ref="pwEl" v-model="code2fa" autocomplete="one-time-code" maxlength="10"
                      @keyup.enter="submit2fa"/>
            <div class="actions">
              <el-button type="primary" @click="submit2fa" :disabled="!code2fa">{{ T('Confirm') }}</el-button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogs.type" :title="T('RemoteTypeText')" width="480px" append-to-body>
      <el-input v-model="dialogs.typeValue" type="textarea" :rows="5" :placeholder="T('RemoteTypeTextHint')"/>
      <template #footer>
        <el-button @click="dialogs.type = false">{{ T('Cancel') }}</el-button>
        <el-button type="primary" @click="sendTyped" :disabled="!dialogs.typeValue">{{ T('RemoteSend') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogs.osPassword" :title="T('RemoteOsPassword')" width="420px" append-to-body>
      <div class="dlg-hint">{{ T('RemoteOsPasswordHint') }}</div>
      <el-input v-model="dialogs.osPasswordValue" type="password" show-password autocomplete="off"
                @keyup.enter="sendOsPassword"/>
      <template #footer>
        <el-button @click="dialogs.osPassword = false">{{ T('Cancel') }}</el-button>
        <el-button type="primary" @click="sendOsPassword" :disabled="!dialogs.osPasswordValue">{{ T('RemoteSend') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogs.elevate" :title="T('RemoteRequestElevation')" width="460px" append-to-body>
      <el-radio-group v-model="dialogs.elevateMode" class="dlg-radios">
        <el-radio value="direct">{{ T('RemoteElevateDirect') }}</el-radio>
        <el-radio value="logon">{{ T('RemoteElevateLogon') }}</el-radio>
      </el-radio-group>
      <template v-if="dialogs.elevateMode === 'logon'">
        <el-input v-model="dialogs.elevateUser" :placeholder="T('Username')" autocomplete="off" class="dlg-field"/>
        <el-input v-model="dialogs.elevatePassword" type="password" show-password :placeholder="T('Password')"
                  autocomplete="off" class="dlg-field"/>
      </template>
      <template #footer>
        <el-button @click="dialogs.elevate = false">{{ T('Cancel') }}</el-button>
        <el-button type="primary" @click="sendElevation"
                   :disabled="dialogs.elevateMode === 'logon' && !dialogs.elevateUser">{{ T('Confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogs.resolution" :title="T('RemoteCustomResolution')" width="380px" append-to-body>
      <div class="dlg-res">
        <el-input-number v-model="dialogs.resW" :min="320" :max="8192" controls-position="right"/>
        <span>×</span>
        <el-input-number v-model="dialogs.resH" :min="240" :max="8192" controls-position="right"/>
      </div>
      <template #footer>
        <el-button @click="dialogs.resolution = false">{{ T('Cancel') }}</el-button>
        <el-button type="primary" @click="applyCustomResolution">{{ T('Confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { decompress } from 'fzstd'
  import { T } from '@/utils/i18n'
  import { config as getConfig, peer as getPeer, ticket as getTicket } from '@/api/webclient'
  import { RemoteConnection, RemoteError } from '@/remote/connection'
  import { VideoRenderer, detectDecodings } from '@/remote/video'
  import { keyEventFor, peerOs, supportedKeyboardModes, versionNumber } from '@/remote/keyboard'
  import { b64decode } from '@/remote/crypto'
  import { loadSettings, saveSettings, isMacBrowser } from '@/remote/settings'
  import { CursorStore } from '@/remote/cursor'
  import { AudioPlayer, audioSupported } from '@/remote/audio'
  import {
    BackNotification_BlockInputState as BlockState,
    BackNotification_PrivacyModeState as PrivacyState,
    Chroma,
    ClipboardFormat,
    ControlKey,
    ImageQuality,
    KeyboardMode,
    OptionMessage_BoolOption as BoolOption,
    PermissionInfo_Permission as Permission,
    SupportedDecoding_PreferCodec as PreferCodec,
  } from '@/remote/gen/message_pb.js'
  import Toolbar from './Toolbar.vue'
  import ChatPanel from './ChatPanel.vue'

  const MOUSE_TYPE_MOVE = 0
  const MOUSE_TYPE_DOWN = 1
  const MOUSE_TYPE_UP = 2
  const MOUSE_TYPE_WHEEL = 3
  const MOUSE_TYPE_MOVE_RELATIVE = 5
  // browser button -> RustDesk button bit (left, middle/wheel, right, back, forward)
  const BUTTONS = [0x01, 0x04, 0x02, 0x08, 0x10]
  const ALL_DISPLAYS = -1
  const MAX_CLIPBOARD = 8 * 1024 * 1024

  const route = useRoute()
  const peerId = String(route.params.id || '').replace(/\s/g, '')

  const rootEl = ref(null)
  const screenEl = ref(null)
  const pwEl = ref(null)
  const toolbarRef = ref(null)
  const canvases = {}

  const phase = ref('connecting') // connecting, login, waiting, connected, error, closed
  const statusText = ref('')
  const errorText = ref('')
  const loginError = ref('')
  const need2fa = ref(false)
  const password = ref('')
  const code2fa = ref('')
  const savedHash = ref(null)
  const peerMeta = reactive({ alias: '', hostname: '' })
  const peerInfo = ref(null)
  const displays = ref([])
  const currentDisplay = ref(0)
  const hasFrame = ref(false)
  const surfaces = ref([]) // [{ display, w, h }] picture size per shown display
  const screenSize = reactive({ w: 0, h: 0 })
  const settings = reactive(loadSettings(peerId))
  const perms = reactive({ keyboard: true, clipboard: true, audio: true, file: true, restart: true, recording: true, blockInput: true, privacyMode: true })
  const state = reactive({ privacyImpl: '', blockInput: false, portableRunning: false, fullscreen: false, relativeMouse: false })
  const chat = reactive({ open: false, messages: [], unread: 0 })
  const recording = reactive({ active: false })
  const stats = reactive({ speed: '-', fps: '-', delay: '-', target: '-', codec: '-', chroma: '-' })
  const remoteCursor = reactive({ id: '', visible: false, x: 0, y: 0, display: 0, img: null, cssVersion: 0 })
  const dialogs = reactive({
    type: false, typeValue: '',
    osPassword: false, osPasswordValue: '',
    elevate: false, elevateMode: 'direct', elevateUser: '', elevatePassword: '',
    resolution: false, resW: 1920, resH: 1080,
  })

  let conn = null
  let decodings = null
  const renderers = new Map() // display -> VideoRenderer
  const cursors = new CursorStore()
  const audio = new AudioPlayer()
  const pressed = new Set()
  const translated = new Set()
  let keyChain = Promise.resolve()
  let pendingMove = null
  let moveScheduled = false
  let wheelAcc = { x: 0, y: 0 }
  let resizeObserver = null
  let statsTimer = null
  let lastStats = { t: 0, bytes: 0, frames: 0 }
  let lastDelay = null
  let recorder = null
  let recChunks = []
  let clipboardPending = null
  let lastClipboardSent = null
  let lastClipboardReceived = null

  watch(settings, () => saveSettings(peerId, settings), { deep: true })

  // ---------- helpers ----------

  const title = computed(() => {
    const name = peerMeta.alias || (peerInfo.value && peerInfo.value.hostname) || peerMeta.hostname
    return name ? `${name} (${peerId})` : peerId
  })
  const pi = computed(() => peerInfo.value || { platform: '', version: '', displays: [] })
  const os = computed(() => peerOs(pi.value.platform))
  const atLeast = (v) => versionNumber(pi.value.version) >= versionNumber(v)
  const allMode = computed(() => currentDisplay.value === ALL_DISPLAYS)
  const keyboardAllowed = computed(() => perms.keyboard && !settings.viewOnly)
  const clipboardAvailable = computed(() => !!(navigator.clipboard && window.isSecureContext))
  const platformAdditions = computed(() => {
    try {
      return JSON.parse((peerInfo.value && peerInfo.value.platformAdditions) || '{}') || {}
    } catch (e) {
      return {}
    }
  })

  function display (i = currentDisplay.value) {
    return displays.value[i] || displays.value[0] || null
  }

  function errText (code, detail) {
    const t = T(code)
    return detail && t !== detail ? `${t} (${detail})` : t
  }

  function bool (v) {
    return v ? BoolOption.Yes : BoolOption.No
  }

  function setCanvas (d, el) {
    if (el) canvases[d] = el
    else delete canvases[d]
  }

  function download (blob, name) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  function stamp () {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }

  // ---------- session options ----------

  const preferCodecs = { auto: PreferCodec.Auto, vp8: PreferCodec.VP8, vp9: PreferCodec.VP9, av1: PreferCodec.AV1, h264: PreferCodec.H264, h265: PreferCodec.H265 }

  function decodingOption () {
    const d = decodings || {}
    const i444 = settings.i444 && (d.i444 || {})
    return {
      abilityVp8: d.vp8 ? 1 : 0,
      abilityVp9: d.vp9 ? 1 : 0,
      abilityAv1: d.av1 ? 1 : 0,
      abilityH264: d.h264 ? 1 : 0,
      abilityH265: d.h265 ? 1 : 0,
      prefer: preferCodecs[settings.codec] ?? PreferCodec.Auto,
      i444: { vp9: !!(i444 && i444.vp9), av1: !!(i444 && i444.av1) },
      preferChroma: settings.i444 ? Chroma.I444 : Chroma.I420,
    }
  }

  function qualityOption () {
    switch (settings.imageQuality) {
      case 'best': return { imageQuality: ImageQuality.Best }
      case 'low': return { imageQuality: ImageQuality.Low }
      case 'custom': return { customImageQuality: settings.customQuality << 8, customFps: settings.customFps }
      default: return { imageQuality: ImageQuality.Balanced }
    }
  }

  function clipboardDisabled () {
    return settings.disableClipboard || settings.viewOnly || !clipboardAvailable.value
  }

  // Everything the peer should know at login (the app sends the same set).
  function loginOptions () {
    return {
      ...qualityOption(),
      showRemoteCursor: bool(settings.showRemoteCursor || settings.viewOnly),
      followRemoteCursor: bool(settings.followRemoteCursor),
      followRemoteWindow: bool(settings.followRemoteWindow),
      lockAfterSessionEnd: bool(settings.lockAfterSessionEnd && !settings.viewOnly),
      disableAudio: bool(settings.mute || !audioSupported()),
      disableClipboard: bool(clipboardDisabled()),
      disableKeyboard: bool(settings.viewOnly),
      supportedDecoding: decodingOption(),
    }
  }

  function setOption (key, value, option) {
    settings[key] = value
    if (conn) conn.sendOption(option)
  }

  // ---------- connect / login ----------

  async function ticket () {
    const res = await getTicket()
    return res.data.ticket
  }

  async function connect () {
    cleanup()
    phase.value = 'connecting'
    statusText.value = T('RemoteConnecting')
    errorText.value = ''
    loginError.value = ''
    need2fa.value = false
    hasFrame.value = false
    peerInfo.value = null
    surfaces.value = []
    chat.messages = []
    chat.unread = 0
    cursors.clear()
    Object.assign(remoteCursor, { id: '', visible: false, img: null })
    Object.assign(perms, { keyboard: true, clipboard: true, audio: true, file: true, restart: true, recording: true, blockInput: true, privacyMode: true })
    Object.assign(state, { privacyImpl: '', blockInput: false, portableRunning: false })
    document.title = `${peerId} - ${T('RemoteControl')}`
    if (!/^[0-9A-Za-z_\-@.]{1,100}$/.test(peerId)) {
      fail('RemoteErrIdNotExist')
      return
    }
    if (typeof VideoDecoder === 'undefined') {
      fail('RemoteErrBrowser')
      return
    }
    try {
      if (!decodings) decodings = await detectDecodings()
      const [cfg, meta] = await Promise.all([
        getConfig(),
        getPeer(peerId).catch(() => ({ data: {} })),
      ])
      peerMeta.alias = meta.data.alias || ''
      peerMeta.hostname = meta.data.hostname || ''
      savedHash.value = null
      if (meta.data.hash) {
        try {
          const h = b64decode(meta.data.hash)
          if (h.length === 32) savedHash.value = h
        } catch (e) { /* not a stored hash */ }
      }
      conn = new RemoteConnection(peerId, cfg.data, ticket, handlers)
      await conn.start(decodings)
    } catch (e) {
      if (e instanceof RemoteError) fail(e.code, e.detail)
      else fail('RemoteErrServer', e && e.message)
    }
  }

  function fail (code, detail) {
    const was = phase.value
    cleanup()
    phase.value = was === 'connected' ? 'closed' : 'error'
    errorText.value = errText(code, detail)
  }

  function login (args) {
    loginError.value = ''
    phase.value = 'waiting'
    conn.login({ ...args, option: loginOptions() })
  }

  function submitPassword () {
    if (!password.value || !conn) return
    statusText.value = T('RemoteLoggingIn')
    login({ password: password.value })
  }

  function useSaved () {
    if (!savedHash.value || !conn) return
    statusText.value = T('RemoteLoggingIn')
    login({ savedHash: savedHash.value })
  }

  function requestAccess () {
    if (!conn) return
    statusText.value = T('RemoteWaitingForAccept')
    login({})
  }

  function submit2fa () {
    if (!code2fa.value || !conn) return
    phase.value = 'waiting'
    statusText.value = T('RemoteLoggingIn')
    conn.send2fa(code2fa.value.trim())
    code2fa.value = ''
  }

  // ---------- messages from the peer ----------

  function applyPeerInfo (p) {
    peerInfo.value = p
    displays.value = p.displays.map((d) => ({
      x: d.x, y: d.y, width: d.width, height: d.height, name: d.name,
      cursorEmbedded: d.cursorEmbedded,
      original: d.originalResolution ? { w: d.originalResolution.width, h: d.originalResolution.height } : null,
      resolutions: [],
    }))
    const cur = p.currentDisplay || 0
    if (p.resolutions && displays.value[cur]) {
      displays.value[cur].resolutions = p.resolutions.resolutions.map((r) => ({ w: r.width, h: r.height }))
    }
    if (!allMode.value) currentDisplay.value = cur
    // A keyboard mode this peer does not know falls back to the best one it does.
    const modes = supportedKeyboardModes(p)
    if (!modes.includes(settings.keyboardMode)) settings.keyboardMode = modes[0]
  }

  const handlers = {
    onHash () {
      phase.value = 'login'
      nextTick(() => pwEl.value && pwEl.value.focus())
    },
    onLoginError (err) {
      if (err === '2FA Required') {
        need2fa.value = true
        loginError.value = ''
      } else if (err === 'Wrong 2FA Code') {
        need2fa.value = true
        loginError.value = T('RemoteWrong2fa')
      } else if (err === 'Wrong Password' || err === 'Empty Password') {
        loginError.value = T('RemoteWrongPassword')
        password.value = ''
      } else if (err === 'No Password Access') {
        loginError.value = T('RemoteNoPasswordAccess')
      } else {
        fail('RemoteErrLogin', err)
        return
      }
      phase.value = 'login'
      nextTick(() => pwEl.value && pwEl.value.focus())
    },
    onPeerInfo (p, isLogin) {
      applyPeerInfo(p)
      if (isLogin) {
        phase.value = 'connected'
        statusText.value = T('RemoteWaitingForImage')
        password.value = ''
        rebuildSurfaces()
        startStats()
        if (allMode.value && displays.value.length > 1 && atLeast('1.2.4')) {
          conn.captureAllDisplays(displays.value.length)
        }
        if (!clipboardDisabled()) syncClipboardFromLocal(false)
      } else {
        rebuildSurfaces()
      }
    },
    onVideo (vf) {
      let d = vf.display
      if (!allMode.value) {
        // Old peers always say display 0; newer ones may still send a frame of the previous one.
        if (atLeast('1.2.4') && d !== currentDisplay.value) return
        d = currentDisplay.value
      }
      const r = renderers.get(d)
      if (r) r.feed(vf)
    },
    onMisc (m) {
      const u = m.union
      switch (u.case) {
        case 'switchDisplay': {
          const sd = u.value
          const list = displays.value.slice()
          const old = list[sd.display] || {}
          list[sd.display] = {
            ...old, x: sd.x, y: sd.y, width: sd.width, height: sd.height, cursorEmbedded: sd.cursorEmbedded,
            original: sd.originalResolution ? { w: sd.originalResolution.width, h: sd.originalResolution.height } : old.original,
            resolutions: sd.resolutions ? sd.resolutions.resolutions.map((r) => ({ w: r.width, h: r.height })) : (old.resolutions || []),
          }
          displays.value = list
          if (!allMode.value && sd.display !== currentDisplay.value) {
            currentDisplay.value = sd.display
            rebuildSurfaces()
          }
          break
        }
        case 'followCurrentDisplay':
          if (!allMode.value && u.value !== currentDisplay.value && displays.value[u.value]) switchDisplay(u.value)
          break
        case 'permissionInfo': {
          const p = u.value
          const key = {
            [Permission.Keyboard]: 'keyboard', [Permission.Clipboard]: 'clipboard', [Permission.Audio]: 'audio',
            [Permission.File]: 'file', [Permission.Restart]: 'restart', [Permission.Recording]: 'recording',
            [Permission.BlockInput]: 'blockInput', [Permission.PrivacyMode]: 'privacyMode',
          }[p.permission]
          if (key) perms[key] = p.enabled
          if (key === 'recording' && !p.enabled && recording.active) stopRecording()
          break
        }
        case 'audioFormat':
          audio.setFormat(u.value.sampleRate, u.value.channels).then(() => audio.setMuted(settings.mute))
          break
        case 'chatMessage':
          addChat(u.value.text, false)
          break
        case 'backNotification':
          onBackNotification(u.value)
          break
        case 'portableServiceRunning':
          state.portableRunning = u.value
          break
        case 'uac':
          if (u.value) ElMessage.warning(T('RemoteUacShown'))
          break
        case 'foregroundWindowElevated':
          if (u.value) ElMessage.warning(T('RemoteElevatedWindow'))
          break
        default:
          break
      }
    },
    onOther (u) {
      switch (u.case) {
        case 'cursorData': {
          const id = cursors.add(u.value)
          if (id) setCursorId(id)
          break
        }
        case 'cursorId':
          setCursorId(String(u.value))
          break
        case 'cursorPosition':
          onCursorPosition(u.value)
          break
        case 'audioFrame':
          audio.feed(u.value.data)
          break
        case 'clipboard':
          onPeerClipboard([u.value])
          break
        case 'multiClipboards':
          onPeerClipboard(u.value.clipboards)
          break
        default:
          break
      }
    },
    onTestDelay (t) {
      lastDelay = t
    },
    onMessageBox (mb) {
      const type = mb.msgtype || ''
      if (type.includes('error')) {
        fail('RemoteErrServer', mb.text)
      } else if (mb.text) {
        ElMessage({ message: mb.title ? `${mb.title}: ${mb.text}` : mb.text, type: 'info', duration: 6000 })
      }
    },
    onClose (code, detail) {
      const was = phase.value
      cleanup(false)
      phase.value = was === 'connected' ? 'closed' : 'error'
      errorText.value = errText(code, detail)
    },
  }

  function onBackNotification (b) {
    const u = b.union
    if (u.case === 'privacyModeState') {
      switch (u.value) {
        case PrivacyState.PrvOnSucceeded:
          state.privacyImpl = b.implKey || 'on'
          ElMessage.success(T('RemotePrivacyOn'))
          break
        case PrivacyState.PrvOffSucceeded:
        case PrivacyState.PrvOffByPeer:
        case PrivacyState.PrvOffUnknown:
          state.privacyImpl = ''
          ElMessage.info(T('RemotePrivacyOff'))
          break
        case PrivacyState.PrvOnByOther:
          ElMessage.warning(T('RemotePrivacyByOther'))
          break
        case PrivacyState.PrvNotSupported:
          ElMessage.warning(T('RemotePrivacyNotSupported'))
          break
        default:
          ElMessage.error(T('RemotePrivacyFailed') + (b.details ? ` (${b.details})` : ''))
      }
    } else if (u.case === 'blockInputState') {
      if (u.value === BlockState.BlkOnSucceeded) state.blockInput = true
      else if (u.value === BlockState.BlkOffSucceeded) state.blockInput = false
      else if (u.value === BlockState.BlkOnFailed || u.value === BlockState.BlkOffFailed) ElMessage.error(T('RemoteBlockInputFailed'))
    }
  }

  // ---------- picture: surfaces, layout ----------

  function rebuildSurfaces () {
    const wanted = allMode.value ? displays.value.map((_, i) => i) : [currentDisplay.value]
    for (const [d, r] of renderers) {
      if (!wanted.includes(d)) {
        r.close()
        renderers.delete(d)
      }
    }
    surfaces.value = wanted.map((d) => surfaces.value.find((s) => s.display === d) || { display: d, w: 0, h: 0 })
    nextTick(() => {
      for (const s of surfaces.value) {
        const canvas = canvases[s.display]
        if (!canvas) continue
        let r = renderers.get(s.display)
        if (r && r.canvas !== canvas) {
          r.close()
          r = null
        }
        if (!r) {
          r = new VideoRenderer(canvas, {
            onSize: (w, h) => {
              const sf = surfaces.value.find((x) => x.display === s.display)
              if (sf) {
                sf.w = w
                sf.h = h
              }
            },
            onNeedKeyframe: () => conn && conn.refreshVideo(s.display),
            onFirstFrame: () => {
              hasFrame.value = true
              nextTick(() => canvas.focus())
            },
          })
          r.i444 = settings.i444
          renderers.set(s.display, r)
        }
      }
    })
  }

  // Size of the picture area in "display units" and the scale to screen pixels.
  const layout = computed(() => {
    const dpr = window.devicePixelRatio || 1
    const sw = screenSize.w
    const sh = screenSize.h
    if (allMode.value) {
      const ds = displays.value
      if (!ds.length) return { scale: 1, w: 0, h: 0, minX: 0, minY: 0 }
      const minX = Math.min(...ds.map((d) => d.x))
      const minY = Math.min(...ds.map((d) => d.y))
      const w = Math.max(...ds.map((d) => d.x + d.width)) - minX
      const h = Math.max(...ds.map((d) => d.y + d.height)) - minY
      let scale = 1
      if (settings.viewStyle === 'adaptive' && w && h) scale = Math.min(sw / w, sh / h)
      else if (settings.viewStyle === 'custom') scale = settings.customScale / 100
      return { scale, w: w * scale, h: h * scale, minX, minY }
    }
    const s = surfaces.value[0]
    if (!s || !s.w) return { scale: 1, w: 0, h: 0, minX: 0, minY: 0 }
    let scale
    if (settings.viewStyle === 'adaptive') scale = Math.min(sw / s.w, sh / s.h)
    else if (settings.viewStyle === 'custom') scale = settings.customScale / 100 / dpr
    else scale = 1 / dpr // "original": one remote pixel on one screen pixel
    return { scale, w: s.w * scale, h: s.h * scale, minX: 0, minY: 0 }
  })

  const stageStyle = computed(() => ({
    width: Math.floor(layout.value.w) + 'px',
    height: Math.floor(layout.value.h) + 'px',
  }))

  function surfaceStyle (s) {
    const l = layout.value
    if (allMode.value) {
      const d = displays.value[s.display]
      if (!d) return { display: 'none' }
      return {
        left: Math.floor((d.x - l.minX) * l.scale) + 'px',
        top: Math.floor((d.y - l.minY) * l.scale) + 'px',
        width: Math.floor(d.width * l.scale) + 'px',
        height: Math.floor(d.height * l.scale) + 'px',
      }
    }
    return { left: 0, top: 0, width: Math.floor(l.w) + 'px', height: Math.floor(l.h) + 'px' }
  }

  const screenClass = computed(() => ({
    adaptive: settings.viewStyle === 'adaptive',
    scrollbar: settings.viewStyle !== 'adaptive' && settings.scrollStyle === 'scrollbar',
    scrollauto: settings.viewStyle !== 'adaptive' && settings.scrollStyle === 'scrollauto',
  }))

  // "Scroll automatically": the view follows the mouse when the picture is larger than the window.
  function onScreenPointerMove (ev) {
    if (settings.viewStyle === 'adaptive' || settings.scrollStyle !== 'scrollauto') return
    const el = screenEl.value
    const r = el.getBoundingClientRect()
    const fx = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1)
    const fy = Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1)
    el.scrollLeft = fx * (el.scrollWidth - el.clientWidth)
    el.scrollTop = fy * (el.scrollHeight - el.clientHeight)
  }

  // ---------- cursor ----------

  function setCursorId (id) {
    remoteCursor.id = id
    remoteCursor.img = cursors.image(id)
    remoteCursor.cssVersion++
  }

  const cursorCss = computed(() => {
    // eslint-disable-next-line no-unused-expressions
    remoteCursor.cssVersion
    if (!remoteCursor.id || state.relativeMouse) return state.relativeMouse ? 'none' : 'default'
    const d = display()
    if (d && d.cursorEmbedded) return 'default'
    let scale = 1
    if (settings.zoomCursor && settings.viewStyle !== 'original') {
      const s = surfaces.value[0]
      scale = allMode.value ? layout.value.scale : (s && s.w && d ? layout.value.w / d.width : 1)
    }
    return cursors.css(remoteCursor.id, scale) || 'default'
  })

  function onCursorPosition (cp) {
    // Which display the position is on (all-displays view), relative to it.
    let di = currentDisplay.value
    if (allMode.value) {
      di = displays.value.findIndex((d) => cp.x >= d.x && cp.x < d.x + d.width && cp.y >= d.y && cp.y < d.y + d.height)
      if (di < 0) return
    }
    const d = displays.value[di]
    if (!d) return
    Object.assign(remoteCursor, { x: cp.x - d.x, y: cp.y - d.y, display: di, visible: settings.showRemoteCursor || settings.viewOnly })
    if (settings.followRemoteCursor && !allMode.value && settings.viewStyle !== 'adaptive') {
      const el = screenEl.value
      const f = layout.value.w / d.width
      const px = remoteCursor.x * f
      const py = remoteCursor.y * f
      if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth) el.scrollLeft = px - el.clientWidth / 2
      if (py < el.scrollTop || py > el.scrollTop + el.clientHeight) el.scrollTop = py - el.clientHeight / 2
    }
  }

  function remoteCursorStyle (s) {
    const d = displays.value[s.display]
    const img = remoteCursor.img
    if (!d || !img) return {}
    const st = surfaceStyle(s)
    const f = parseFloat(st.width) / d.width
    const z = settings.zoomCursor ? f : 1
    return {
      left: (remoteCursor.x * f - img.hotx * z) + 'px',
      top: (remoteCursor.y * f - img.hoty * z) + 'px',
      width: img.width * z + 'px',
      height: img.height * z + 'px',
    }
  }

  // ---------- mouse ----------

  function remotePos (ev) {
    const c = ev.currentTarget
    const di = Number(c.dataset.display)
    const d = displays.value[di] || display()
    if (!d) return null
    const r = c.getBoundingClientRect()
    if (!r.width || !r.height) return null
    const fx = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1)
    const fy = Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1)
    return {
      x: Math.round(d.x + fx * (d.width - 1)),
      y: Math.round(d.y + fy * (d.height - 1)),
    }
  }

  const inputAllowed = () => conn && phase.value === 'connected' && !settings.viewOnly

  function flushMove () {
    moveScheduled = false
    if (!pendingMove || !conn) return
    // Do not pile up moves on a slow line; the newest position wins.
    if (conn.sendBacklog > 256 * 1024) {
      moveScheduled = true
      setTimeout(flushMove, 30)
      return
    }
    const m = pendingMove
    pendingMove = null
    if (m.rel) conn.sendMouse(MOUSE_TYPE_MOVE_RELATIVE, m.x, m.y)
    else conn.sendMouse(MOUSE_TYPE_MOVE, m.x, m.y)
  }

  function scheduleMove (m) {
    if (m.rel && pendingMove && pendingMove.rel) {
      pendingMove.x += m.x
      pendingMove.y += m.y
    } else {
      pendingMove = m
    }
    if (!moveScheduled) {
      moveScheduled = true
      requestAnimationFrame(flushMove)
    }
  }

  function onPointerMove (ev) {
    if (!inputAllowed()) return
    if (state.relativeMouse) {
      const c = ev.currentTarget
      const d = displays.value[Number(c.dataset.display)] || display()
      const f = d ? d.width / c.getBoundingClientRect().width : 1
      scheduleMove({ rel: true, x: Math.round(ev.movementX * f), y: Math.round(ev.movementY * f) })
      return
    }
    const p = remotePos(ev)
    if (p) scheduleMove(p)
  }

  function button (ev) {
    let b = BUTTONS[ev.button]
    if (settings.swapMouseButtons) {
      if (b === 0x01) b = 0x02
      else if (b === 0x02) b = 0x01
    }
    return b
  }

  function onPointerDown (ev) {
    if (!inputAllowed()) return
    const c = ev.currentTarget
    c.focus()
    c.setPointerCapture && c.setPointerCapture(ev.pointerId)
    const p = remotePos(ev)
    const b = button(ev)
    if (!p || !b) return
    pendingMove = null
    conn.sendMouse(MOUSE_TYPE_DOWN | (b << 3), p.x, p.y)
  }

  function onPointerUp (ev) {
    if (!inputAllowed()) return
    const p = remotePos(ev)
    const b = button(ev)
    if (!p || !b) return
    conn.sendMouse(MOUSE_TYPE_UP | (b << 3), p.x, p.y)
  }

  function onWheel (ev) {
    if (!inputAllowed()) return
    // One step per notch: 100 px or 3 lines.
    const unit = ev.deltaMode === 1 ? 3 : ev.deltaMode === 2 ? 1 : 100
    const dir = settings.reverseWheel ? -1 : 1
    wheelAcc.x += dir * ev.deltaX / unit
    wheelAcc.y += dir * ev.deltaY / unit
    const sx = Math.trunc(wheelAcc.x)
    const sy = Math.trunc(wheelAcc.y)
    if (!sx && !sy) return
    wheelAcc.x -= sx
    wheelAcc.y -= sy
    // RustDesk: positive y scrolls up, positive x scrolls left.
    conn.sendMouse(MOUSE_TYPE_WHEEL, -sx, -sy)
  }

  // Relative mouse mode (games, 3D): the pointer is locked to the picture; Esc releases it.
  async function toggleRelativeMouse () {
    if (state.relativeMouse) {
      document.exitPointerLock && document.exitPointerLock()
      return
    }
    const c = canvases[surfaces.value[0] && surfaces.value[0].display]
    if (!c || !c.requestPointerLock) return
    try {
      await c.requestPointerLock()
      ElMessage.info(T('RemoteRelativeMouseHint'))
    } catch (e) {
      ElMessage.error(T('RemoteRelativeMouseFailed'))
    }
  }
  const onPointerLockChange = () => {
    state.relativeMouse = !!document.pointerLockElement
  }

  // ---------- keyboard ----------

  function dialogOpen () {
    return dialogs.type || dialogs.osPassword || dialogs.elevate || dialogs.resolution
  }

  function keyTargetIsInput (ev) {
    const t = ev.target
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  const swapAvailable = computed(() => (os.value === 'macos') !== isMacBrowser)

  function keyOpts () {
    return {
      mode: settings.keyboardMode,
      isoMac: isMacBrowser && settings.isoMac,
      swapCtrlCmd: swapAvailable.value && settings.swapCtrlCmd,
      translated,
    }
  }

  function onKey (ev, down) {
    if (!conn || phase.value !== 'connected' || dialogOpen() || keyTargetIsInput(ev)) return
    if (!peerInfo.value) return
    audio.resume()
    ev.preventDefault()
    ev.stopPropagation()
    if (!keyboardAllowed.value) return
    const ke = keyEventFor(ev, down, peerInfo.value, keyOpts())
    if (!ke) return
    if (ke.union.case === 'chr') {
      if (down) pressed.add(ev.code)
      else pressed.delete(ev.code)
    }
    // Paste (Ctrl/Cmd+V): bring this computer's clipboard over first.
    const paste = down && (ev.ctrlKey || ev.metaKey) && ev.code === 'KeyV' && !clipboardDisabled() && perms.clipboard
    keyChain = keyChain.then(async () => {
      if (paste) await syncClipboardFromLocal(true)
      if (conn) conn.sendKey(ke)
    })
  }

  const onKeyDown = (ev) => onKey(ev, true)
  const onKeyUp = (ev) => onKey(ev, false)

  // Keys held while the tab loses focus would stay down on the remote side.
  function releaseAll (send = true) {
    if (send && conn && peerInfo.value) {
      for (const code of pressed) {
        const ke = keyEventFor({ code, key: '', getModifierState: () => false }, false, peerInfo.value, keyOpts())
        if (ke) conn.sendKey(ke)
      }
    }
    pressed.clear()
    translated.clear()
  }

  const onBlur = () => releaseAll(true)
  const onFocus = () => {
    if (conn && phase.value === 'connected' && !clipboardDisabled()) {
      if (clipboardPending !== null) writeLocalClipboard(clipboardPending)
      syncClipboardFromLocal(false)
    }
  }
  const onVisibility = () => {
    if (document.hidden) releaseAll(true)
    else if (conn && phase.value === 'connected') for (const s of surfaces.value) conn.refreshVideo(s.display)
  }

  // ---------- clipboard (text) ----------

  // ask: may show the browser's permission prompt (only after a key press of the user).
  async function syncClipboardFromLocal (ask) {
    if (!conn || clipboardDisabled() || !perms.clipboard) return
    try {
      if (!ask && navigator.permissions) {
        const st = await navigator.permissions.query({ name: 'clipboard-read' }).catch(() => null)
        if (!st || st.state !== 'granted') return
      }
      const text = await navigator.clipboard.readText()
      if (!text || text === lastClipboardSent || text === lastClipboardReceived) return
      if (text.length > MAX_CLIPBOARD) return
      lastClipboardSent = text
      conn.sendClipboardText(text)
    } catch (e) { /* no permission or nothing to read */ }
  }

  function onPeerClipboard (list) {
    if (clipboardDisabled() || !perms.clipboard) return
    const cb = list.find((c) => (c.format || ClipboardFormat.Text) === ClipboardFormat.Text)
    if (!cb || !cb.content || cb.content.length > MAX_CLIPBOARD) return
    let bytes = cb.content
    if (cb.compress) {
      try {
        bytes = decompress(bytes)
      } catch (e) {
        return
      }
      if (bytes.length > MAX_CLIPBOARD) return
    }
    const text = new TextDecoder().decode(bytes)
    lastClipboardReceived = text
    lastClipboardSent = text
    if (document.hasFocus()) writeLocalClipboard(text)
    else clipboardPending = text
  }

  function writeLocalClipboard (text) {
    clipboardPending = null
    navigator.clipboard.writeText(text).catch(() => {
      clipboardPending = text
    })
  }

  async function sendClipboardKeystrokes () {
    try {
      const text = await navigator.clipboard.readText()
      if (text && conn) conn.typeText(text)
    } catch (e) {
      ElMessage.error(T('RemoteClipboardDenied'))
    }
  }

  // ---------- chat ----------

  function addChat (text, mine) {
    const d = new Date()
    chat.messages.push({ text, mine, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` })
    if (chat.messages.length > 500) chat.messages.shift()
    // Like the app: a message from the device opens the chat.
    if (!mine && !chat.open) chat.open = true
  }

  function sendChat (text) {
    if (!conn) return
    conn.sendChat(text)
    addChat(text, true)
  }

  // ---------- recording / screenshot ----------

  function startRecording () {
    const c = canvases[surfaces.value[0] && surfaces.value[0].display]
    if (!c || typeof MediaRecorder === 'undefined') {
      ElMessage.error(T('RemoteRecordUnsupported'))
      return
    }
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
    try {
      recorder = new MediaRecorder(c.captureStream(30), mimeType ? { mimeType } : {})
    } catch (e) {
      ElMessage.error(T('RemoteRecordUnsupported'))
      return
    }
    recChunks = []
    recorder.ondataavailable = (e) => e.data && e.data.size && recChunks.push(e.data)
    recorder.onstop = () => {
      const ext = (recorder && recorder.mimeType || mimeType).includes('mp4') ? 'mp4' : 'webm'
      download(new Blob(recChunks, { type: mimeType || 'video/webm' }), `RustDesk_${peerId}_${stamp()}.${ext}`)
      recChunks = []
    }
    recorder.start(1000)
    recording.active = true
    // The person at the device sees that the session is being recorded.
    if (conn) conn.sendMisc('clientRecordStatus', true)
  }

  function stopRecording () {
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorder = null
    recording.active = false
    if (conn) conn.sendMisc('clientRecordStatus', false)
  }

  function takeScreenshot () {
    const list = surfaces.value.filter((s) => canvases[s.display] && s.w)
    if (!list.length) return
    let out
    if (list.length === 1) {
      out = canvases[list[0].display]
    } else {
      // All displays: put them together as they are arranged.
      const ds = list.map((s) => ({ s, d: displays.value[s.display] }))
      const f = Math.max(...ds.map(({ s, d }) => s.w / d.width))
      const minX = Math.min(...ds.map(({ d }) => d.x))
      const minY = Math.min(...ds.map(({ d }) => d.y))
      out = document.createElement('canvas')
      out.width = Math.ceil((Math.max(...ds.map(({ d }) => d.x + d.width)) - minX) * f)
      out.height = Math.ceil((Math.max(...ds.map(({ d }) => d.y + d.height)) - minY) * f)
      const ctx = out.getContext('2d')
      for (const { s, d } of ds) ctx.drawImage(canvases[s.display], (d.x - minX) * f, (d.y - minY) * f, d.width * f, d.height * f)
    }
    out.toBlob((b) => b && download(b, `RustDesk_${peerId}_${stamp()}.png`), 'image/png')
  }

  // ---------- quality monitor ----------

  function startStats () {
    clearInterval(statsTimer)
    lastStats = { t: performance.now(), bytes: conn ? conn.bytesIn : 0, frames: 0 }
    statsTimer = setInterval(() => {
      if (!conn) return
      const now = performance.now()
      let frames = 0
      let codec = ''
      for (const r of renderers.values()) {
        frames += r.frames
        codec = codec || r.codecName
      }
      const dt = (now - lastStats.t) / 1000
      stats.speed = `${Math.round((conn.bytesIn - lastStats.bytes) / 1024 / dt)} kB/s`
      stats.fps = String(Math.round((frames - lastStats.frames) / dt))
      stats.delay = lastDelay && lastDelay.lastDelay ? `${lastDelay.lastDelay} ms` : '-'
      stats.target = lastDelay && lastDelay.targetBitrate ? `${lastDelay.targetBitrate} kb` : '-'
      stats.codec = codec ? codec.toUpperCase() : '-'
      stats.chroma = settings.i444 ? '4:4:4' : '4:2:0'
      lastStats = { t: now, bytes: conn.bytesIn, frames }
    }, 1000)
  }

  // ---------- actions ----------

  function switchDisplay (i) {
    if (!conn) return
    if (i === ALL_DISPLAYS) {
      currentDisplay.value = ALL_DISPLAYS
      rebuildSurfaces()
      conn.captureAllDisplays(displays.value.length)
      return
    }
    if (i === currentDisplay.value) return
    currentDisplay.value = i
    rebuildSurfaces()
    conn.switchDisplay(i)
  }

  function changeResolution (w, h) {
    const d = allMode.value ? 0 : currentDisplay.value
    if (!conn || !w || !h) return
    if (atLeast('1.2.4')) conn.sendMisc('changeDisplayResolution', { display: d, resolution: { width: w, height: h } })
    else conn.sendMisc('changeResolution', { width: w, height: h })
  }

  function applyCustomResolution () {
    dialogs.resolution = false
    changeResolution(dialogs.resW, dialogs.resH)
  }

  function sendTyped () {
    if (conn && dialogs.typeValue) conn.typeText(dialogs.typeValue)
    dialogs.type = false
    focusPicture()
  }

  function sendOsPassword () {
    if (conn && dialogs.osPasswordValue) {
      conn.typeText(dialogs.osPasswordValue)
      conn.sendKey({ press: true, union: { case: 'controlKey', value: ControlKey.Return }, mode: KeyboardMode.Legacy })
    }
    dialogs.osPasswordValue = ''
    dialogs.osPassword = false
    focusPicture()
  }

  function sendElevation () {
    if (!conn) return
    if (dialogs.elevateMode === 'direct') {
      conn.sendMisc('elevationRequest', { union: { case: 'direct', value: true } })
    } else {
      conn.sendMisc('elevationRequest', { union: { case: 'logon', value: { username: dialogs.elevateUser, password: dialogs.elevatePassword } } })
    }
    dialogs.elevatePassword = ''
    dialogs.elevate = false
    ElMessage.info(T('RemoteElevationSent'))
  }

  async function restartRemote () {
    try {
      await ElMessageBox.confirm(T('RemoteRestartConfirm', { name: title.value }), T('RemoteRestart'), { type: 'warning' })
    } catch (e) {
      return
    }
    if (conn) conn.sendMisc('restartRemoteDevice', true)
  }

  function togglePrivacy (implKey, on) {
    if (!conn) return
    if (implKey) conn.sendMisc('togglePrivacyMode', { implKey, on })
    else conn.sendOption({ privacyMode: bool(on) })
  }

  function setViewOnly (v) {
    settings.viewOnly = v
    if (!conn) return
    releaseAll(true)
    conn.sendOption(v
      ? { disableKeyboard: bool(true), disableClipboard: bool(true), showRemoteCursor: bool(true), lockAfterSessionEnd: bool(false) }
      : {
          disableKeyboard: bool(false),
          disableClipboard: bool(clipboardDisabled()),
          showRemoteCursor: bool(settings.showRemoteCursor),
          lockAfterSessionEnd: bool(settings.lockAfterSessionEnd),
        })
  }

  function setI444 (v) {
    settings.i444 = v
    for (const r of renderers.values()) {
      r.i444 = v
      r.reset()
    }
    if (conn) {
      conn.sendOption({ supportedDecoding: decodingOption() })
      for (const s of surfaces.value) conn.refreshVideo(s.display)
    }
  }

  async function toggleFullscreen () {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
      return
    }
    await rootEl.value.requestFullscreen().catch(() => {})
    // In full screen, Chrome can pass keys like Esc or Cmd+Tab on to the remote side.
    if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock().catch(() => {})
  }
  const onFullscreenChange = () => {
    state.fullscreen = !!document.fullscreenElement
  }

  function focusPicture () {
    nextTick(() => {
      const s = surfaces.value[0]
      const c = s && canvases[s.display]
      c && c.focus()
    })
  }

  // ---------- toolbar menus (as in the app) ----------

  const sep = { type: 'divider' }

  const monitorItems = computed(() => {
    const items = displays.value.map((d, i) => ({
      type: 'radio',
      label: `${T('RemoteDisplay')} ${i + 1}  (${d.width}×${d.height})`,
      checked: currentDisplay.value === i,
      onClick: () => switchDisplay(i),
    }))
    if (displays.value.length > 1 && atLeast('1.2.4')) {
      items.push(sep, { type: 'radio', label: T('RemoteAllDisplays'), checked: allMode.value, onClick: () => switchDisplay(ALL_DISPLAYS) })
    }
    return items
  })

  const controlItems = computed(() => {
    const p = pi.value
    const items = []
    if (perms.keyboard && p.platform === 'Windows' && !p.sasEnabled && !state.portableRunning) {
      items.push({ type: 'action', label: T('RemoteRequestElevation'), onClick: () => { dialogs.elevate = true } })
    }
    if (perms.keyboard) {
      items.push({ type: 'action', label: T('RemoteOsPassword'), disabled: settings.viewOnly, onClick: () => { dialogs.osPassword = true } })
    }
    if (perms.keyboard && os.value !== 'android') {
      items.push({ type: 'action', label: T('RemoteSendClipboardKeys'), disabled: settings.viewOnly || !clipboardAvailable.value, onClick: sendClipboardKeystrokes })
    }
    if (perms.keyboard) {
      items.push({ type: 'action', label: T('RemoteTypeText'), disabled: settings.viewOnly, onClick: () => { dialogs.typeValue = ''; dialogs.type = true } })
    }
    items.push(sep)
    if (perms.keyboard && !settings.viewOnly && (os.value === 'linux' || p.sasEnabled)) {
      items.push({ type: 'action', label: T('RemoteCtrlAltDel'), onClick: () => conn && conn.ctrlAltDel() })
    }
    if (perms.restart && ['windows', 'linux', 'macos'].includes(os.value)) {
      items.push({ type: 'action', label: T('RemoteRestart'), onClick: restartRemote })
    }
    if (perms.keyboard && !settings.viewOnly) {
      items.push({ type: 'action', label: T('RemoteLockScreen'), onClick: () => conn && conn.lockScreen() })
    }
    if (perms.keyboard && perms.blockInput && os.value === 'windows') {
      items.push({
        type: 'action',
        label: state.blockInput ? T('RemoteUnblockInput') : T('RemoteBlockInput'),
        onClick: () => conn && conn.sendOption({ blockInput: bool(!state.blockInput) }),
      })
    }
    items.push({ type: 'action', label: T('RemoteRefresh'), onClick: () => conn && surfaces.value.forEach((s) => conn.refreshVideo(s.display)) })
    items.push({ type: 'action', label: T('RemoteScreenshot'), disabled: !hasFrame.value, onClick: takeScreenshot })
    return items.filter((it, i, a) => !(it.type === 'divider' && (i === 0 || i === a.length - 1 || a[i - 1].type === 'divider')))
  })

  const codecItems = computed(() => {
    const d = decodings || {}
    const enc = pi.value.encoding || {}
    const list = [['auto', T('RemoteCodecAuto')]]
    if (d.vp8 && enc.vp8 !== false) list.push(['vp8', 'VP8'])
    if (d.vp9) list.push(['vp9', 'VP9'])
    if (d.av1 && enc.av1) list.push(['av1', 'AV1'])
    if (d.h264 && enc.h264) list.push(['h264', 'H264'])
    if (d.h265 && enc.h265) list.push(['h265', 'H265'])
    return list.map(([k, label]) => ({
      type: 'radio', label, checked: settings.codec === k,
      onClick: () => {
        settings.codec = k
        if (conn) conn.sendOption({ supportedDecoding: decodingOption() })
      },
    }))
  })

  const resolutionItems = computed(() => {
    const d = display()
    if (!d) return []
    const items = []
    const cur = `${d.width}×${d.height}`
    if (d.original && d.original.w) {
      items.push({ type: 'action', label: `${T('RemoteResOriginal')} (${d.original.w}×${d.original.h})`, onClick: () => changeResolution(d.original.w, d.original.h) })
    }
    const dpr = window.devicePixelRatio || 1
    const fw = Math.round(screenSize.w * dpr)
    const fh = Math.round(screenSize.h * dpr)
    if (fw && fh) {
      items.push({ type: 'action', label: `${T('RemoteResFitLocal')} (${fw}×${fh})`, onClick: () => changeResolution(fw, fh) })
    }
    const res = (d.resolutions || []).slice().sort((a, b) => b.w * b.h - a.w * a.h)
    if (res.length) items.push(sep)
    for (const r of res) {
      items.push({ type: 'radio', label: `${r.w}×${r.h}`, checked: `${r.w}×${r.h}` === cur, onClick: () => changeResolution(r.w, r.h) })
    }
    items.push(sep, { type: 'action', label: T('RemoteCustomResolution') + '…', onClick: () => { dialogs.resW = d.width; dialogs.resH = d.height; dialogs.resolution = true } })
    return items
  })

  const virtualDisplayItems = computed(() => {
    const pa = platformAdditions.value
    if (os.value !== 'windows' || pa.is_installed === false) return []
    if (pa.idd_impl === 'rustdesk_idd') {
      const on = Array.isArray(pa.rustdesk_virtual_displays) ? pa.rustdesk_virtual_displays : []
      const items = [1, 2, 3, 4].map((i) => ({
        type: 'check', label: `${T('RemoteVirtualDisplay')} ${i}`, checked: on.includes(i),
        onClick: () => conn && conn.sendMisc('toggleVirtualDisplay', { display: i, on: !on.includes(i) }),
      }))
      items.push(sep, { type: 'action', label: T('RemotePlugOutAll'), onClick: () => conn && conn.sendMisc('toggleVirtualDisplay', { display: -1, on: false }) })
      return items
    }
    if (pa.idd_impl === 'amyuni_idd') {
      const count = Number(pa.amyuni_virtual_displays) || 0
      return [
        { type: 'label', label: `${T('RemoteVirtualDisplay')}: ${count}` },
        { type: 'action', label: T('RemoteVirtualAdd'), disabled: count >= 4, onClick: () => conn && conn.sendMisc('toggleVirtualDisplay', { display: 0, on: true }) },
        { type: 'action', label: T('RemoteVirtualRemove'), disabled: count === 0, onClick: () => conn && conn.sendMisc('toggleVirtualDisplay', { display: 0, on: false }) },
        { type: 'action', label: T('RemotePlugOutAll'), disabled: count === 0, onClick: () => conn && conn.sendMisc('toggleVirtualDisplay', { display: -1, on: false }) },
      ]
    }
    return []
  })

  const privacyItems = computed(() => {
    const p = pi.value
    if (!(p.features && p.features.privacyMode) && !state.privacyImpl) return []
    if (!perms.keyboard && !state.privacyImpl) return []
    const impls = Array.isArray(platformAdditions.value.supported_privacy_mode_impl) ? platformAdditions.value.supported_privacy_mode_impl : null
    const name = (tip) => ({
      privacy_mode_impl_mag_tip: T('RemotePrivacyMode1'),
      privacy_mode_impl_virtual_display_tip: T('RemotePrivacyMode2'),
    }[tip] || tip)
    if (!impls || impls.length <= 1) {
      const key = impls && impls.length ? impls[0][0] : ''
      return [{ type: 'check', label: T('RemotePrivacyMode'), checked: !!state.privacyImpl, onClick: () => togglePrivacy(key, !state.privacyImpl) }]
    }
    return [{
      type: 'submenu',
      label: T('RemotePrivacyMode'),
      children: impls.map(([key, tip]) => ({
        type: 'check', label: name(tip), checked: state.privacyImpl === key,
        onClick: () => togglePrivacy(key, state.privacyImpl !== key),
      })),
    }]
  })

  const displayItems = computed(() => {
    const p = pi.value
    const items = [
      { type: 'action', label: state.fullscreen ? T('RemoteExitFullscreen') : T('RemoteFullscreen'), onClick: toggleFullscreen },
      sep,
      { type: 'radio', label: T('RemoteScaleOriginal'), checked: settings.viewStyle === 'original', onClick: () => { settings.viewStyle = 'original' } },
      { type: 'radio', label: T('RemoteScaleAdaptive'), checked: settings.viewStyle === 'adaptive', onClick: () => { settings.viewStyle = 'adaptive' } },
      { type: 'radio', label: T('RemoteScaleCustom'), checked: settings.viewStyle === 'custom', onClick: () => { settings.viewStyle = 'custom' } },
    ]
    if (settings.viewStyle === 'custom') {
      items.push({ type: 'slider', label: T('RemoteScale'), min: 10, max: 400, step: 5, value: settings.customScale, suffix: ' %', onInput: (v) => { settings.customScale = v } })
    }
    if (settings.viewStyle !== 'adaptive') {
      items.push(sep,
        { type: 'radio', label: T('RemoteScrollAuto'), checked: settings.scrollStyle === 'scrollauto', onClick: () => { settings.scrollStyle = 'scrollauto' } },
        { type: 'radio', label: T('RemoteScrollbar'), checked: settings.scrollStyle === 'scrollbar', onClick: () => { settings.scrollStyle = 'scrollbar' } })
    }
    const q = (k, label) => ({
      type: 'radio', label, checked: settings.imageQuality === k,
      onClick: () => { settings.imageQuality = k; conn && conn.sendOption(qualityOption()) },
    })
    items.push(sep,
      q('best', T('RemoteQualityBest')), q('balanced', T('RemoteQualityBalanced')),
      q('low', T('RemoteQualityLow')), q('custom', T('RemoteQualityCustom')))
    if (settings.imageQuality === 'custom') {
      items.push(
        { type: 'slider', label: T('RemoteQualityBitrate'), min: 10, max: 100, step: 5, value: settings.customQuality, suffix: ' %', onInput: (v) => { settings.customQuality = v }, onChange: () => conn && conn.sendOption(qualityOption()) },
        { type: 'slider', label: 'FPS', min: 5, max: 120, step: 5, value: settings.customFps, onInput: (v) => { settings.customFps = v }, onChange: () => conn && conn.sendOption(qualityOption()) })
    }
    items.push(sep, { type: 'submenu', label: T('RemoteCodec'), children: codecItems.value })
    if (!allMode.value && atLeast('1.2.0')) items.push({ type: 'submenu', label: T('RemoteResolution'), children: resolutionItems.value })
    if (virtualDisplayItems.value.length) items.push({ type: 'submenu', label: T('RemoteVirtualDisplay'), children: virtualDisplayItems.value })
    items.push(sep)
    if (os.value !== 'android') {
      items.push({
        type: 'check', label: T('RemoteShowRemoteCursor'), checked: settings.showRemoteCursor || settings.viewOnly, disabled: settings.viewOnly,
        onClick: () => {
          setOption('showRemoteCursor', !settings.showRemoteCursor, { showRemoteCursor: bool(!settings.showRemoteCursor) })
          remoteCursor.visible = false
        },
      })
      if (!allMode.value) {
        items.push({
          type: 'check', label: T('RemoteFollowCursor'), checked: settings.followRemoteCursor,
          onClick: () => {
            const v = !settings.followRemoteCursor
            setOption('followRemoteCursor', v, { followRemoteCursor: bool(v) })
            // The app turns on "show remote cursor" with it.
            if (v && !settings.showRemoteCursor) setOption('showRemoteCursor', true, { showRemoteCursor: bool(true) })
          },
        })
        items.push({ type: 'check', label: T('RemoteFollowWindow'), checked: settings.followRemoteWindow, onClick: () => setOption('followRemoteWindow', !settings.followRemoteWindow, { followRemoteWindow: bool(!settings.followRemoteWindow) }) })
      }
    }
    if (settings.viewStyle !== 'original') {
      items.push({ type: 'check', label: T('RemoteZoomCursor'), checked: settings.zoomCursor, onClick: () => { settings.zoomCursor = !settings.zoomCursor; remoteCursor.cssVersion++ } })
    }
    items.push(sep, { type: 'check', label: T('RemoteQualityMonitor'), checked: settings.showQualityMonitor, onClick: () => { settings.showQualityMonitor = !settings.showQualityMonitor } })
    if (perms.audio) {
      items.push({
        type: 'check', label: T('RemoteMute'), checked: settings.mute || !audioSupported(), disabled: !audioSupported(), hint: audioSupported() ? '' : T('RemoteAudioUnsupported'),
        onClick: () => {
          const v = !settings.mute
          setOption('mute', v, { disableAudio: bool(v) })
          audio.setMuted(v)
        },
      })
    }
    if (perms.keyboard && perms.clipboard) {
      items.push({
        type: 'check', label: T('RemoteDisableClipboard'), checked: clipboardDisabled(), disabled: settings.viewOnly || !clipboardAvailable.value,
        hint: clipboardAvailable.value ? '' : T('RemoteClipboardNeedsHttps'),
        onClick: () => setOption('disableClipboard', !settings.disableClipboard, { disableClipboard: bool(!settings.disableClipboard) }),
      })
    }
    if (perms.keyboard && os.value !== 'android') {
      items.push({
        type: 'check', label: T('RemoteLockAfterEnd'), checked: settings.lockAfterSessionEnd, disabled: settings.viewOnly,
        onClick: () => setOption('lockAfterSessionEnd', !settings.lockAfterSessionEnd, { lockAfterSessionEnd: bool(!settings.lockAfterSessionEnd) }),
      })
    }
    const enc444 = p.encoding && p.encoding.i444
    const dec444 = decodings && decodings.i444
    if (atLeast('1.2.4') && enc444 && dec444 && ((enc444.vp9 && dec444.vp9) || (enc444.av1 && dec444.av1))) {
      items.push({ type: 'check', label: T('RemoteTrueColor'), checked: settings.i444, onClick: () => setI444(!settings.i444) })
    }
    if (privacyItems.value.length) items.push(sep, ...privacyItems.value)
    return items.filter((it, i, a) => !(it.type === 'divider' && (i === a.length - 1 || a[i - 1].type === 'divider')))
  })

  const keyboardItems = computed(() => {
    const modes = peerInfo.value ? supportedKeyboardModes(peerInfo.value) : ['legacy']
    const names = { map: T('RemoteKbMap'), translate: T('RemoteKbTranslate'), legacy: T('RemoteKbLegacy') }
    const items = [{ type: 'label', label: T('RemoteKbMode') }]
    for (const m of ['map', 'translate', 'legacy']) {
      if (modes.includes(m)) {
        items.push({ type: 'radio', label: names[m], checked: settings.keyboardMode === m, disabled: !keyboardAllowed.value, onClick: () => { releaseAll(true); settings.keyboardMode = m } })
      }
    }
    items.push(sep)
    items.push({ type: 'check', label: T('RemoteViewMode'), checked: settings.viewOnly, onClick: () => setViewOnly(!settings.viewOnly) })
    if (swapAvailable.value) {
      items.push({ type: 'check', label: T('RemoteSwapCtrlCmd'), checked: settings.swapCtrlCmd, disabled: !keyboardAllowed.value, onClick: () => { releaseAll(true); settings.swapCtrlCmd = !settings.swapCtrlCmd } })
    }
    if (isMacBrowser) {
      items.push({ type: 'check', label: T('RemoteIsoMac'), checked: settings.isoMac, onClick: () => { settings.isoMac = !settings.isoMac } })
    }
    if (atLeast('1.4.5') && !settings.viewOnly) {
      items.push({ type: 'check', label: T('RemoteRelativeMouse'), checked: state.relativeMouse, onClick: toggleRelativeMouse })
    }
    items.push({ type: 'check', label: T('RemoteReverseWheel'), checked: settings.reverseWheel, onClick: () => { settings.reverseWheel = !settings.reverseWheel } })
    items.push({ type: 'check', label: T('RemoteSwapMouse'), checked: settings.swapMouseButtons, onClick: () => { settings.swapMouseButtons = !settings.swapMouseButtons } })
    return items
  })

  const toolbarButtons = computed(() => {
    const b = []
    if (displays.value.length > 1 && !state.privacyImpl) {
      b.push({ key: 'monitor', text: allMode.value ? '∗' : String(currentDisplay.value + 1), title: T('RemoteDisplay'), items: monitorItems.value })
    }
    b.push({ key: 'control', icon: 'bolt', title: T('RemoteControlActions'), items: controlItems.value })
    b.push({ key: 'display', icon: 'display', title: T('RemoteDisplaySettings'), items: displayItems.value })
    b.push({ key: 'keyboard', icon: 'keyboard', title: T('RemoteKeyboardSettings'), items: keyboardItems.value })
    b.push({ key: 'chat', icon: 'chat', title: T('RemoteTextChat'), badge: chat.unread || 0, active: chat.open, onClick: () => { chat.open = !chat.open; chat.unread = 0 } })
    if (perms.recording || recording.active) {
      b.push({ key: 'rec', icon: 'rec', color: recording.active ? 'red' : 'blue', title: recording.active ? T('RemoteStopRecording') : T('RemoteStartRecording'), onClick: () => (recording.active ? stopRecording() : startRecording()) })
    }
    b.push({ key: 'close', icon: 'close', color: 'red', title: T('RemoteDisconnect'), onClick: disconnect })
    return b
  })

  // ---------- lifecycle ----------

  function cleanup (sendRelease = true) {
    releaseAll(sendRelease)
    if (recording.active) stopRecording()
    clearInterval(statsTimer)
    if (document.pointerLockElement) document.exitPointerLock()
    if (conn) {
      conn.close()
      conn = null
    }
    for (const r of renderers.values()) r.close()
    renderers.clear()
    audio.closeDecoder()
  }

  function disconnect () {
    cleanup()
    phase.value = 'closed'
    errorText.value = T('RemoteClosedByYou')
  }

  function reconnect () {
    connect()
  }

  function closeWindow () {
    cleanup()
    window.close()
  }

  const onUnload = () => cleanup()

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    resizeObserver = new ResizeObserver(() => {
      screenSize.w = screenEl.value.clientWidth
      screenSize.h = screenEl.value.clientHeight
    })
    resizeObserver.observe(screenEl.value)
    connect()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp, true)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('beforeunload', onUnload)
    document.removeEventListener('visibilitychange', onVisibility)
    document.removeEventListener('pointerlockchange', onPointerLockChange)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    if (resizeObserver) resizeObserver.disconnect()
    cleanup()
    audio.close()
  })
</script>

<style scoped lang="scss">
.remote {
  --rd-canvas: #212121;
  --rd-bar-bg: #ffffff;
  --rd-menu-bg: #ffffff;
  --rd-input-bg: #ffffff;
  --rd-text: #1f1f1f;
  --rd-muted: #8a8f96;
  --rd-border: #cccccc;
  --rd-hover: #eef1f6;
  --rd-accent: #0071ff;
  --rd-btn: #2c8cff;
  --rd-btn-hover: #0071ff;
  --rd-btn-grey: #424242;
  --rd-btn-grey-hover: #303030;

  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--rd-canvas);
  color: #e6e6e6;
  font-size: 14px;
}

:global(html.dark) .remote {
  --rd-bar-bg: #2b2d31;
  --rd-menu-bg: #2b2d31;
  --rd-input-bg: #1f2023;
  --rd-text: #e6e6e6;
  --rd-muted: #9aa0a6;
  --rd-border: #44474d;
  --rd-hover: #393c42;
}

.rd-topline {
  position: absolute;
  top: 10px;
  left: 14px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #e6a23c;
  flex: none;

  &.error, &.closed {
    background: #f56c6c;
  }
}

.screen {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;

  &.adaptive {
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  &.scrollbar {
    overflow: auto;
  }

  &.scrollauto {
    overflow: hidden;
  }
}

.stage {
  position: relative;
  flex: none;
  margin: auto;
}

.surface {
  position: absolute;
  overflow: hidden;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    outline: none;
    touch-action: none;
    background: #000;
  }
}

.remote-cursor {
  position: absolute;
  pointer-events: none;
  z-index: 2;
}

.quality-monitor {
  position: absolute;
  top: 60px;
  left: 12px;
  z-index: 15;
  padding: 8px 10px;
  background: rgba(0, 0, 0, .55);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  pointer-events: none;

  span {
    display: inline-block;
    min-width: 118px;
    color: #c9ced6;
  }
}

.rec-indicator {
  position: absolute;
  top: 60px;
  right: 14px;
  z-index: 15;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 82, 82, .9);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .box {
    min-width: 320px;
    max-width: 440px;
    padding: 24px;
    background: #24272c;
    border: 1px solid #33373d;
    border-radius: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;

    &.login {
      align-items: stretch;
      text-align: left;
    }

    .label {
      color: #c8ccd0;
    }

    .err-title {
      font-size: 16px;
      font-weight: 600;
    }

    .err-text {
      color: #f89898;
      word-break: break-word;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;

      .el-button + .el-button {
        margin-left: 0;
      }
    }
  }
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #44484f;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dlg-hint {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
}

.dlg-radios {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 10px;
}

.dlg-field {
  margin-top: 8px;
}

.dlg-res {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
