import { defineStore } from 'pinia'
import { useDB } from '@/composables/useDB.ts'
import { ref, watch } from 'vue'
import type { IcsEvent, NonStandardValuesGeneric } from 'ts-ics'
import { convertIcsCalendar } from 'ts-ics'

export const useCalendarStore = defineStore('calendar', () => {
    const db = useDB()

    const calendarIcsUrls = ref<string[]>(db.get('calendar') ?? [])
    const events = ref<IcsEvent<NonStandardValuesGeneric>[]>([])

    watch(calendarIcsUrls, (urls) => {
        db.set('calendar', urls)
    }, { deep: true })

    async function fetchEvents() {
        // Clear previous events
        events.value = []
        const allEvents: IcsEvent<NonStandardValuesGeneric>[] = []

        const fetchPromises = calendarIcsUrls.value.map(async (url) => {
            try {
                const res = await fetch(url)
                if (!res.ok) {
                    throw new Error(`HTTP error ${res.status}`)
                }
                const icsText = await res.text()
                const icsCalendar = convertIcsCalendar(undefined, icsText)
                if (icsCalendar.events) {
                    allEvents.push(...icsCalendar.events)
                }
            } catch (error) {
                console.error(`Failed to fetch or parse ICS from ${url}:`, error)
            }
        })

        await Promise.all(fetchPromises)
        events.value = allEvents

        // Optionally, fetch from DAV (implement as needed)
        // Example: await davStore.appleDav.fetchCalendars()
    }

    function toString() {
        return events.value.map(event => `${event.summary} am ${event.start.date}`).join('; ')
    }

    return {
        calendarIcsUrls,
        events,
        fetchEvents,
        toString
    }
})
