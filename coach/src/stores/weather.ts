import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import type { Weather, WeatherApiResponse } from '@/models/weather.ts'
import { useDB } from '@/composables/useDB.ts'

export const useWeatherStore = defineStore('weather', () => {
  const db = useDB()
  const { lastUpdated } = storeToRefs(db)

  const weather = ref<Weather>(db.get('weather') ?? {
    lastUpdated: '',
    location: '',
    temperature: 0,
    weather: '',
    weatherApiKey: ''
  })
  watch(weather, () => {
    db.set('weather', weather.value)
  }, { deep: true, immediate: true })
  watch(lastUpdated, () => {
    weather.value = db.get('weather') ?? weather.value
  })
  const fetchWeather = async () => {
    if (!weather?.value?.weatherApiKey) {
      console.error('Weather API key not found!')
      return
    }

    if (!location.value) {
      console.error('Location not found!')
      return
    }

    await fetch(`https://api.weatherapi.com/v
1/current.json?key=${weather.value.weatherApiKey}&q=${location.value}`)
      .then((response) => response.json() as Promise<WeatherApiResponse>)
      .then((data: WeatherApiResponse) => {
        // Extract weather data
        weather.value.location = `${data.location.name}, ${data.location.country}`
        weather.value.temperature = data.current.temp_c
        weather.value.weather = data.current.condition.text
        weather.value.lastUpdated = new Date(data.current.last_updated_epoch * 1000).toLocaleString().replace(',', '').slice(0, -3)
      }).catch(e => console.error(e))
  }

  const location = ref<string>(weather.value.location.split(',')[0])
  watch(location, () => {
    db.set('weather', weather.value)
    fetchWeather()
  }, { immediate: true })

  return {
    weather,
    location
  }
})
