<script setup lang="ts">
import { Moon, Settings, Sun, ThermometerSnowflake, ThermometerSun } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useWeatherStore } from '@/stores/weather.ts'
import { storeToRefs } from 'pinia'
import { useDateFormat, useNow, useTimestamp } from '@vueuse/core'
import { Separator } from '@/components/ui/separator'
import { useUserStore } from '@/stores/user.ts'
import { Badge } from '@/components/ui/badge'
import { useRouter } from "vue-router";

const router = useRouter()

// --- Time & Greeting ---
const timestamp = useTimestamp({ offset: 0, interval: 1000 })
const now = useNow({ interval: 1000 * 60 })
const date = computed(() => new Date(timestamp.value))
const currentTime = useDateFormat(now, 'HH:mm')
const currentDate = useDateFormat(now, 'dddd, D. MMMM YYYY, HH:mm')
const isNight = computed(() => {
    return (date.value.getHours() >= 18 || date.value.getHours() < 6)
})

const userStore = useUserStore()
const greeting = computed(() => {
    const hour = date.value.getHours()
    let g = ''
    if (isNight.value) {
        g += 'Guten Abend'
    } else if (hour >= 6 && hour < 12) {
        g += 'Guten Morgen'
    } else if (hour >= 12 && hour < 18) {
        g += 'Guten Tag'
    } else {
        g += 'Guten Abend'
    }

    if (userStore.user.name !== '') {
        g += `, ${userStore.user.name}`
    }
    return g
})

// --- Mock Weather ---
const weatherStore = useWeatherStore()
const { weather } = storeToRefs(weatherStore)
</script>

<template>
    <header>
        <nav class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <!-- Header Section with Greeting -->
            <div>
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight font-serif">
                    <router-link to="/">{{ greeting }}</router-link>
                </h1>
            </div>

            <!-- Info Section (Date, Weather, Settings) -->
            <div class="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto">
                <!-- Date Badge -->
                <Badge variant="outline" class="flex items-center gap-1 py-1.5 px-2.5">
                    <Sun v-if="!isNight" class="h-4 w-4 text-amber-500"/>
                    <Moon v-else class="h-4 w-4 text-gray-500"/>
                    <span class="hidden sm:inline">{{ currentDate }} Uhr</span>
                    <span class="sm:hidden">{{ currentTime }} Uhr</span>
                </Badge>

                <Separator orientation="vertical" class="h-6 hidden sm:block"/>

                <!-- Weather Badge -->
                <Badge variant="secondary" class="flex items-center gap-1 py-1.5 px-2.5" v-if="weather.location !== ''">
                    <ThermometerSun class="h-4 w-4 text-blue-400" v-if="weather.temperature > 10"/>
                    <ThermometerSnowflake class="h-4 w-4 text-blue-400" v-if="weather.temperature <= 10"/>
                    {{ weather.temperature }}°C
                </Badge>

                <Separator orientation="vertical" class="h-6 hidden sm:block"/>

                <!-- Settings Button -->
                <Button variant="ghost" size="sm" class="p-2" @click="router.push('/settings')">
                    <Settings class="h-5 w-5"/>
                </Button>
            </div>
        </nav>
    </header>
</template>
