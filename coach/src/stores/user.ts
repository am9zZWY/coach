import { ref, watch } from 'vue'
import { useDB } from '@/composables/useDB.ts'
import { defineStore } from 'pinia'
import type { User } from '@/models/user.ts'
import { useAPI } from "@/composables/useApi.ts";


export const useUserStore = defineStore('user', () => {

  const db = useDB()
  const apiStore = useAPI();
  const user = ref<User>(db.get('user') ?? {
    name: '',
    personalInformation: '',
    mailPersonality: '',
    token: undefined
  })
  watch(user, (updatedUser) => {
    db.set('user', updatedUser)
  }, { deep: true })

  async function login(username, password) {
    const response = await fetch(`${apiStore.api.apiURL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            'username': username,
            'password': password
        })
    });

    if (response.ok) {
        const data = await response.json();
        user.value.token = data.access_token;
        return true;
    } else {
        console.error('Login failed');
        return false;
    }
  }

  async function setOpenAIApiKey(apiKey: string) {
    if (!user.value.token) {
      console.error('User is not authenticated.');
      return;
    }

    const response = await fetch(`${apiStore.api.apiURL}/users/me/openai_api_key`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.value.token}`,
      },
      body: JSON.stringify({ api_key: apiKey }),
    });

    if (!response.ok) {
      console.error('Failed to set OpenAI API key');
    }
  }

  return {
    user,
    login,
    setOpenAIApiKey
  }
})
