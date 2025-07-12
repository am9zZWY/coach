import { ref, watch } from 'vue'
import { useDB } from '@/composables/useDB.ts'
import { defineStore } from 'pinia'
import type { User } from '@/models/user.ts'


export const useUserStore = defineStore('user', () => {

  const db = useDB()
  const user = ref<User>(db.get('user') ?? {
    name: '',
    personalInformation: '',
    mailPersonality: ''
  })
  watch(user, (updatedUser) => {
    db.set('user', updatedUser)
  }, { deep: true })

  return {
    user
  }
})
