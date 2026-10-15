<template>
  <div class="rd-menu" @pointerdown.stop @click.stop>
    <template v-for="(it, i) in items" :key="i">
      <div v-if="it.type === 'divider'" class="rd-divider"></div>
      <div v-else-if="it.type === 'label'" class="rd-label">{{ it.label }}</div>
      <div v-else-if="it.type === 'slider'" class="rd-slider">
        <div class="rd-slider-head">
          <span>{{ it.label }}</span><span class="rd-value">{{ it.value }}{{ it.suffix || '' }}</span>
        </div>
        <input type="range" :min="it.min" :max="it.max" :step="it.step || 1" :value="it.value"
               @input="it.onInput && it.onInput(Number($event.target.value))"
               @change="it.onChange && it.onChange(Number($event.target.value))">
      </div>
      <div v-else-if="it.type === 'submenu'" class="rd-item rd-sub" :class="{ disabled: it.disabled, open: openSub === i }"
           @mouseenter="showSub(i, $event)" @mouseleave="hideSoon" @click="showSub(i, $event)">
        <span class="rd-mark"></span>
        <span class="rd-text">{{ it.label }}</span>
        <span class="rd-arrow">›</span>
        <!-- In a layer of its own: inside the scrolling menu it would be cut off. -->
        <Teleport to="#rd-menu-layer">
          <RemoteMenu v-if="openSub === i && !it.disabled" class="rd-child" :style="subStyle" :items="it.children"
                      @mouseenter="cancelHide" @mouseleave="hideSoon" @close="$emit('close')"/>
        </Teleport>
      </div>
      <div v-else class="rd-item" :class="{ disabled: it.disabled }" :title="it.hint || ''" @click="pick(it)">
        <span class="rd-mark">
          <svg v-if="it.type === 'check' && it.checked" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span v-else-if="it.type === 'radio'" class="rd-radio" :class="{ on: it.checked }"></span>
        </span>
        <span class="rd-text">{{ it.label }}</span>
        <span v-if="it.shortcut" class="rd-shortcut">{{ it.shortcut }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
  import { onBeforeUnmount, ref } from 'vue'

  defineOptions({ name: 'RemoteMenu' })
  defineProps({ items: { type: Array, required: true } })
  const emit = defineEmits(['close'])
  const openSub = ref(null)
  const subStyle = ref({})
  let hideTimer = null

  function showSub (i, ev) {
    cancelHide()
    const r = ev.currentTarget.getBoundingClientRect()
    const width = 300 // room for the widest submenu
    const left = r.right + width > window.innerWidth ? Math.max(4, r.left - width) : r.right
    subStyle.value = { left: left + 'px', top: Math.max(4, Math.min(r.top - 9, window.innerHeight - 120)) + 'px' }
    openSub.value = i
  }

  function cancelHide () {
    clearTimeout(hideTimer)
  }

  function hideSoon () {
    cancelHide()
    hideTimer = setTimeout(() => { openSub.value = null }, 250)
  }

  onBeforeUnmount(cancelHide)

  function pick (it) {
    if (it.disabled || !it.onClick) return
    it.onClick()
    // Actions close the menu; switches stay open, as in the app.
    if (it.type === 'action' || !it.type) emit('close')
  }
</script>

<style scoped lang="scss">
.rd-menu {
  min-width: 220px;
  max-width: 340px;
  padding: 8px 5px;
  background: var(--rd-menu-bg);
  color: var(--rd-text);
  border: 1px solid var(--rd-border);
  border-radius: 6px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, .18);
  font-size: 13.5px;
  user-select: none;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}

.rd-item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px 0 4px;
  border-radius: 3px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: var(--rd-hover);
  }

  &.disabled {
    opacity: .45;
    cursor: default;

    &:hover {
      background: transparent;
    }
  }
}

.rd-mark {
  width: 22px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--rd-accent);

  svg {
    width: 16px;
    height: 16px;
  }
}

.rd-radio {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid var(--rd-muted);

  &.on {
    border-color: var(--rd-accent);
    background: radial-gradient(circle, var(--rd-accent) 0 3px, transparent 3.5px);
  }
}

.rd-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

.rd-shortcut {
  color: var(--rd-muted);
  font-size: 12px;
}

.rd-arrow {
  color: var(--rd-muted);
  font-size: 16px;
}

.rd-child {
  position: fixed;
  z-index: 30;
  min-width: 240px;
  max-height: calc(100vh - 16px);
}

.rd-sub.open {
  background: var(--rd-hover);
}

.rd-divider {
  height: 1px;
  margin: 6px 6px;
  background: var(--rd-border);
}

.rd-label {
  padding: 6px 10px 2px 26px;
  color: var(--rd-muted);
  font-size: 12px;
}

.rd-slider {
  padding: 4px 12px 8px 26px;

  .rd-slider-head {
    display: flex;
    justify-content: space-between;
    color: var(--rd-muted);
    font-size: 12px;
  }

  .rd-value {
    color: var(--rd-text);
  }

  input {
    width: 100%;
    accent-color: var(--rd-accent);
  }
}
</style>
