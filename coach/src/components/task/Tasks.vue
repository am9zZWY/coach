<script setup lang="ts">
import { useTaskStore } from '@/stores/task'
import { computed } from 'vue'
import Task from '@/components/task/Task.vue'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ListTodo } from 'lucide-vue-next'
import { useDB } from '@/composables/useDB.ts'
import { useDateFormat } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const taskStore = useTaskStore()
const { taskSuggestions, tasks } = storeToRefs(taskStore)
const taskCount = computed(() => taskStore.flatTasks.length)

const db = useDB()
const { lastUpdated } = storeToRefs(db)
const lastUpdatedDate = computed(() => useDateFormat(lastUpdated, 'D. MMMM YYYY, HH:mm'))
</script>


<template>
    <Card class="shadow-md rounded-xl">
        <CardHeader>
            <div>
                <CardTitle class="flex items-center gap-2">
                    <ListTodo/>
                    Plane deinen Tag
                </CardTitle>
                <CardDescription>Du hast {{ taskCount }} {{ taskCount === 1 ? 'Aufgabe' : 'Aufgaben' }}
                </CardDescription>
            </div>
            <div v-if="taskSuggestions" class="flex justify-start items-center flex-wrap gap-2">
                <template v-for="suggestion in taskSuggestions">
                    <Badge class="cursor-pointer" @click="taskStore.addFromTitle(suggestion)" variant="outline">
                        {{ suggestion }}
                    </Badge>
                </template>

                <Separator orientation="horizontal"/>
            </div>
        </CardHeader>
        <CardContent>
            <ScrollArea class="flex" v-if="tasks && tasks.length > 0">
                <div class="flex-1 flex flex-col gap-2 pt-0">
                    <TransitionGroup name="list" appear>
                        <template v-for="task in tasks" :key="task.id">
                            <Task :task="task"/>
                        </template>
                    </TransitionGroup>
                </div>
            </ScrollArea>

            <!-- Add new task button -->
            <Input
                type="text"
                placeholder="Füge eine neue Aufgabe hinzu"
                @keyup.enter="taskStore.addFromTitle($event.target.value); $event.target.value = ''"
                class="mt-4"
            />
        </CardContent>
        <CardFooter>
      <span class="text-xs">
        Zuletzt aktualisiert am {{ lastUpdatedDate }}
      </span>
        </CardFooter>
    </Card>
</template>

<style scoped>
.tasks-list > :not(:last-child) {
    @apply border-b;
}
</style>
