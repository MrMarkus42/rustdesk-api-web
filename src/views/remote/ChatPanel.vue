<template>
  <div class="rd-chat" @pointerdown.stop @keydown.stop @keyup.stop>
    <div class="rd-chat-head">
      <span>{{ T('RemoteTextChat') }} – {{ peerName }}</span>
      <button class="rd-x" @click="$emit('close')" :title="T('Close')">×</button>
    </div>
    <div class="rd-chat-list" ref="listEl">
      <div v-if="!messages.length" class="rd-empty">{{ T('RemoteChatEmpty') }}</div>
      <div v-for="(m, i) in messages" :key="i" class="rd-msg" :class="m.mine ? 'mine' : 'theirs'">
        <div class="rd-bubble">{{ m.text }}</div>
        <div class="rd-time">{{ m.time }}</div>
      </div>
    </div>
    <div class="rd-chat-input">
      <textarea ref="inputEl" v-model="text" rows="2" maxlength="4000" :placeholder="T('RemoteChatPlaceholder')"
                @keydown.enter.exact.prevent="send"></textarea>
      <button class="rd-send" :disabled="!text.trim()" @click="send">{{ T('RemoteSend') }}</button>
    </div>
  </div>
</template>

<script setup>
  import { nextTick, onMounted, ref, watch } from 'vue'
  import { T } from '@/utils/i18n'

  const props = defineProps({
    messages: { type: Array, required: true },
    peerName: { type: String, default: '' },
  })
  const emit = defineEmits(['send', 'close'])
  const text = ref('')
  const listEl = ref(null)
  const inputEl = ref(null)

  function send () {
    const t = text.value.trim()
    if (!t) return
    emit('send', t)
    text.value = ''
  }

  function scrollDown () {
    nextTick(() => {
      if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
    })
  }

  watch(() => props.messages.length, scrollDown)
  onMounted(() => {
    scrollDown()
    inputEl.value && inputEl.value.focus()
  })
</script>

<style scoped lang="scss">
.rd-chat {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 15;
  width: 320px;
  height: 380px;
  display: flex;
  flex-direction: column;
  background: var(--rd-menu-bg);
  color: var(--rd-text);
  border: 1px solid var(--rd-border);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .3);
  font-size: 13.5px;
}

.rd-chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--rd-border);
  font-weight: 600;
}

.rd-x {
  border: none;
  background: transparent;
  color: var(--rd-muted);
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.rd-chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rd-empty {
  color: var(--rd-muted);
  text-align: center;
  margin-top: 40px;
}

.rd-msg {
  display: flex;
  flex-direction: column;
  max-width: 85%;

  &.mine {
    align-self: flex-end;
    align-items: flex-end;

    .rd-bubble {
      background: var(--rd-btn);
      color: #fff;
    }
  }

  &.theirs {
    align-self: flex-start;

    .rd-bubble {
      background: var(--rd-hover);
    }
  }
}

.rd-bubble {
  padding: 6px 10px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.rd-time {
  font-size: 11px;
  color: var(--rd-muted);
  margin-top: 2px;
}

.rd-chat-input {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--rd-border);

  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--rd-border);
    border-radius: 6px;
    padding: 6px 8px;
    background: var(--rd-input-bg);
    color: var(--rd-text);
    font: inherit;
  }
}

.rd-send {
  border: none;
  border-radius: 6px;
  padding: 0 12px;
  background: var(--rd-btn);
  color: #fff;
  cursor: pointer;

  &:disabled {
    opacity: .5;
    cursor: default;
  }
}
</style>
