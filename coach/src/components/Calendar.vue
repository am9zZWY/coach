<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalendarStore } from '@/stores/calendar.ts'
import { storeToRefs } from 'pinia'
import type { IcsEvent } from 'ts-ics'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useDateFormat } from '@vueuse/core'

// Calendar
const calenderStore = useCalendarStore()
calenderStore.fetchEvents()
const { events } = storeToRefs(calenderStore)

// Helper to get start of week (Sunday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Generate week days
const today = new Date()
const startOfWeek = ref(getStartOfWeek(today))
const weekDays = computed(() =>
  Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek.value)
    d.setDate(d.getDate() + i)
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: d.getDate(),
      month: d.getMonth() + 1,
      date: d.toISOString().slice(0, 10),
      isToday:
        d.toDateString() === today.toDateString()
    }
  })
)

function nextWeek() {
  const d = new Date(startOfWeek.value)
  d.setDate(d.getDate() + 7)
  startOfWeek.value = d
}

function lastWeek() {
  const d = new Date(startOfWeek.value)
  d.setDate(d.getDate() - 7)
  startOfWeek.value = d
}

// Time slots (e.g., 8am–6pm)
const hours = [...Array(24).keys()].map(i => `${i}:00`)
const eventMap = computed(() => {
  const map: Record<string, Record<number, IcsEvent[]>> = {}
  for (const event of events.value) {
    const evStart = new Date(event.start.date)
    const evEnd = event.end?.date ? new Date(event.end.date) : new Date()
    // For each hour the event spans, add it to the map
    let d = new Date(evStart)
    d.setMinutes(0, 0, 0)
    while (d <= evEnd) {
      const dateStr = d.toISOString().slice(0, 10)
      const hour = d.getHours()
      if (!map[dateStr]) {
        map[dateStr] = {}
      }
      if (!map[dateStr][hour]) {
        map[dateStr][hour] = []
      }
      map[dateStr][hour].push(event)
      d.setHours(d.getHours() + 1)
    }
  }
  return map
})

function eventsForSlot(dateStr: string, hourStr: string): IcsEvent[] {
  const hour = Number(hourStr.split(':')[0])
  return eventMap.value[dateStr]?.[hour] ?? []
}

// Returns true if this cell is the event's start
function isEventStart(event: IcsEvent, dateStr: string, hourStr: string) {
  const eventStart = new Date(event.start.date)
  const cellDate = new Date(dateStr + 'T' + hourStr.padStart(2, '0') + ':00')
  return (
    eventStart.toISOString().slice(0, 13) === cellDate.toISOString().slice(0, 13)
  )
}

// Returns the height in rem for the event block
function getEventBlockHeight(event: IcsEvent) {
  const start = new Date(event.start.date)
  const end = event?.end?.date ? new Date(event.end.date) : start
  const durationHours = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60))
  )
  return durationHours * 3
}

</script>


<template>
  <div class="max-w-5xl mx-auto mt-8">
    <!-- Week Header -->
    <div class="grid grid-cols-9 bg-white rounded-t-xl shadow-md overflow-hidden border-b border-gray-200">
      <div class="col-span-1 flex items-center justify-center">
        <Button variant="ghost" size="icon" @click="lastWeek">
          <ChevronLeft class="w-5 h-5" />
        </Button>
      </div>
      <div
        v-for="(day, idx) in weekDays"
        :key="day.date"
        class="text-center py-3 font-semibold transition-all duration-150"
        :class="{
          'bg-black text-white shadow-inner': day.isToday,
          'hover:bg-blue-50 cursor-pointer': !day.isToday,
        }"
      >
        <div class="uppercase text-xs tracking-widest">{{ day.label }}</div>
        <div class="text-xl font-bold">{{ day.day }}</div>
        <div class="text-xs text-gray-400">{{ day.month }}</div>
      </div>
      <div class="col-span-1 flex items-center justify-center">
        <Button variant="ghost" size="icon" @click="nextWeek">
          <ChevronRight class="w-5 h-5" />
        </Button>
      </div>
    </div>

    <!-- Time Slots -->
    <div class="max-h-[32rem] overflow-y-auto bg-white rounded-b-xl shadow-md border border-t-0 border-gray-200">
      <div class="grid grid-cols-9">
        <!-- Time Labels -->
        <div class="col-span-1 flex flex-col">
          <div
            v-for="hour in hours"
            :key="hour"
            class="h-12 flex items-center justify-end pr-3 text-xs text-gray-400 border-b border-gray-100"
          >
            {{ hour }}
          </div>
        </div>
        <!-- Days Columns -->
        <div
          v-for="(day, idx) in weekDays"
          :key="day.date"
          class="flex flex-col"
        >
          <div
            v-for="hour in hours"
            :key="hour"
            class="h-12 border-b border-l border-gray-100 relative group"
            :class="{
              'bg-blue-50': day.isToday,
            }"
          >
            <template v-for="event in eventsForSlot(day.date, hour)">
              <!-- Only render if this is the event's start hour -->
              <div
                v-if="isEventStart(event, day.date, hour)"
                class="absolute left-0 right-0 bg-blue-500 text-white text-xs rounded px-1 py-1 shadow"
                :style="{
        top: '0',
        height: `${getEventBlockHeight(event)}rem`,
        zIndex: 10,
      }"
                :title="`${event.summary}: ${useDateFormat(event.start.date, 'HH:mm').value} – ${useDateFormat(event.end?.date, 'HH:mm').value}`"
              >
                {{ event.summary }}
                <span class="text-gray-200 text-xs">{{ useDateFormat(event.start.date, 'HH:mm').value }} – {{ useDateFormat(event.end?.date, 'HH:mm').value }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
