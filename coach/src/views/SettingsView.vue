<script lang="ts" setup>
import { Check, Cloud, FolderSync, MapPin, Settings } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from 'reka-ui'
import { useWeatherStore } from '@/stores/weather.ts'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'vue-sonner'
import { useAssistantStore } from '@/stores/assistant.ts'
import { Textarea } from '@/components/ui/textarea'
import { useUserStore } from '@/stores/user.ts'
import { useSyncStore } from '@/stores/sync.ts'
import copyTextToClipboard from "@uiw/copy-to-clipboard";
import { useAPI } from "@/composables/useApi.ts";
import { Switch } from "@/components/ui/switch";

const userStore = useUserStore()
const { user } = storeToRefs(userStore)

const API = useAPI()
const { api } = storeToRefs(API)

const assistantStore = useAssistantStore()
const { assistant } = storeToRefs(assistantStore)

const weatherStore = useWeatherStore()
const { location } = storeToRefs(weatherStore)

const syncStore = useSyncStore()
const { knownClients } = storeToRefs(syncStore)

const openAiApiKeyInput = ref<string>('')
const weatherApiKeyInput = ref<string>('')
const locationInput = ref<string>('')
const clientIdInput = ref<string>('')
const username = ref('')
const password = ref('')

onMounted(() => {
    weatherStore.loadWeatherSettings().then(() => {
        locationInput.value = location.value
    })
})

async function handleLogin() {
    const success = await userStore.login(username.value, password.value)
    if (success) {
        toast('Login successful')
        await weatherStore.loadWeatherSettings()
        locationInput.value = location.value
    } else {
        toast('Login failed', { description: 'Please check your username and password.' })
    }
}

function updateOpenAiApiKey() {
    if (!openAiApiKeyInput.value) {
        toast.error('API Key cannot be empty')
        return
    }
    userStore.setOpenAIApiKey(openAiApiKeyInput.value)
    toast('API-Schlüssel wird aktualisiert', {
        description: 'Dein OpenAI API-Schlüssel wird auf dem Server gespeichert.'
    })
}

function updateWeatherSettings() {
    weatherStore.updateWeatherSettings(weatherApiKeyInput.value, locationInput.value)
    toast('Wetter Einstellungen aktualisiert', {
        description: `Deine Wetter Einstellungen werden gespeichert.`
    })
}

function addClient() {
    if (clientIdInput.value && !knownClients.value.includes(clientIdInput.value)) {
        knownClients.value.push(clientIdInput.value)
        toast('Client hinzugefügt')
        clientIdInput.value = ''
    }
}

function removeClient(clientId: string) {
    knownClients.value = knownClients.value.filter((c: string) => c !== clientId)
    toast('Client entfernt')
}

function copyClientId() {
    copyTextToClipboard(syncStore.clientId)
}
</script>

