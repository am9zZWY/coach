import { defineStore, storeToRefs } from "pinia";
import { useDB } from "@/composables/useDB.ts";
import { ref, watch } from "vue";
import type { API } from "@/models/api.ts";

export const useAPI = defineStore('api', () => {
    const db = useDB()
    const { lastUpdated } = storeToRefs(db)

    const api = ref<API>(db.get('api') ?? {
        enableAPI: false,
        apiURL: '',
    })
    watch(api, () => {
        db.set('api', api.value)
    }, { deep: true })
    watch(lastUpdated, () => {
        api.value = db.get('api') ?? api.value
    })

    const isReachable = ref<boolean>(false)
    const checkIfReachable = () => {
        if (!api.value.enableAPI) {
            console.warn('API is disabled')
            isReachable.value = false;
            return;
        }

        if (!api.value || api.value.apiURL === '') {
            isReachable.value = false;
            return;
        }

        fetch(api.value.apiURL).then((res) => {
            isReachable.value = res.ok
        })
    }

    setInterval(checkIfReachable, 1000)

    async function apiCall<T>(route: string) {
        if (!api.value.enableAPI) {
            console.warn('API is disabled')
            return null;
        }

        const headers = new Headers();
        if (!api.value.apiURL || api.value.apiURL === '') {
            console.error('Cannot fetch from API: API URL is not set. Please go to settings and provide a correct API url.');
            return null;
        }

        return fetch(`${api.value.apiURL}/${route}`, {
            headers
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return (res.json()) as T
            })
            .catch((error) => {
                console.error('Error fetching data from API:', error);
                return null;
            });
    }

    return {
        apiCall,
        api,
        isReachable
    }
})
