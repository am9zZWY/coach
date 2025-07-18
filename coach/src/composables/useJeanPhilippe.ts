import { computed, ref } from "vue";
import { useDateFormat } from "@vueuse/core";
import { useAssistantStore } from "@/stores/assistant.ts";
import { useWeatherStore } from "@/stores/weather.ts";
import { useTaskStore } from "@/stores/task.ts";
import { storeToRefs } from "pinia";

export const useJeanPhilippe = () => {
    const assistantStore = useAssistantStore()
    const weatherStore = useWeatherStore()
    const taskStore = useTaskStore()

    const { flatTasks } = storeToRefs(taskStore)

    const summary = ref('')
    const loading = ref(false)

    // Time and Day
    const currentDate = useDateFormat(new Date(), 'dddd, D. MMMM YYYY')
    const currentTime = useDateFormat(new Date(), 'HH:mm')
    const timeOfDay = computed(() => {
        const hour = new Date().getHours()
        if (hour >= 5 && hour < 11) {
            return 'morning'
        }
        if (hour >= 11 && hour < 13) {
            return 'lunch'
        }
        if (hour >= 13 && hour < 18) {
            return 'afternoon'
        }
        if (hour >= 18 && hour < 23) {
            return 'evening'
        }
        return 'night'
    })

    const systemPrompt = computed(() => `FORMATIERUNG:
- Du antwortest in einfachem Text, kein Markdown erlaubt, keine Sternchen, keine Überschriften
- Du verwendest gelegentlich Emojis, aber sparsam und geschmackvoll
- Du sprichst mich immer direkt an, als ob wir ein Gespräch führen
- Du antwortest IMMER auf Deutsch und mischst gelegentlich ein oder zwei französische Phrasen ein
- Du unterschreibst mit "- Jean-Philippe" und gelegentlich einer kurzen französischen Phrase
- Du hast die Gabe, genau zu wissen, wann du genug gesagt hast und hältst dich stets angenehm kurz
`)

    const userPrompt = computed(() => {
        let baseContext = `Es ist ${currentDate.value} um ${currentTime.value}. `

        if (weatherStore.weather.location !== '') {
            baseContext += `Es sind ${weatherStore.weather.temperature}°C in ${weatherStore.weather.location}. `
        }

        const tasksContext = flatTasks.value.length > 0
            ? `Meine aktuellen Aufgaben sind: ${taskStore.toString()}`
            : 'Ich habe momentan keine Aufgaben geplant.'

        switch (timeOfDay.value) {
            case 'morning':
                return `Bonjour! ${baseContext}

Als mein vertrauter persönlicher Assistent seit 3 Jahren, bitte überprüfe meinen bevorstehenden Tag mit deiner charakteristischen französischen Effizienz. Ich brauche:
1. Eine kurze, personalisierte Morgengrußformel, die Bezug auf das Wetter oder meinen Zeitplan nimmt
2. Deine Top-3-Prioritätsempfehlungen (sei sehr spezifisch darüber, was zuerst Aufmerksamkeit benötigt)
3. Weise auf Terminüberschneidungen oder Zeitmanagementprobleme hin, die dir auffallen
4. Einen praktischen Vorschlag zur Verbesserung meiner Produktivität heute

${tasksContext}`

            case 'lunch':
                return `Bon midi! ${baseContext}

Es ist Mittagszeit, und ich könnte deine kulinarische Expertise gebrauchen. Bitte:
1. Schlage ein anspruchsvolles, aber praktisches Mittagsrezept vor, das dich beeindrucken würde
2. Füge deinen kulturellen Kommentar hinzu, warum dieses Gericht für heute angemessen ist
3. Ergänze eine kurze Notiz zu meinem Nachmittagsplan

${tasksContext}`

            case 'afternoon':
                return `Bon après-midi! ${baseContext}

Es ist Nachmittag – Zeit für eine kleine Stärkung oder eine kreative Pause. Bitte:
1. Empfiehl mir einen raffinierten, aber unkomplizierten Snack oder ein Getränk, das am Nachmittag typisch ist und deinem französischen Geschmack entspricht
2. Teile einen charmanten kulturellen Einblick oder eine französische Tradition, warum dieser Snack oder dieses Getränk am Nachmittag besonders geschätzt wird
3. Gib mir eine inspirierende, aber diskrete Notiz, die meinen Nachmittag mit Esprit und Effizienz begleitet
4. Zeige mir bitte zwei bis drei praxiserprobte Tipps aus deiner Erfahrung, wie ich meine heutigen ToDos nach Priorität ordnen und souverän erledigen kann

${tasksContext}`


            case 'evening':
                return `Bonsoir! ${baseContext}

Der Arbeitstag neigt sich dem Ende zu. Bitte teile mit:
1. Entweder einen einfachen Rezeptvorschlag für das morgige Mittagessen oder eine Filmempfehlung, die meinem Geschmack entspricht
2. Eine kurze Reflexion über die heutigen Erfolge
3. Eine Sache, auf die ich mich für morgen vorbereiten sollte

${tasksContext}`

            case 'night':
                return `Bonne nuit! ${baseContext}

Bevor ich mich für den Abend zurückziehe, bitte stelle bereit:
1. Einen kurzen Überblick über den morgigen Zeitplan
2. Eine Sache, die ich heute Abend nicht vergessen sollte vorzubereiten
3. Eine geistreiche französische Beobachtung über Erholung oder Produktivität

${tasksContext}`
        }
    })

    // Generate summary based on time of day, tasks, weather, etc.
    const generateSummary = async (force: boolean = false) => {
        loading.value = true

        const cachedSummary = assistantStore.getText('jeanPhilippeSummary', 60 * 60 * 2)

        if (!force && cachedSummary) {
            summary.value = cachedSummary
            loading.value = false
            return
        }

        try {
            summary.value = await assistantStore.run({
                systemPrompt: systemPrompt.value,
                userPrompt: userPrompt.value
            }) as string;
            assistantStore.addText('jeanPhilippeSummary', summary.value)
            await generateTaskSuggestions()
        } catch (error) {
            console.error('Failed to generate summary:', error)
            summary.value = 'Failed to generate summary. Please try again.'
        } finally {
            loading.value = false
        }
    }

    // Generate Tasks based on summary
    const generateTaskSuggestions = async () => {
        if (!summary.value) {
            return;
        }

        await taskStore.generateTaskSuggestionsFromInput(summary.value, `
            This is a summary generated by an LLM. Extract potential tasks that will be shown to me as suggestion. The tasks should have really short titles.
        `)
    }


    return {
        loading,
        currentDate,
        summary,
        generateSummary
    }
}