<template>
    <div class="container max-w-2xl mx-auto py-12 px-4">
        <h1 class="text-3xl font-bold mb-6">Einstellungen</h1>

        <div class="space-y-6">
            <!-- Login Card -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Settings class="h-5 w-5 shrink-0"/>
                        Login
                    </CardTitle>
                    <CardDescription>
                        Authenticate to use the API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form @submit.prevent="handleLogin" class="space-y-4">
                        <div class="space-y-2">
                            <Label for="username">Username</Label>
                            <Input
                                id="username"
                                v-model="username"
                                placeholder="Enter your username"
                                type="text"
                                class="flex-1"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="password">Password</Label>
                            <Input
                                id="password"
                                v-model="password"
                                placeholder="Enter your password"
                                type="password"
                                class="flex-1"
                            />
                        </div>
                        <Button type="submit" size="sm" class="shrink-0">
                            <Check class="h-4 w-4 mr-2"/>
                            Login
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <!-- Personal Settings Card -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Settings class="h-5 w-5 shrink-0"/>
                        Persönliche Einstellungen
                    </CardTitle>
                    <CardDescription>
                        Personalisiere deine Erfahrung mit der App.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="space-y-6">
                        <div class="space-y-2">
                            <Label for="personalName">Wie möchtest du genannt werden?</Label>
                            <Input
                                id="personalName"
                                v-model="user.name"
                                placeholder="Dein Name"
                                type="text"
                            />
                        </div>

                        <Separator/>

                        <div class="space-y-2">
                            <Label for="personalInformation">Informationen über dich</Label>
                            <Textarea
                                id="personalInformation"
                                v-model="user.personalInformation"
                                placeholder="Stelle persönliche Informationen über dich bereit"
                                rows="3"
                            />
                        </div>

                        <Separator/>

                        <div class="space-y-2">
                            <Label for="personalInformation">Mail Persönlichkeit</Label>
                            <Textarea
                                id="personalInformation"
                                v-model="user.mailPersonality"
                                placeholder="Passe E-Mails an dich an"
                                rows="3"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- API Card -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Settings class="h-5 w-5 shrink-0"/>
                        API Einstellungen
                    </CardTitle>
                    <CardDescription>
                        Konfiguriere deine API-Verbindung
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div class="space-y-6">
                        <div class="space-y-2">
                            <Switch id="airplane-mode" v-model="api.enableAPI"/>
                            <Label for="airplane-mode">API Einschalten</Label>
                        </div>

                        <Separator/>

                        <div class="space-y-2">
                            <Label for="apiKey">API URL</Label>
                            <Input
                                id="apiKey"
                                v-model="api.apiURL"
                                placeholder="Deine API URL"
                                type="text"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- OpenAI Settings Card -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Settings class="h-5 w-5 shrink-0"/>
                        OpenAI Einstellungen
                    </CardTitle>
                    <CardDescription>
                        Konfiguriere deine OpenAI API-Verbindung
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form @submit.prevent="updateOpenAiApiKey" class="space-y-4">
                        <div class="space-y-2">
                            <Label for="openAiApiKey">OpenAI API Schlüssel</Label>
                            <div class="flex gap-2">
                                <Input
                                    id="openAiApiKey"
                                    v-model="openAiApiKeyInput"
                                    placeholder="Füge einen OpenAI API Key ein"
                                    type="password"
                                    class="flex-1"
                                />
                                <Button type="submit" size="sm" class="shrink-0">
                                    <Check class="h-4 w-4 mr-2"/>
                                    Speichern
                                </Button>
                            </div>
                            <p class="text-sm text-muted-foreground">
                                Erstelle <a class="underline hover:text-primary transition-colors"
                                            href="https://platform.openai.com/api-keys"
                                            target="_blank" rel="noreferrer">hier</a> einen OpenAI Schlüssel.
                            </p>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <!-- Weather Settings Card -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Cloud class="h-5 w-5 shrink-0"/>
                        Wetter Einstellungen
                    </CardTitle>
                    <CardDescription>
                        Konfiguriere die Wetter-Informationen für deine Anwendung
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form @submit.prevent="updateWeatherSettings" class="space-y-6">
                        <!-- Location Settings -->
                        <div class="space-y-2">
                            <Label for="location" class="flex items-center gap-1">
                                <MapPin class="h-4 w-4"/>
                                Standort
                            </Label>
                            <Input
                                id="location"
                                v-model="locationInput"
                                type="text"
                                placeholder="Für wo möchtest du das Wetter haben?"
                                class="flex-1"
                            />
                        </div>

                        <Separator/>

                        <!-- Weather API Key Settings -->
                        <div class="space-y-2">
                            <Label for="weatherApiKey">Weather API Schlüssel</Label>
                            <Input
                                id="weatherApiKey"
                                v-model="weatherApiKeyInput"
                                type="password"
                                placeholder="Füge einen Weather API Schlüssel ein"
                                class="flex-1"
                            />
                            <p class="text-sm text-muted-foreground">
                                Erstelle <a class="underline hover:text-primary transition-colors"
                                            href="https://www.weatherapi.com/my/"
                                            target="_blank"
                                            rel="noreferrer">hier</a> einen Weather API Schlüssel.
                            </p>
                        </div>
                        <Button type="submit" size="sm" class="shrink-0">
                            <Check class="h-4 w-4 mr-2"/>
                            Speichern
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <!-- Encoded Settings -->
            <Card>
                <CardHeader class="space-y-1">
                    <CardTitle class="flex items-center gap-2">
                        <Settings class="h-5 w-5 shrink-0"/>
                        Synchronisation
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <div class="space-y-4">
                        <form @submit.prevent="addClient()" class="space-y-2">
                            <Label for="clientId">Client ID</Label>
                            <div class="flex gap-2">
                                <Input
                                    id="clientId"
                                    v-model="clientIdInput"
                                    type="text"
                                    placeholder="Füge eine Client ID ein"
                                    class="flex-1"
                                />
                                <Button type="submit" size="sm" class="shrink-0">
                                    <FolderSync class="h-4 w-4 mr-2"/>
                                    Hinzufügen
                                </Button>
                            </div>
                            <div class="text-sm text-muted-foreground">
                                Deine Client ID lautet:
                                <Button variant="outline" class="whitespace-normal break-words text-left p-5 ml-2"
                                        @click="copyClientId()">
                                    {{ syncStore.clientId }}
                                </Button>
                            </div>
                        </form>

                        <template v-if="knownClients.length > 0">
                            <Separator/>
                            <div class="space-y-2">
                                <Label>Deine Clients:</Label>
                                <ul class="space-y-2">
                                    <li v-for="clientId in knownClients" :key="clientId"
                                        class="flex items-center justify-between rounded-md border p-2">
                                        <span class="text-sm break-all pr-2">{{ clientId }}</span>
                                        <Button variant="destructive" size="sm" class="shrink-0"
                                                @click="removeClient(clientId)">
                                            Entfernen
                                        </Button>
                                    </li>
                                </ul>
                            </div>
                        </template>
                    </div>
                </CardContent>

                <CardFooter v-if="knownClients.length > 0">
                    <Button @click="syncStore.syncAll(true)">
                        <FolderSync class="h-4 w-4 mr-2"/>
                        Synchronisieren
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
</template>
