<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue'
import { Priority, type Task } from '@/models/task'
import { useTaskStore } from '@/stores/task' // Fixed: removed ".ts" extension
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Check, ChevronRight, WandSparkles, X } from 'lucide-vue-next'
import { useDateFormat } from '@vueuse/core'
import { Calendar } from '@/components/ui/calendar'
import { type DateValue } from 'reka-ui'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{ task: Task }>()
const { task } = toRefs(props)
const taskStore = useTaskStore()
const isCollapsed = ref(true)
const isBreakingDown = ref(false)
const editedTitle = ref('')
const isEditingTitle = ref(false)

const isOverdue = computed(() =>
  task.value.dueDate && new Date(task.value.dueDate) < new Date() && !task.value.completed
)

const dueDateInput = ref<DateValue>()
watch(dueDateInput, () => {
  if (dueDateInput.value === undefined) {
    return
  }
  task.value.dueDate = dueDateInput.value.toDate('Europe/Berlin')
})
const dueDate = computed(() => useDateFormat(task.value.dueDate, 'D. MMMM YYYY'))

const getPriorityVariant = (priority: number) => {
  switch (priority) {
    case Priority.Low:
      return 'outline'
    case Priority.Medium:
      return 'secondary'
    case Priority.High:
      return 'default'
    case Priority.Urgent:
    case Priority.Critical:
      return 'destructive'
    default:
      return 'outline'
  }
}

const toggleTaskCompletion = () => {
  const updatedTask = { ...task.value, completed: !task.value.completed }
  taskStore.update(task.value.id, updatedTask)
}

const handleBreakDownTask = () => {
  if (isBreakingDown.value) {
    return
  }
  isBreakingDown.value = true
  taskStore.llmBreakTaskIntoSubtasks(task.value).finally(() => {
    isBreakingDown.value = false
    isCollapsed.value = false
  })
}

const startEditingTitle = () => {
  editedTitle.value = task.value.title
  isEditingTitle.value = true
}

const saveEditingTitle = () => {
  if (editedTitle.value.trim()) {
    taskStore.update(task.value.id, { ...task.value, title: editedTitle.value })
  }
  isEditingTitle.value = false
}
</script>

<template>
  <div>
    <!-- Main task row -->
    <div class="flex items-center py-1 gap-3 group">
      <Checkbox
        :model-value="task.completed"
        @update:model-value="toggleTaskCompletion"
      />

      <Textarea
        v-if="isEditingTitle"
        v-model="editedTitle"
        type="text"
        placeholder="Aufgabe bearbeiten"
        class="flex-grow"
        @keyup.enter="saveEditingTitle"
        @blur="saveEditingTitle"
        autoFocus
      />
      <span
        v-else
        class="flex-grow truncate cursor-pointer"
        :class="{ 'line-through text-muted-foreground': task.completed, 'text-red-500': isOverdue }"
        @dblclick="startEditingTitle"
      >
        {{ task.title }}
      </span>

      <!-- Action buttons - desktop only -->
      <div class="hidden md:flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8"
          :disabled="isBreakingDown"
          :class="{ 'animate-pulse': isBreakingDown }"
          @click="handleBreakDownTask"
          title="Break down task"
        >
          <WandSparkles class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8"
          @click="taskStore.remove(task.id)"
          title="Delete task"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <!-- Chevron for details expansion -->
      <Button
        variant="ghost"
        size="sm"
        @click="isCollapsed = !isCollapsed"
        class="h-8 w-8"
      >
        <ChevronRight
          class="h-4 w-4 transition-transform duration-200"
          :class="{ 'rotate-90': !isCollapsed }"
        />
      </Button>
    </div>

    <!-- Details section - only visible when expanded -->
    <div v-if="!isCollapsed" class="border-t py-2 space-y-3">
      <div class="flex flex-wrap items-center justify-between">
        <!-- Mobile action buttons -->
        <div class="flex md:hidden gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8"
            :disabled="isBreakingDown"
            :class="{ 'animate-pulse': isBreakingDown }"
            @click="handleBreakDownTask"
            title="Break down task"
          >
            <WandSparkles class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8"
            @click="taskStore.remove(task.id)"
            title="Delete task"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="justify-start text-left font-normal"
              :class="{ 'text-red-500': isOverdue }"
            >
              <CalendarIcon class="mr-2 h-4 w-4" />
              {{ task.dueDate ? dueDate : 'Enddatum wählen' }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar v-model="dueDateInput" initial-focus />
          </PopoverContent>
        </Popover>
      </div>

      <div v-if="task.subTasks?.length" class="space-y-2 mt-2">
        <div class="tasks-list">
          <Task v-for="subTask in task.subTasks" :key="subTask.id" :task="subTask" />
        </div>
      </div>

      <!-- Add subtask input -->
      <div class="flex gap-2">
        <Input
          type="text"
          placeholder="Unteraufgabe hinzufügen"
          class="flex-grow"
          @keyup.enter="(e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.value.trim()) {
              taskStore.addFromTitle(target.value, task.id);
              target.value = '';
            }
          }"
        />
        <Button
          variant="outline"
          size="icon"
          @click="(e) => {
            const input = e.target.previousElementSibling as HTMLInputElement;
            if (input.value.trim()) {
              taskStore.addFromTitle(input.value, task.id);
              input.value = '';
            }
          }"
        >
          <Check class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card:hover .opacity-0 {
  @apply opacity-100;
}

.tasks-list > :not(:last-child) {
  @apply border-b;
}
</style>
