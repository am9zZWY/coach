<template>
    <Card>
        <CardHeader class="pb-2">
            <CardTitle class="flex items-center gap-2">
                <CookingPot/>
                Gesund kochen und essen
            </CardTitle>
            <CardDescription>Lass dir gesunde, leckere Rezepte vorschlagen – individuell auf
                deine Wünsche!
            </CardDescription>
        </CardHeader>
        <CardContent class="p-6 flex flex-col gap-4">
            <label for="recipe-prompt" class="text-xs font-medium text-muted-foreground mb-1">
                Was möchtest du heute kochen? (Zutaten, Wünsche, Diät...)
            </label>
            <Textarea
                id="recipe-prompt"
                v-model="userPrompt"
                :placeholder="placeholder"
                class="resize-none min-h-[80px] focus:ring-primary"
                :disabled="loading"
            />
            <div class="flex items-center gap-2">
                <Button
                    @click="suggestRecipes"
                    :disabled="loading || !userPrompt.trim()"
                    class="gap-2"
                >
                    <WandSparkles class="w-4 h-4"/>
                    {{ loading ? 'Lädt...' : 'Rezepte vorschlagen' }}
                </Button>
                <span v-if="error" class="text-xs text-destructive ml-2">{{ error }}</span>
            </div>
            <div v-if="cookingSuggestion" class="mt-4 bg-muted/30 rounded p-4 text-sm whitespace-pre-line"
                 v-html="cookingSuggestion"/>
        </CardContent>
    </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CookingPot, WandSparkles } from 'lucide-vue-next'
import { useAssistantStore } from '@/stores/assistant.ts'

const assistantStore = useAssistantStore()
const cookingSuggestion = ref<string>('')
const userPrompt = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)
const placeholder = 'Z.B.: "Ich habe Brokkoli und Reis, bitte ein einfaches, vegetarisches Rezept."'

const systemPrompt =
    `Du bist ein persönlicher Kochassistent. Du schlägst gesunde, ausgewogene Rezepte vor, die auf die Wünsche und Zutaten des Nutzers eingehen. Antworte freundlich und klar. Gebe Antworten nur für Koch- und Rezepte-bezogene Themen. Dein Ausgabeformat ist nur HTML, KEIN MARKDOWN, das heißt, du kannst z.B. strong, ol, ul verwenden!`

const suggestRecipes = async () => {
    error.value = null
    cookingSuggestion.value = ''
    loading.value = true
    const response = await assistantStore.run({
        userPrompt: userPrompt.value,
        systemPrompt: systemPrompt,
    })
    if (!response) {
        error.value = 'Fehler beim Laden der Rezepte. Bitte versuche es erneut.'
        console.error(error.value)
        loading.value = false
        return;
    }

    cookingSuggestion.value = response as string;
    loading.value = false
}
</script>
