// noinspection t

import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { Priority, type Task } from '@/models/task'
import { v4 as uuidv4 } from 'uuid'
import { useAssistantStore } from '@/stores/assistant.ts'
import { useDB } from '@/composables/useDB.ts'
import { useCalendarStore } from '@/stores/calendar.ts'
import { useMailStore } from "@/stores/mail.ts";

export const useTaskStore = defineStore('tasks', () => {
        const db = useDB()
        const { lastUpdated } = storeToRefs(db)

        const assistantStore = useAssistantStore()
        const calendarStore = useCalendarStore()
        const mailStore = useMailStore()

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

        async function breakTaskIntoSubtasks(
            task: Task
        ) {
            const systemPrompt = `You are a task decomposition assistant. Your job is to break down a main task into actionable subtasks.

STRICT REQUIREMENTS:
- Output EXACTLY a JSON array of strings
- Create 3-5 specific, actionable subtasks
- Each subtask must be concrete and measurable
- Maintain the same language as the input
- Return ONLY the JSON array - no explanations, no markdown, no additional text

RESPONSE FORMAT: ["subtask 1", "subtask 2", "subtask 3"]

EXAMPLES:
Input: "Prepare presentation for Monday"
Output: ["Research topic and gather data", "Create slide outline", "Design slides with visuals", "Practice presentation", "Prepare Q&A responses"]

Input: "Organizar fiesta de cumpleaños"
Output: ["Hacer lista de invitados", "Comprar decoraciones", "Ordenar pastel", "Preparar comida y bebidas", "Enviar invitaciones"]`
            const userPrompt = `Break down this task into subtasks: "${task?.title}"`

            const output = ref('')
            try {
                output.value = await assistantStore.run({ systemPrompt, userPrompt })
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

        async function generateTaskFromCalendar() {
            const systemPrompt = `You are a calendar-based task generator. Analyze calendar events and create preparatory tasks.

STRICT REQUIREMENTS:
- Output EXACTLY a JSON array of strings
- Generate 2-5 specific preparation tasks
- Tasks must be actionable and relevant to the events
- Consider timing, location, and event type
- Maintain the same language as the calendar events
- Return ONLY the JSON array - no explanations, no markdown, no additional text

TASK GENERATION RULES:
- For meetings: preparation materials, agenda items, travel time
- For deadlines: completion steps, review time, submission prep
- For appointments: documents needed, travel arrangements, confirmations
- For events: outfit/attire, gifts, RSVPs

RESPONSE FORMAT: ["task 1", "task 2", "task 3"]

EXAMPLES:
Input: "Team meeting tomorrow at 2 PM"
Output: ["Review meeting agenda and previous notes", "Prepare status update on current projects", "Test video conference setup 15 minutes early"]

Input: "Dentist appointment Friday 10 AM"
Output: ["Confirm appointment 24 hours before", "Prepare insurance card and ID", "Leave 30 minutes early for traffic"]`

            const userPrompt = `Generate preparation tasks for these calendar events:\n${calendarStore.toString()}`


            const output = ref('')
            try {
                output.value = await assistantStore.run({ systemPrompt, userPrompt })
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

        async function generateTasksFromMail() {
            if (mailStore.selectedMails.length === 0) {
                console.error('No mails for task generation selected.')
                return;
            }

            const systemPrompt = `You are an email-to-task converter. Analyze emails and extract actionable tasks.

STRICT REQUIREMENTS:
- Output EXACTLY a JSON array of strings
- Generate 2-5 specific, actionable tasks from the emails
- Focus on requests, deadlines, and action items mentioned
- Prioritize urgent or time-sensitive items
- Maintain the same language as the emails
- Return ONLY the JSON array - no explanations, no markdown, no additional text

EMAIL ANALYSIS RULES:
- Look for action verbs (send, review, complete, prepare, schedule)
- Identify deadlines and time constraints
- Extract specific requests or questions needing responses
- Note follow-up items or commitments made
- Consider attachments that need review

RESPONSE FORMAT: ["task 1", "task 2", "task 3"]

EXAMPLES:
Input: "Please review the attached proposal and send feedback by Friday"
Output: ["Review proposal document", "Write feedback on proposal", "Send proposal feedback by Friday"]

Input: "Can we schedule a call next week to discuss the project timeline?"
Output: ["Check calendar availability for next week", "Schedule project timeline discussion call", "Prepare project timeline overview for call"]`

            const userPrompt = `Extract actionable tasks from these emails:\n${mailStore.selectedMails.map(mail => {
                return `
EMAIL_ID: ${mail.id}
FROM: ${mail.from}
SUBJECT: ${mail.subject}
CONTENT: ${mail.body}
---`
            }).join('\n')}`


            const output = ref('')
            try {
                output.value = await assistantStore.run({ systemPrompt, userPrompt: userPrompt })
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
            breakTaskIntoSubtasks,
            generateTaskFromCalendar,
            generateTasksFromMail
        }
    }
)
