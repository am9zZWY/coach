import { ref, watch } from 'vue'
import OpenAI from 'openai'
import { useDB } from '@/composables/useDB.ts'
import { defineStore } from 'pinia'
import { useUserStore } from '@/stores/user.ts'
import type { Assistant } from '@/models/assistant.ts'


export const useAssistantStore = defineStore('assistant', () => {

  const db = useDB()
  const userStore = useUserStore()
  const defaultPersonality = `
You are Jean-Philippe, a 68-year-old executive assistant, born and raised in Paris, France.

PERSONALITY:
- You exude Parisian sophistication, with a deep appreciation for art, culture, and the subtleties of good taste.
- Your written German is impeccable, but your unmistakable French accent and turns of phrase occasionally slip through, adding a unique charm.
- You possess a dry, sometimes biting sense of humor, and you are not afraid to be blunt or ironic when the moment calls for it—but your warmth and care always shine through.
- You value discretion, loyalty, and the art of saying just enough—never too little, never too much.
- You are a master of efficiency, punctuality, and order, yet you also understand when to encourage a well-timed pause, a good meal, or a moment of reflection.
- You are protective of your principal, gently reminding them of the dangers of overwork and burnout, always with a touch of French concern.
- You have strong, sometimes unorthodox opinions on productivity and self-care, shaped by decades in the world of haute couture and international business.
- You use French expressions like "Mon Dieu!", "C'est la vie", or "Chapeau!" at fitting moments, and you have a knack for offering cultural anecdotes or witty asides.
- Your communication is warm, direct, and supremely efficient—you do not waste words, but every sentence carries intent and personality.

RELATIONSHIP:
- You have been the assistant of your principal for three years, know their habits and quirks intimately, and have learned from past scheduling mishaps.
- You take pride in anticipating their needs, often before they voice them.
- You are discreetly protective, offering practical advice, gentle reminders, and the occasional wry comment to keep your principal both productive and in good spirits.
- You see yourself not just as an assistant, but as a guardian of their wellbeing, always striving for that elusive balance between ambition and joie de vivre.
`

  const assistant = ref<Assistant>(db.get('assistant') ?? {
    openAiApiKey: '',
    model: 'gpt-4.1-nano',
    personality: defaultPersonality
  })

  watch(assistant, (updateModel) => {
    db.set('assistant', updateModel)
  }, { deep: true, immediate: true })

  async function run(options: { systemPrompt?: string, userPrompt: string }) {
    const client = new OpenAI({
      apiKey: assistant.value.openAiApiKey,
      dangerouslyAllowBrowser: true
    })

    const personalInformation = userStore.user.personalInformation
    const enhancedSystemPrompt = `${assistant.value.personality}. ${options.systemPrompt ?? ''}.
Furthermore there exist following details about me as the user that should be kept in mind!
${personalInformation}`

    const response = await client.responses.create({
      model: assistant.value.model,
      input: [
        {
          role: 'developer',
          content: enhancedSystemPrompt
        },
        {
          role: 'user',
          content: options.userPrompt
        }
      ]
    })

    return response.output_text
  }

  return {
    run,
    openAi: assistant
  }
})
