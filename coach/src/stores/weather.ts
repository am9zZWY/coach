import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import type { Weather, WeatherApiResponse } from '@/models/weather.ts'
import { useDB } from '@/composables/useDB.ts'
import { useAPI } from "@/composables/useApi.ts";
import { useUserStore } from "@/stores/user.ts";

export const useWeatherStore = defineStore('weather', () => {
  const db = useDB()
  const apiStore = useAPI()
  const userStore = useUserStore()
  const { lastUpdated } = storeToRefs(db)

  const weather = ref<Weather>(db.get('weather') ?? {
    lastUpdated: '',
    location: '',
    temperature: 0,
    weather: '',
  })
  watch(weather, () => {
    db.set('weather', weather.value)
  }, { deep: true, immediate: true })
  watch(lastUpdated, () => {
    weather.value = db.get('weather') ?? weather.value
  })

  const fetchWeather = async () => {
    if (!apiStore.api.enableAPI || !apiStore.api.apiURL) {
        console.error('API is not enabled or URL not set.');
        return;
    }
    const token = userStore.user.token;
    if (!token) {
        console.error('User is not authenticated.');
        return;
    }

    try {
        const response = await fetch(`${apiStore.api.apiURL}/weather`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch weather data');
        }
        const data: WeatherApiResponse = await response.json();
        weather.value.location = `${data.location.name}, ${data.location.country}`
        weather.value.temperature = data.current.temp_c
        weather.value.weather = data.current.condition.text
        weather.value.lastUpdated = new Date(data.current.last_updated_epoch * 1000).toLocaleString().replace(',', '').slice(0, -3)
    } catch (e) {
        console.error(e)
    }
  }

  const location = ref<string>(weather.value.location.split(',')[0])
  watch(location, () => {
    db.set('weather', weather.value)
    fetchWeather()
  }, { immediate: true })

  async function updateWeatherSettings(apiKey: string, newLocation: string) {
      if (!apiStore.api.enableAPI || !apiStore.api.apiURL) {
          console.error('API is not enabled or URL not set.');
          return;
      }
      const token = userStore.user.token;
      if (!token) {
          console.error('User is not authenticated.');
          return;
      }
      location.value = newLocation;
      await fetch(`${apiStore.api.apiURL}/users/me/weather_settings`, {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ api_key: apiKey, location: newLocation })
      });
      await fetchWeather();
  }

  async function loadWeatherSettings() {
      if (!apiStore.api.enableAPI || !apiStore.api.apiURL) {
          return;
      }
      const token = userStore.user.token;
      if (!token) {
          return;
      }
      const response = await fetch(`${apiStore.api.apiURL}/users/me/weather_settings`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      if (response.ok) {
          const data = await response.json();
          if (data.location) {
              location.value = data.location;
          }
      }
  }

  return {
    weather,
    location,
    fetchWeather,
    updateWeatherSettings,
    loadWeatherSettings
  }
})
