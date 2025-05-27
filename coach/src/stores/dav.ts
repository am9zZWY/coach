import { defineStore } from 'pinia'
import { createDAVClient } from 'tsdav'
import { ref, watch } from 'vue'
import { useDB } from '@/composables/useDB.ts'

export const useDavStore = defineStore('dav', () => {
  const db = useDB()

  const appleCredentials = ref<{
    appleId: string,
    appleAppPassword: string
  }>(db.get('appleCredentials') as {
    appleId: string,
    appleAppPassword: string
  } ?? { appleId: '', appleAppPassword: '' })
  watch(appleCredentials, () => {
    db.set('appleCredentials', appleCredentials.value)
    init()
  }, { deep: true })
  const appleDav = ref()

  function init() {
    // Initialize Apple DAV
    if (appleCredentials.value.appleId !== '' && appleCredentials.value.appleAppPassword !== '') {
      createDAVClient({
        serverUrl: 'https://caldav.icloud.com',
        credentials: {
          username: appleCredentials.value.appleId,
          password: appleCredentials.value.appleAppPassword
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
      }).then((res) => {
        appleDav.value = res
      })
    }
  }

  init()

  return {
    appleDav,
    appleCredentials
  }
})
