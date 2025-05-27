// noinspection t

import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Priority, type Task } from '@/models/task'
import { v4 as uuidv4 } from 'uuid'
import { useAssistantStore } from '@/stores/assistant.ts'
import { useDB } from '@/composables/useDB.ts'
import { useCalendarStore } from '@/stores/calendar.ts'

export const useTaskStore = defineStore('tasks', () => {
    const db = useDB()
    const { lastUpdated } = storeToRefs(db)

    const gptStore = useAssistantStore()
    const calendarStore = useCalendarStore()

    const tasks = ref<Task[]>(db.get('tasks') ?? [])
    watch(tasks, () => {
      db.set('tasks', tasks.value)
    }, { deep: true })
    watch(lastUpdated, () => {
      tasks.value = db.get('tasks') ?? []
    })

    const flatTasks = computed(() => getAllTasksR(tasks.value))

    function getAllTasksR(base: Task[]): Task[] {
      return [...base, ...base.flatMap(task => getAllTasksR(task.subTasks))]
    }

    function get(taskId?: string): Task | undefined {
      if (!taskId) {
        return undefined
      }

      function walk(list: Task[]): Task | undefined {
        let task: Task | undefined = undefined
        for (const t of list) {
          if (t.id === taskId) {
            task = t
            break
          }
          task ??= walk(t.subTasks)
        }
        return task
      }

      return walk(tasks.value)
    }

    function add(task: Omit<Task, 'id' | 'subTasks' | 'createdDate' | 'type'> & {
      subTasks?: Task[]
    }, parentId?: string): string {
      const newTask: Task = {
        id: uuidv4(),
        ...task,
        type: 'Task',
        subTasks: task.subTasks || [],
        createdDate: new Date(),
        parentId: parentId ?? undefined
      }

      if (parentId) {
        const parentTask = get(parentId)
        parentTask?.subTasks.push(newTask)
        update(parentId, { ...parentTask })
      } else {
        tasks.value.push(newTask)
      }
      return newTask.id
    }

    function addFromTitle(title: string, parentId?: string) {
      return add({
        title: title,
        completed: false,
        priority: Priority.Medium
      }, parentId)
    }

    function remove(taskId: string): boolean {
      const initialLength = tasks.value.length
      tasks.value = tasks.value.filter(task => task.id !== taskId)
      if (tasks.value.length < initialLength) {
        return true
      }

      const task = get(taskId)
      if (task === undefined || task === null) {
        console.warn('Task not found')
        return false
      }
      const parentTask = get(task.parentId!)
      if (!parentTask) {
        return false
      }
      const parentSubTasks = parentTask?.subTasks.filter(task => task.id !== taskId)
      return update(task.parentId!, { ...parentTask, subTasks: parentSubTasks })
    }

    function update(taskId: string, updates: Partial<Omit<Task, 'id'>>): boolean {
      function walk(list: Task[]): boolean {
        for (const t of list) {
          if (t.id === taskId) {
            Object.assign(t, updates)
            return true
          }
          if (walk(t.subTasks)) {
            return true
          }
        }
        return false
      }

      return walk(tasks.value)
    }

    function sort(sortBy: 'priority' | 'dueDate' | 'createdDate', ascending = true): void {
      tasks.value.sort((a, b) => {
        if (sortBy === 'priority') {
          return ascending ? a.priority - b.priority : b.priority - a.priority
        } else if (sortBy === 'dueDate') {
          if (!a.dueDate) {
            return ascending ? 1 : -1
          }
          if (!b.dueDate) {
            return ascending ? -1 : 1
          }
          return ascending
            ? a.dueDate.getTime() - b.dueDate.getTime()
            : b.dueDate.getTime() - a.dueDate.getTime()
        } else { // createdDate
          return ascending
            ? a.createdDate.getTime() - b.createdDate.getTime()
            : b.createdDate.getTime() - a.createdDate.getTime()
        }
      })
    }

    async function llmBreakTaskIntoSubtasks(
      task: Task
    ) {
      const systemPrompt = 'Break tasks into up to 5 smaller subtasks. You must ONLY return a valid JSON array of strings. Answer in the language of the user input. Example input: "Clean house". Example output format: ["Clean kitchen", "Mop kitchen", "Mop the dog", "Vacuum living room"]. DO NOT include any other text or explanations. DO NOT use markdown formatting. ONLY RETURN THE JSON ARRAY.'
      const userPrompt = `Task Title: ${task?.title}`

      const output = ref('')
      try {
        output.value = await gptStore.run({ systemPrompt, userPrompt })
        output.value = output.value
          // Remove empty lines
          .replace(/^\s*[\r\n]/gm, '')
          // Remove opening code block marker
          .replace(/^```json\s*/m, '')
          // Remove closing code block marker
          .replace(/```\s*$/m, '')
          // Remove backticks at start of lines
          .replace(/^`/gm, '')
          // Remove leading quote before the opening bracket
          .replace(/^"(\[)/, '$1')
          // Remove trailing backtick and quote
          .replace(/(])[\s`"]*$/, '$1')
        console.debug('Generated text:', output.value)

        // Parse the generated text
        const parsedResult = JSON.parse(output.value) as string[]
        // Update the task with the generated subtasks
        parsedResult.forEach((subTask: string) => {
          add({
            title: subTask,
            completed: false,
            dueDate: task.dueDate,
            priority: 2,
            parentId: task.id
          }, task.id)
        })
      } catch (e: any) {
        console.error('Generation failed:', e)
      }
    }

    async function llmGenerateTasksFromCalendar() {
      const systemPrompt = 'Based on calendar events you should create 2-5 tasks that prepare the user for upcoming events. You must ONLY return a valid JSON array of strings. Answer in the language of the user userPrompt. Example userPrompt: "Meeting bzgl Thesis mit Jonas". Example output format: ["Todos ", "Computer laden"]. DO NOT include any other text or explanations. DO NOT use markdown formatting. ONLY RETURN THE JSON ARRAY.'
      const userPrompt = calendarStore.toString()

      const output = ref('')
      try {
        output.value = await gptStore.run({ systemPrompt, userPrompt })
        output.value = output.value
          // Remove empty lines
          .replace(/^\s*[\r\n]/gm, '')
          // Remove opening code block marker
          .replace(/^```json\s*/m, '')
          // Remove closing code block marker
          .replace(/```\s*$/m, '')
          // Remove backticks at start of lines
          .replace(/^`/gm, '')
          // Remove leading quote before the opening bracket
          .replace(/^"(\[)/, '$1')
          // Remove trailing backtick and quote
          .replace(/(])[\s`"]*$/, '$1')
        console.debug('Generated text:', output.value)

        // Parse the generated text
        const parsedResult = JSON.parse(output.value)
        // Update the task with the generated subtasks
        parsedResult.forEach((subtask: string) => addFromTitle(subtask))
      } catch (e: any) {
        console.error('Generation failed:', e)
      }
    }

    function moveSubtaskToMain(subtaskId: string): boolean {
      // Find which task contains this subtask
      for (const task of tasks.value) {
        const subtaskIndex = task.subTasks.findIndex(st => st.id === subtaskId)
        if (subtaskIndex !== -1) {
          // Get the subtask
          const subtask = task.subTasks[subtaskIndex]
          // Remove from subtasks
          task.subTasks.splice(subtaskIndex, 1)
          // Add to main tasks
          tasks.value.push(subtask)
          return true
        }
      }
      return false
    }

    function toString(): string {
      return flatTasks.value.map(task =>
        [
          `Task Title: ${task.title}`,
          `Due Date: ${task.dueDate ?? 'no deadline'}`,
          `Parent Task: ${get(task.parentId)?.title ?? 'none'}`,
          `Completed: ${task.completed ? 'yes' : 'no'}`
        ].join('\n')
      ).join('\n\n---\n\n')
    }


    return {
      tasks,
      flatTasks,
      toString,
      add,
      addFromTitle,
      remove,
      update,
      sort,
      llmBreakTaskIntoSubtasks,
      llmGenerateTasksFromCalendar
    }
  }
)
