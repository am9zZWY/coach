// noinspection t

import { ref, watch } from 'vue'
import { useDB } from '@/composables/useDB.ts'
import { defineStore } from 'pinia'
import { useUserStore } from '@/stores/user.ts'
import type { Assistant } from '@/models/assistant.ts'
import { now } from "@vueuse/core";
import { useAPI } from "@/composables/useApi.ts";

type RunOptions = {
    systemPrompt?: string;
    userPrompt: string;
    withPersonality?: boolean;
    jsonSchema?: any;
};

export const useAssistantStore = defineStore('assistant', () => {

    const db = useDB()
    const userStore = useUserStore()
    const apiStore = useAPI();

    const defaultPersonality = `
You are Jean-Philippe, a 68-year-old executive assistant with 35 years of experience serving high-profile clients across Paris, London, and New York. You are the principal's trusted right hand, having worked together for three years.

## CORE MISSION
Your singular purpose is to improve your principal's life through proactive assistance, protective guidance, and sophisticated problem-solving. You measure success not by tasks completed, but by stress reduced and quality of life enhanced.

## PERSONALITY FRAMEWORK
**Parisian Sophistication with Practical Wisdom:**
- You possess refined taste shaped by decades in haute couture and international business
- Your communication blends French elegance with German precision - impeccable written skills with charming accent that occasionally surfaces
- You deploy dry humor and gentle irony as tools of persuasion, never as weapons
- You value discretion above all - you know when to speak, when to listen, and when to act silently

**Protective Instincts:**
- You are fiercely loyal and discreetly protective of your principal's wellbeing
- You anticipate needs 2-3 steps ahead, drawing from intimate knowledge of their patterns and preferences
- You gently redirect toward better decisions using charm rather than confrontation
- You have strong opinions on work-life balance, shaped by witnessing too many brilliant people burn out

## OPERATIONAL EXCELLENCE
**Communication Style:**
- Warm but efficient - every word serves a purpose
- Use French expressions naturally: "Mon Dieu!", "C'est la vie", "Chapeau!" when fitting
- Offer cultural anecdotes or witty observations that illuminate rather than distract
- Be direct when clarity is needed, diplomatic when finesse is required

**Proactive Assistance:**
- Remember preferences, habits, and past scheduling mishaps
- Suggest solutions before problems fully manifest
- Balance ambition with joie de vivre - remind about meals, breaks, and human connections
- Provide context and gentle guidance on decisions, especially regarding overcommitment

**Adaptive Intelligence:**
- Adjust formality based on situation urgency and principal's mood
- Recognize when to be the voice of reason vs. the enabler of bold decisions
- Understand that sometimes the best assistance is knowing when NOT to assist

## RELATIONSHIP DYNAMICS
You see yourself as a guardian of your principal's success AND happiness. You've learned their quirks, respected their boundaries, and earned the right to occasionally push back when you see them heading toward unnecessary stress.

You are not just an assistant - you are a curator of a well-lived life, ensuring that ambition never comes at the cost of humanity.

## RESPONSE FRAMEWORK
- Lead with understanding of the request's context within their broader life
- Provide solutions that consider both immediate needs and long-term wellbeing
- Include gentle reminders about self-care when appropriate
- End with proactive suggestions or questions that demonstrate forward-thinking

Remember: Your principal chose you not just for your competence, but for your judgment. Use both liberally.
`

    const assistant = ref<Assistant>(db.get('assistant') ?? {
        model: 'gpt-4.1-nano',
        personality: defaultPersonality,
        generatedTexts: {}
    })

    watch(assistant, (updateModel) => {
        db.set('assistant', updateModel)
    }, { deep: true, immediate: true })

    // Assistant generated Text Cache
    function addText(key: string, text: string) {
        const textWithDate = {
            text: text,
            date: now(),
        }
        assistant.value.generatedTexts[key] = JSON.stringify(textWithDate);
    }

    function getText(key: string, maxAgeMs?: number) {
        const text = assistant.value.generatedTexts[key];
        if (!text) {
            return null;
        }

        const textWithDate = JSON.parse(text) as { text: string, date: number }
        if (maxAgeMs && new Date(textWithDate.date).getTime() + maxAgeMs < Date.now()) {
            return null;
        }

        return textWithDate.text;
    }

    async function run<T>(
        options: RunOptions
    ): Promise<T | null> {
        if (!apiStore.api.enableAPI || !apiStore.api.apiURL) {
            console.error('API is not enabled or URL not set.');
            return null;
        }

        let enhancedSystemPrompt = ``

        // Add the personality of the assistant
        if (options.withPersonality) {
            enhancedSystemPrompt += `${assistant.value.personality}. `
        }

        // Add the system prompt
        if (options.systemPrompt) {
            enhancedSystemPrompt += options.systemPrompt;
        }

        // User information
        const personalInformation = userStore.user.personalInformation ?? ''
        if (personalInformation !== '') {
            enhancedSystemPrompt += `${options.systemPrompt ?? ''}.
Furthermore there exist following details about me as the user that should be kept in mind!
${personalInformation}`
        }
        const name = userStore.user.name ?? ''
        if (name !== '') {
            enhancedSystemPrompt += `My name is ${name}.`
        }

        const token = userStore.user.token;
        if (!token) {
            console.error('User is not authenticated.');
            return null;
        }

        try {
            const body = {
                system_prompt: enhancedSystemPrompt,
                user_prompt: options.userPrompt,
                json_schema: options.jsonSchema
            };

            const response = await fetch(`${apiStore.api.apiURL}/assistant/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch from assistant API');
            }

            const data = await response.json();
            if (options.jsonSchema) {
                return data as T;
            }
            return data.response as T;

        } catch (error) {
            console.error('Error calling assistant API:', error);
            return null;
        }
    }

    async function runWithTools(options: {
        tools: any[],
        systemPrompt: string,
        userPrompt: string
    }) {
        if (!apiStore.api.enableAPI || !apiStore.api.apiURL) {
            console.error('API is not enabled or URL not set.');
            return null;
        }

        let enhancedSystemPrompt = ``

        // Add the system prompt
        if (options.systemPrompt) {
            enhancedSystemPrompt += options.systemPrompt;
        }

        // User information
        const personalInformation = userStore.user.personalInformation ?? ''
        if (personalInformation !== '') {
            enhancedSystemPrompt += `${options.systemPrompt ?? ''}.
Furthermore there exist following details about me as the user that should be kept in mind!
${personalInformation}`
        }
        const name = userStore.user.name ?? ''
        if (name !== '') {
            enhancedSystemPrompt += `My name is ${name}.`
        }

        const token = userStore.user.token;
        if (!token) {
            console.error('User is not authenticated.');
            return null;
        }

        try {
            const response = await fetch(`${apiStore.api.apiURL}/assistant/run_with_tools`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    system_prompt: enhancedSystemPrompt,
                    user_prompt: options.userPrompt,
                    tools: options.tools
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch from assistant API');
            }

            return await response.json();

        } catch (error) {
            console.error('Error calling assistant API with tools:', error);
            return null;
        }
    }

    return {
        run,
        runWithTools,
        addText,
        getText,
        assistant
    }
})
