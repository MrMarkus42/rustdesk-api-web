<template>
  <div class="rd-toolbar-wrap" ref="wrapEl" :style="{ transform: `translateX(calc(-50% + ${offset}px))` }"
       @mouseenter="hover = true" @mouseleave="onLeave">
    <div class="rd-bar" v-show="!collapsed">
      <button class="rd-btn" :class="pinned ? 'blue' : 'grey'" :title="pinned ? T('RemoteUnpinToolbar') : T('RemotePinToolbar')"
              @click="$emit('update:pinned', !pinned)">
        <svg viewBox="0 0 24 24" class="ico" :class="{ stroke: !pinned }"><path :d="ICONS.pin"/></svg>
      </button>
      <template v-for="b in buttons" :key="b.key">
        <div class="rd-btn-wrap" :ref="(el) => setBtnRef(b.key, el)">
          <button class="rd-btn" :class="[b.color || 'blue', { open: openKey === b.key, active: b.active }]"
                  :title="b.title" @click="onButton(b)">
            <span v-if="b.text" class="rd-btn-text">{{ b.text }}</span>
            <svg v-else viewBox="0 0 24 24" class="ico" :class="{ stroke: STROKE[b.icon] }"><path :d="ICONS[b.icon]"/></svg>
            <span v-if="b.badge" class="rd-badge">{{ b.badge }}</span>
          </button>
          <RemoteMenu v-if="openKey === b.key && b.items" class="rd-dropdown" :class="{ right: menuRight }"
                      :items="b.items" @close="openKey = null"/>
        </div>
      </template>
    </div>
    <div class="rd-handle" @pointerdown="startDrag" :title="T('RemoteToolbarHandle')">
      <svg viewBox="0 0 24 24" class="grip"><path :d="ICONS.grip"/></svg>
      <svg viewBox="0 0 24 24" class="chev" @click.stop="toggleCollapsed" @pointerdown.stop>
        <path :d="collapsed ? ICONS.chevDown : ICONS.chevUp"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { T } from '@/utils/i18n'
  import RemoteMenu from './RemoteMenu.vue'

  // Own simple icons (24x24): pin, monitor, actions, display, keyboard, chat, record, close.
  const ICONS = {
    pin: 'M14.5 3.5l6 6-2.2.7-3.6 3.6.6 4.7-1.8 1.8-3.5-3.5L5 21.8 3.2 20l5-5-3.5-3.5 1.8-1.8 4.7.6 3.6-3.6z',
    monitor: 'M3 4h18v12H3zM9 20h6M12 16v4',
    bolt: 'M13.5 2L4.5 13.5h6.5L9.5 22l9-12h-6.5z',
    display: 'M3 4h18v12H3zM8 20h8M7.5 8.5v-2h2M16.5 8.5v-2h-2M7.5 11.5v2h2M16.5 11.5v2h-2',
    keyboard: 'M2.5 6h19v12h-19zM6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M6 12.5h.01M18 12.5h.01M8 15h8',
    chat: 'M4 4.5h16v11H9l-5 4z',
    rec: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
    close: 'M6 6l12 12M18 6L6 18',
    grip: 'M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01',
    chevUp: 'M7 14l5-5 5 5',
    chevDown: 'M7 10l5 5 5-5',
  }
  // Drawn as outlines; the others are filled.
  const STROKE = { monitor: true, display: true, keyboard: true, close: true, chat: true }

  const props = defineProps({
    buttons: { type: Array, required: true },
    pinned: { type: Boolean, default: true },
    offset: { type: Number, default: 0 },
  })
  const emit = defineEmits(['update:pinned', 'update:offset', 'menu-open'])

  const wrapEl = ref(null)
  const openKey = ref(null)
  const menuRight = ref(false)
  const collapsed = ref(false)
  const hover = ref(false)
  const btnRefs = {}
  let leaveTimer = null

  function setBtnRef (key, el) {
    if (el) btnRefs[key] = el
  }

  function onButton (b) {
    if (b.onClick) {
      openKey.value = null
      b.onClick()
      return
    }
    if (openKey.value === b.key) {
      openKey.value = null
      return
    }
    const el = btnRefs[b.key]
    // Near the right edge, the menu opens leftwards.
    menuRight.value = el ? el.getBoundingClientRect().left > window.innerWidth - 360 : false
    openKey.value = b.key
  }

  function toggleCollapsed () {
    collapsed.value = !collapsed.value
    openKey.value = null
  }

  // Unpinned, the toolbar folds away once the mouse leaves it (and no menu is open).
  function onLeave () {
    hover.value = false
    if (props.pinned) return
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => {
      if (!hover.value && !openKey.value && !props.pinned) collapsed.value = true
    }, 800)
  }

  watch(() => props.pinned, (p) => {
    if (p) collapsed.value = false
  })
  watch(openKey, (k) => emit('menu-open', !!k))

  // Dragging the handle moves the toolbar sideways.
  let drag = null
  function startDrag (ev) {
    drag = { x: ev.clientX, start: props.offset, moved: false }
    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', endDrag)
  }
  function onDrag (ev) {
    if (!drag) return
    const dx = ev.clientX - drag.x
    if (Math.abs(dx) > 3) drag.moved = true
    const limit = window.innerWidth / 2 - 60
    emit('update:offset', Math.max(-limit, Math.min(limit, drag.start + dx)))
  }
  function endDrag () {
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', endDrag)
    // A click on the handle (no drag) unfolds or folds the toolbar.
    if (drag && !drag.moved) toggleCollapsed()
    drag = null
  }

  function onDocDown (ev) {
    if (!openKey.value || !wrapEl.value) return
    // Submenus live in their own layer outside the toolbar.
    if (wrapEl.value.contains(ev.target) || (ev.target.closest && ev.target.closest('.rd-menu'))) return
    openKey.value = null
  }

  function close () {
    openKey.value = null
  }

  onMounted(() => document.addEventListener('pointerdown', onDocDown, true))
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocDown, true)
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', endDrag)
    clearTimeout(leaveTimer)
  })

  defineExpose({ close })
</script>

<style scoped lang="scss">
.rd-toolbar-wrap {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rd-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--rd-bar-bg);
  border: 1px solid var(--rd-border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, .22);
}

.rd-btn-wrap {
  position: relative;
}

.rd-btn {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  transition: background .12s;

  &.blue {
    background: var(--rd-btn);

    &:hover, &.open {
      background: var(--rd-btn-hover);
    }
  }

  &.grey {
    background: var(--rd-btn-grey);

    &:hover, &.open {
      background: var(--rd-btn-grey-hover);
    }
  }

  &.red {
    background: #ff5252;

    &:hover {
      background: #f44336;
    }
  }

  &.active {
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .7);
  }

  .ico {
    width: 19px;
    height: 19px;
    fill: currentColor;

    &.stroke {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  }
}

.rd-btn-text {
  font-size: 13px;
  font-weight: 600;
}

.rd-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ff5252;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.rd-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;

  &.right {
    left: auto;
    right: 0;
  }
}

.rd-handle {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
  padding: 0 8px;
  background: var(--rd-bar-bg);
  border: 1px solid var(--rd-border);
  border-top: none;
  border-radius: 0 0 6px 6px;
  color: var(--rd-muted);
  cursor: grab;
  touch-action: none;
  user-select: none;

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chev {
    cursor: pointer;

    &:hover {
      color: var(--rd-text);
    }
  }
}
</style>
