<template>
    <div
        class="flex flex-col items-start gap-2 rounded-lg border-b border-border/40 border p-2
                            text-left text-sm transition-all group relative hover:bg-muted/50"
        :class="{ 'bg-muted/30': selected }"
    >
        <!-- Mail item container -->
        <div class="flex items-start gap-3 p-2">
            <!-- Selection checkbox -->
            <div
                @click.stop="toggleSelection"
                class="flex items-center justify-center w-5 h-5 mt-1 opacity-60 hover:opacity-100 transition-opacity"
            >
                <Square
                    v-if="!selected"
                    class="text-muted-foreground hover:text-foreground transition-colors"
                />
                <SquareCheck
                    v-else
                    class="text-primary"
                />
            </div>

            <!-- Mail content -->
            <div class="flex-1 min-w-0">
                <!-- Header row -->
                <div class="flex items-center justify-between gap-3 mb-1">
                    <div class="flex items-center gap-2 min-w-0">
                        <span
                            class="font-semibold text-sm truncate"
                            :class="mail.read ? 'text-foreground' : 'text-foreground font-bold'"
                        >
                          {{ mail.from }}
                        </span>
                        <!-- Unread indicator -->
                        <div
                            v-if="!mail.read"
                            class="flex-shrink-0 w-2 h-2 rounded-full bg-primary"
                            aria-label="Unread"
                        />
                    </div>

                    <!-- Timestamp -->
                    <time
                        class="text-xs text-muted-foreground flex-shrink-0"
                        :class="{ 'text-foreground': selected }"
                        :datetime="mail.date"
                    >
                        {{ formatDistanceToNow(new Date(mail.date), { addSuffix: true }) }}
                    </time>
                </div>

                <!-- Subject -->
                <div
                    class="text-sm mb-2 truncate"
                    :class="mail.read ? 'text-foreground' : 'text-foreground font-semibold'"
                >
                    {{ mail.subject }}
                </div>

                <div class="flex items-center gap-2 my-2">
                    <Badge v-for="label of mail.labels" :key="label">
                        {{ label }}
                    </Badge>
                </div>

                <div v-if="mail.summary" class="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic my-2">
                    "{{ mail.summary }}"
                </div>

                <div class="max-w-5xl flex gap-2 my-2">
                    <!-- Action button row -->
                    <Button @click="() => mailStore.generateReply(mail.id)" variant="outline" size="icon">
                        <Reply/>
                    </Button>

                    <Button @click="() => mailStore.triage(mail.id)" variant="outline" size="icon">
                        <Sparkles/>
                    </Button>

                    <Button @click="() => mailStore.summarize(mail.id)" variant="outline" size="icon">
                        <TableOfContents/>
                    </Button>

                    <Separator orientation="vertical"/>

                    <Button variant="outline" size="icon" @click="expanded = !expanded">
                        <ChevronDown
                            v-if="!expanded"
                            :size="14"
                            class="text-muted-foreground"
                        />
                        <ChevronUp
                            v-else
                            :size="14"
                            class="text-muted-foreground"
                        />
                    </Button>
                </div>

                <!-- Preview text (when collapsed) -->
                <div
                    v-if="!expanded"
                    class="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                >
                    {{ getPreviewText(mail.body) }}
                </div>
            </div>

            <!-- Expand/collapse indicator -->
            <div
                class="flex items-center justify-center w-5 h-5 mt-1 opacity-0 group-hover:opacity-60 transition-opacity">
                <ChevronDown
                    v-if="!expanded"
                    :size="14"
                    class="text-muted-foreground"
                />
                <ChevronUp
                    v-else
                    :size="14"
                    class="text-muted-foreground"
                />
            </div>
        </div>

        <!-- Expanded content -->
        <Collapsible v-model:open="expanded">
            <CollapsibleContent>
                <div class="px-4 pb-4 ml-8">
                    <Separator class="mb-4"/>
                    <div
                        class="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line break-all"
                    >
                        {{ mail.body }}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <div class="flex items-start gap-2 p-2">
            <div class="px-4" v-if="mail.reply || showReply">
                <Textarea type="text" placeholder="E-Mail beantworten" v-model="mail.reply" rows="5" cols="400"
                          class="flex-grow"/>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { MailType } from "@/models/mailType";
import { ref, toRefs } from "vue";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, Reply, Sparkles, Square, SquareCheck, TableOfContents } from "lucide-vue-next";
import { Collapsible, CollapsibleContent, } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMailStore } from "@/stores/mail.ts";

interface MailProps {
    mail: MailType
}

const mailStore = useMailStore()

const props = defineProps<MailProps>();
const selected = defineModel('selected')

const { mail } = toRefs(props);
const expanded = ref(false);
const showReply = ref(false);

const toggleSelection = () => {
    selected.value = !selected.value
};
const getPreviewText = (body: string): string => {
    const cleanText = body.replace(/<[^>]*>/g, '').trim();
    return cleanText.length > 200 ? cleanText.substring(0, 200) + '...' : cleanText;
};

const toggleReply = () => {
    showReply.value = !showReply.value;
}
</script>
