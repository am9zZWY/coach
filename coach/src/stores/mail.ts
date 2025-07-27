// noinspection t

import { useDB } from "@/composables/useDB.ts";
import { defineStore, storeToRefs } from "pinia";
import { useAssistantStore } from "@/stores/assistant.ts";
import { computed, ref, toRef, watch } from "vue";
import type { MailType } from "@/models/mailType.ts";
import { useUserStore } from "@/stores/user.ts";
import { useAPI } from "@/composables/useApi.ts";

export const useMailStore = defineStore('mails', () => {
        const db = useDB();
        const api = useAPI()
        const { lastUpdated } = storeToRefs(db)
        const assistantStore = useAssistantStore()
        const userStore = useUserStore()

        // Fetch mails from API
        const mails = ref<{ [id: string]: MailType }>(db.get('mails') ?? {});
        watch(mails, () => {
            db.set('mails', mails.value)
        }, { deep: true })
        watch(lastUpdated, () => {
            mails.value = db.get('mails') ?? {}
        })

        // Filtered mails
        const mailFilter = toRef('')
        const filteredMails = computed(() => {
            const filter = mailFilter.value.toLocaleLowerCase().trim()

            if (filter === '') {
                return Object.values(mails.value)
            }

            return Object.values(mails.value).filter((mail) => {
                return mail.from.toLowerCase().includes(filter) ||
                    mail.to.toLowerCase().includes(filter) ||
                    mail.subject.toLowerCase().includes(filter) ||
                    mail.labels.includes(filter)
            })
        })

        // For actions track which mails are selected
        const selectedMailMap = ref<{ [id: string]: boolean }>({});
        const selectedMails = computed(() =>
            Object.entries(selectedMailMap.value)
                .filter(([_, isSelected]) => isSelected)
                .map(([mailId]) => mails.value[mailId])
        )

        function selectAll() {
            for (const mail of Object.values(mails.value)) {
                selectedMailMap.value[mail.id] = true;
            }
        }

        function deselectAll() {
            for (const mail of Object.values(mails.value)) {
                selectedMailMap.value[mail.id] = false;
            }
        }

        const mailTools = [
            {
                type: "function",
                function: {
                    name: "label",
                    description: "Assign importance and urgency labels",
                    parameters: {
                        type: "object",
                        properties: {
                            mailId: { type: "string" },
                            labels: {
                                type: "array",
                                items: { enum: ["wichtig", "dringend", "nicht wichtig", "nicht dringend"] }
                            }
                        },
                        required: ["mailId", "labels"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "markAsRead",
                    description: "Mark a mail as read",
                    parameters: {
                        type: "object",
                        properties: { mailId: { type: "string" } },
                        required: ["mailId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "reply",
                    description: "Compose an email reply",
                    parameters: {
                        type: "object",
                        properties: {
                            mailId: { type: "string" },
                            content: { type: "string" }
                        },
                        required: ["mailId", "content"]
                    }
                }
            }
        ]

        async function summarize(mailId: string) {
            const mail = mails.value[mailId];
            if (!mail) {
                return;
            }

            const response = await assistantStore.run({
                systemPrompt: `You are an email summarization assistant. Your task is to create concise, informative summaries.
            
            Instructions:
            - Extract the main purpose/request of the email
            - Identify key action items or decisions needed
            - Preserve critical details (dates, names, numbers)
            - Use the same language as the email
            - Maximum length: 15-20 words
            - Format: Single sentence without punctuation at the end
            - Style: Professional and clear`,

                userPrompt: `Original email from ${mail.from} to summarize:
                                SUBJECT: ${mail.subject}
                                BODY: ${mail.body}`,
                withPersonality: false
            });

            if (!response) {
                console.error('Failed to generate summary')
                return;
            }

            mails.value = {
                ...mails.value,
                [mailId]: {
                    ...mails.value[mailId],
                    summary: response as string
                }
            };
        }

        async function generateReply(mailId: string) {
            const mail = mails.value[mailId];
            if (!mail) {
                return;
            }

            const response = await assistantStore.run({
                systemPrompt: `Generate a direct email reply. No AI assistant preambles or explanations.

            Rules:
            - Write ONLY the email content itself
            - Never use phrases like "Certainly", "I'd be happy to", "Here's a draft"
            - Match the sender's tone and formality
            - End with appropriate sign-off
            - If critical info is missing, state it directly in the email body
            
            Output exactly what should be sent, nothing more.
            
            Senders personality that MUST be matched: ${userStore.user.mailPersonality}.
            `,
                userPrompt: `Original email from ${mail.from} to respond to:
                                SUBJECT: ${mail.subject}
                                BODY: ${mail.body}`,
                withPersonality: false
            });

            if (!response) {
                console.error('Failed to generate reply.')
                return;
            }

            mails.value = {
                ...mails.value,
                [mailId]: {
                    ...mails.value[mailId],
                    reply: response as string
                }
            };
        }

        async function triage(mailId: string) {
            const mail = mails.value[mailId]
            if (!mail) {
                return
            }

            const systemPrompt = `
You are an executive email assistant.
Respond ONLY via function calls defined in tools.
Rules:
1. Always call "label".
2. Call "markAsRead" when no user action is needed.
3. Only call "reply" when a response from the user is required.
Style guide for replies:
- German greeting if sender wrote German, otherwise mirror language.
- Concise and actionable, proper closing.
`

            const userPrompt = `
MAIL_ID: ${mail.id}
FROM:    ${mail.from}
SUBJECT: ${mail.subject}
BODY:
${mail.body}
`

            const response = await assistantStore.runWithTools({
                tools: mailTools,
                systemPrompt: systemPrompt,
                userPrompt: userPrompt,
            })

            const toolCalls = response.choices?.[0]?.message?.tool_calls ?? []

            for (const call of toolCalls) {
                /*
                {id: "call_wDr8nKGBetIvYnbdthrCFwGI", type: "function", function: {name: "label", arguments: "{\"mailId\": \"c5d19f0b-6bc\", \"labels\": [\"wichtig\", \"nicht dringend\"]}"}}
                 */
                const functionName = call.function.name
                const functionArgs = call.function.arguments
                const args = JSON.parse(functionArgs)

                const updatedMail = mails.value[args.mailId]

                if (functionName === "label") {
                    updatedMail.labels = args.labels
                }
                if (functionName === "markAsRead") {
                    updatedMail.read = true
                }

                mails.value = {
                    ...mails.value,
                    [mailId]: updatedMail
                };

                if (functionName === "reply") {
                    updatedMail.reply = args.content
                    await generateReply(mailId)
                }
            }
        }


        async function summarizeMails() {
            const selectedEntries = Object.entries(selectedMailMap.value)
                .filter(([_, isSelected]) => isSelected)
                .map(([mailId]) => mailId);

            if (selectedEntries.length === 0) {
                console.warn('No mails selected for summarization');
                return;
            }

            await Promise.allSettled(
                selectedEntries.map(mailId => summarize(mailId))
            );

            deselectAll();
        }

        async function generateReplies() {
            const selectedEntries = Object.entries(selectedMailMap.value)
                .filter(([_, isSelected]) => isSelected)
                .map(([mailId]) => mailId);

            if (selectedEntries.length === 0) {
                console.warn('No mails selected for summarization');
                return;
            }

            await Promise.allSettled(
                selectedEntries.map(mailId => generateReply(mailId))
            );

            deselectAll();
        }

        async function triageMails() {
            const selectedEntries = Object.entries(selectedMailMap.value)
                .filter(([_, isSelected]) => isSelected)
                .map(([mailId]) => mailId);

            if (selectedEntries.length === 0) {
                console.warn('No mails selected for summarization');
                return;
            }

            await Promise.allSettled(
                selectedEntries.map(mailId => triage(mailId))
            );

            deselectAll();
        }

        function fetchMails() {
            api.apiCall<MailType[]>('mail')
                .then((fetchedMails) => {
                    if (!fetchedMails) {
                        return;
                    }

                    for (const mail of fetchedMails) {
                        if (!(mail.id in mails.value)) {
                            mails.value[mail.id] = mail
                        } else {
                            mails.value[mail.id] = { ...mails.value[mail.id], ...mail }
                        }
                    }
                    db.set(`mails`, mails);
                })
        }

        fetchMails();

        return {
            mails,
            selectedMails,
            selectedMailMap,
            mailFilter,
            filteredMails,
            selectAll,
            deselectAll,

            // Assistant related
            summarizeMails,
            summarize,
            generateReplies,
            generateReply,
            triageMails,
            triage
        }
    }
)
