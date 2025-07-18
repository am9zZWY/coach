<script lang="ts" setup>
import { onMounted } from 'vue'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquareQuote, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useJeanPhilippe } from "@/composables/useJeanPhilippe.ts";
import { useWeatherStore } from "@/stores/weather.ts";

const { summary, loading, currentDate, generateSummary } = useJeanPhilippe()
const weatherStore = useWeatherStore()

onMounted(() => {
    generateSummary()
})
</script>

<template>
    <Card class="shadow-md rounded-xl">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <MessageSquareQuote/>
                Une Note von Jean-Philippe
            </CardTitle>
            <CardDescription class="flex items-center justify-between flex-wrap gap-2 sm:gap-4 w-full md:w-auto">
                <div class="flex flex-wrap gap-2">
                    <Badge variant="outline">{{ currentDate }}</Badge>
                    <Badge variant="secondary" v-if="weatherStore.weather.location">{{
                            weatherStore.weather.temperature
                        }}°C in {{ weatherStore.weather.location }}
                    </Badge>
                </div>
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div v-if="loading" class="flex justify-center items-center py-8">
                <span class="loader"/>
                <span class="font-medium">Jean-Philippe denkt...</span>
            </div>
            <div v-else-if="summary" class="whitespace-pre-line text-base leading-relaxed">
                <div class="prose dark:prose-invert max-w-none font-serif" v-html="summary"></div>
            </div>
        </CardContent>
        <CardFooter>
            <Button @click="() => generateSummary(true)" variant="outline" size="sm">
                <RotateCcw/>
            </Button>
        </CardFooter>
    </Card>
</template>
