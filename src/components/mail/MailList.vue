<script lang="ts" setup>
import { cn } from '@/lib/utils'
import { ref } from 'vue'
import type { Mail } from '@/models/mail.ts'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'

const selectedMail = defineModel<string>('selectedMail', { required: false })

function getBadgeVariantFromLabel(label: string) {
  if (['work'].includes(label.toLowerCase())) {
    return 'default'
  }

  if (['personal'].includes(label.toLowerCase())) {
    return 'outline'
  }

  return 'secondary'
}

// Fetch from API
const mails = ref<Mail[]>([])
setInterval(() => {
  const headers = new Headers()
  headers.set('Authorization', 'Basic ' + btoa('user' + ':' + 'password'))

  fetch('http://localhost:8080/mail', {
    headers
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      return res.json()
    })
    .then((response) => {
      mails.value = response
    })
    .catch((error) => {
      console.error('Error fetching mails:', error)
    })

}, 1000)
</script>

<template>
  <ScrollArea class="flex h-[32rem]">
    <div class="flex-1 flex flex-col gap-2 p-4 pt-0">
      <TransitionGroup name="list" appear>
        <button
          v-for="(item, idx) of mails"
          :key="idx"
          :class="cn(
            'flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent',
            selectedMail === item.id && 'bg-muted',
          )"
          @click="selectedMail = item.id"
        >
          <div class="flex w-full flex-col gap-1">
            <div class="flex items-center">
              <div class="flex items-center gap-2">
                <div class="font-semibold">
                  {{ item.from }}
                </div>
                <span v-if="!item.read" class="flex h-2 w-2 rounded-full bg-blue-600" />
              </div>
              <div
                :class="cn(
                  'ml-auto text-xs',
                  selectedMail === item.id
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )"
              >
                {{ formatDistanceToNow(new Date(item.receivedAt), { addSuffix: true }) }}
              </div>
            </div>

            <div class="text-xs font-medium">
              {{ item.subject }}
            </div>
          </div>
          <div class="line-clamp-2 text-xs text-muted-foreground">
            {{ item.message.substring(0, 300) }}
          </div>
          <div class="flex items-center gap-2">
            <!-- <Badge v-for="label of item.labels" :key="label" :variant="getBadgeVariantFromLabel(label)">
              {{ label }}
            </Badge> -->
          </div>
        </button>
      </TransitionGroup>
    </div>
  </ScrollArea>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(15px);
}

.list-leave-active {
  position: absolute;
}
</style>
