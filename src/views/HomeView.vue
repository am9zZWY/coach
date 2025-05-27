<script setup lang="ts">
import { computed } from 'vue'
import { Separator } from '@/components/ui/separator'
import Tasks from '@/components/task/Tasks.vue'
import { useTaskStore } from '@/stores/task.ts'
import Summary from '@/components/Summary.vue'
import CookingSuggestion from '@/components/CookingSuggestion.vue'
import MailList from '@/components/mail/MailList.vue'
import { Card } from '@/components/ui/card'

const taskStore = useTaskStore()
const taskCount = computed(() => taskStore.flatTasks.length)
</script>

<template>
  <div class="container mx-auto">
    <!-- Main Content Area -->
    <div class="flex flex-col-reverse lg:flex-row gap-4">
      <!-- Left Column: Summary & Tasks (stacked vertically) -->
      <Summary class="lg:w-2/5" />
      <Tasks class="lg:w-3/5" />

      <!-- Right Column: Calendar -->
      <Card class="lg:w-1/2">
        <MailList />
      </Card>
    </div>

    <Separator orientation="horizontal" class="my-8 opacity-70" />

    <!-- Cooking Suggestion Section -->
    <section>
      <CookingSuggestion />
    </section>
  </div>
</template>
