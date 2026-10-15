<template>
  <div>
    <el-card shadow="hover" class="webclient-connect">
      <template v-if="enabled">
        <div class="hint">{{ T('RemoteConnectHint') }}</div>
        <el-form inline label-width="auto" @submit.prevent="open">
          <el-form-item :label="T('RemoteDeviceId')">
            <el-input v-model="id" clearable autofocus @keyup.enter="open" style="width: 240px"/>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="open" :disabled="!validId">{{ T('RemoteConnect') }}</el-button>
          </el-form-item>
        </el-form>
      </template>
      <div v-else class="hint">{{ T('RemoteDisabled') }}</div>
    </el-card>
  </div>
</template>

<script setup>
  import { computed, ref } from 'vue'
  import { T } from '@/utils/i18n'
  import { useAppStore } from '@/store/app'
  import { connectByWeb } from '@/utils/peer'

  const appStore = useAppStore()
  const enabled = computed(() => appStore.setting.appConfig.web_client === 1)
  const id = ref('')
  const validId = computed(() => /^[0-9A-Za-z_\-@.]{1,100}$/.test(id.value.replace(/\s/g, '')))

  function open () {
    if (validId.value) connectByWeb(id.value)
  }
</script>

<style scoped lang="scss">
.webclient-connect {
  .hint {
    margin-bottom: 16px;
    color: var(--el-text-color-regular);
  }
}
</style>
