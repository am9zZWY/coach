<template>
    <div
        class="group relative transition-colors hover:bg-muted/50"
        :class="{ 'bg-muted/30': modelValue }"
    >
        <!-- Mail item container -->
        <div class="flex items-start gap-3 p-4">
            <!-- Selection checkbox -->
            <div
                @click.stop="toggleSelection"
                class="flex items-center justify-center w-5 h-5 mt-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            >
                <Square
                    v-if="!modelValue"
                    class="text-muted-foreground hover:text-foreground transition-colors"
                />
                <SquareCheck
                    v-else
                    class="text-primary"
                />
            </div>

            <!-- Mail content -->
            <div
                @click="expanded = !expanded"
                class="flex-1 cursor-pointer min-w-0"
            >
                <!-- Header row -->
                <div class="flex items-center justify-between gap-3 mb-1">
                    <div class="flex items-center gap-2 min-w-0">
                        <span
                            class="font-semibold text-sm truncate"
                            :class="item.read ? 'text-foreground' : 'text-foreground font-bold'"
                        >
                          {{ item.from }}
                        </span>
                        <!-- Unread indicator -->
                        <div
                            v-if="!item.read"
                            class="flex-shrink-0 w-2 h-2 rounded-full bg-primary"
                            aria-label="Unread"
                        />
                    </div>

                    <!-- Timestamp -->
                    <time
                        class="text-xs text-muted-foreground flex-shrink-0"
                        :class="{ 'text-foreground': modelValue }"
                        :datetime="item.date"
                    >
                        {{ formatDistanceToNow(new Date(item.date), { addSuffix: true }) }}
                    </time>
                </div>

                <!-- Subject -->
                <div
                    class="text-sm mb-2 truncate"
                    :class="item.read ? 'text-foreground' : 'text-foreground font-semibold'"
                >
                    {{ item.subject }}
                </div>

                <div class="flex items-center gap-2">
                    <Badge v-for="label of item.labels" :key="label">
                        {{ label }}
                    </Badge>
                </div>

                <div v-if="item.summary" class="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic my-2">
                    "{{ item.summary }}"
                </div>

                <!-- Preview text (when collapsed) -->
                <div
                    v-if="!expanded"
                    class="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                >
                    {{ getPreviewText(item.body) }}
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
                        class="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-line"
                    >
                        {{ item.body }}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <div class="p-4" v-if="item.reply">
            <Textarea v-model="item.reply" rows="5"/>
        </div>
    </div>
</template>

<script lang="ts" setup>
import type { MailType } from "@/models/mailType";
import { ref, toRefs } from "vue";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronUp, Square, SquareCheck } from "lucide-vue-next";
import { Collapsible, CollapsibleContent, } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface MailProps {
    item: MailType;
    modelValue: boolean;
}

const props = defineProps<MailProps>();
const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

const { item, modelValue } = toRefs(props);
const expanded = ref(false);

const toggleSelection = () => {
    emit('update:modelValue', !modelValue.value);
};

const getPreviewText = (body: string): string => {
    // Strip HTML tags and get clean preview text
    const cleanText = body.replace(/<[^>]*>/g, '').trim();
    return cleanText.length > 200 ? cleanText.substring(0, 200) + '...' : cleanText;
};
</script>
