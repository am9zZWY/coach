<script lang="ts" setup>
import { ScrollArea } from '@/components/ui/scroll-area'
import Mail from "@/components/mail/Mail.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMailStore } from "@/stores/mail.ts";
import { storeToRefs } from "pinia";
import { Separator } from "@/components/ui/separator";
import { ListTodo, Sparkles, TableOfContents } from "lucide-vue-next";
import { useTaskStore } from "@/stores/task.ts";
import { Input } from "@/components/ui/input";


const mailStore = useMailStore()
const { mails, filteredMails, mailFilter, selectedMails } = storeToRefs(mailStore)

const taskStore = useTaskStore()

</script>

<template>
    <Card class="shadow-md rounded-xl">
        <CardHeader>
            <CardTitle>
                Mails ({{ Object.values(mails).length }})
            </CardTitle>
            <div class="max-w-5xl flex gap-2">
                <Button @click="() => mailStore.selectAll()" variant="outline"
                        v-if="selectedMails.length !== filteredMails.length">
                    Select All
                </Button>

                <Button @click="() => mailStore.deselectAll()" variant="outline"
                        v-if="selectedMails.length > 0">
                    Deselect All ({{ selectedMails.length }})
                </Button>

                <Input v-model="mailFilter"/>
            </div>

            <template v-if="selectedMails.length > 0">
                <Separator orientation="horizontal"/>
                <div class="flex gap-2 flex-wrap">
                    <Button @click="() => mailStore.triageMails()" variant="default" size="sm">
                        <Sparkles/>
                        Triage
                    </Button>

                    <Button @click="() => mailStore.summarizeMails()" variant="default" size="sm">
                        <TableOfContents/>
                        Generate Summaries
                    </Button>

                    <Button @click="() => taskStore.generateTasksFromMail()" variant="default" size="sm">
                        <ListTodo/>
                        Generate Tasks
                    </Button>
                </div>
            </template>
        </CardHeader>
        <CardContent>
            <ScrollArea class="flex h-[32rem]">
                <div class="flex-1 flex flex-col gap-2 pt-0">
                    <TransitionGroup name="list" appear>
                        <template
                            v-for="mail of filteredMails" :key="mail.id"
                        >
                            <Mail :mail="mail" v-model:selected="mailStore.selectedMailMap[mail.id]"/>
                        </template>
                    </TransitionGroup>
                </div>
            </ScrollArea>
        </CardContent>
    </Card>
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
