<script lang="ts" setup>
import { ScrollArea } from '@/components/ui/scroll-area'
import Mail from "@/components/mail/Mail.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMailStore } from "@/stores/mail.ts";
import { storeToRefs } from "pinia";


const mailStore = useMailStore()
const { mails, selectedMails } = storeToRefs(mailStore)

</script>

<template>
    <Card class="shadow-md rounded-xl">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                Mails
            </CardTitle>
            <div class="max-w-5xl flex gap-2">
                <Button @click="() => mailStore.selectAll()" variant="outline" size="sm"
                        v-if="Object.entries(selectedMails).filter(entry => entry[1]).length !== Object.values(mails).length">
                    Select All
                </Button>

                <Button @click="() => mailStore.deselectAll()" variant="outline" size="sm"
                        v-if="Object.entries(selectedMails).some(entry => entry[1])">
                    Deselect All
                </Button>

                <Button @click="() => mailStore.triageMails()" variant="outline" size="sm">
                    Triage Mails
                </Button>

                <Button @click="() => mailStore.summarizeMails()" variant="outline" size="sm">
                    Generate Summaries
                </Button>


            </div>
        </CardHeader>
        <CardContent>
            <ScrollArea class="flex h-[32rem]">
                <div class="flex-1 flex flex-col gap-2 pt-0">
                    <TransitionGroup name="list" appear>
                        <div
                            v-for="mail of Object.values(mails)" :key="mail.id"
                            class="flex flex-col items-start gap-2 rounded-lg border-b border-border/40 border p-3 text-left text-sm transition-all hover:bg-accent"
                        >
                            <Mail :item="mail" v-model="mailStore.selectedMails[mail.id]"/>
                        </div>
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
