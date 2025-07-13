import { compress, compressToBase64, decompress, decompressFromBase64 } from 'lz-string'
import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'

const MASTER_KEY = 'allKeys'

export const useDB = defineStore('db', () => {
    const lastUpdated = ref(new Date().getTime())
    const storedTimestamp = localStorage.getItem('age')
    lastUpdated.value = storedTimestamp ? parseInt(storedTimestamp, 10) : new Date().getTime()

    function getAllKeys(): string[] {
        return JSON.parse(localStorage.getItem(MASTER_KEY) ?? '[]')
    }

    function set<T>(key: string, value: T): void {
        if (value == null) {
            console.warn('Value is null or undefined')
            return
        }
        const allKeys = getAllKeys()
        if (!allKeys.includes(key)) {
            allKeys.push(key)
        }
        const before = JSON.stringify(get(key))
        const updated = JSON.stringify(value)
        if (before == updated) {
            console.info('Value did not change. Ignoring set.')
            return
        } else {
            console.warn('Value updated', key)
        }

        localStorage.setItem(key, compress(updated))
        localStorage.setItem(MASTER_KEY, JSON.stringify(allKeys))
        lastUpdated.value = Date.now()
        localStorage.setItem('age', JSON.stringify(lastUpdated.value))
    }

    function get<T>(key: string): T | null {
        const value = localStorage.getItem(key)
        if (!value) {
            console.warn(`No ${key} in db`)
            return null
        }
        const uncompressed = decompress(value)
        return uncompressed ? JSON.parse(uncompressed) as T : null
    }

    function remove(key: string): void {
        localStorage.removeItem(key)
        const allKeys = getAllKeys().filter(k => k !== key)
        localStorage.setItem(MASTER_KEY, JSON.stringify(allKeys))
        localStorage.setItem('age', JSON.stringify(new Date().getTime()))
    }

    function removeAll() {
        console.warn('No keys were found.')
        for (const key of getAllKeys()) {
            remove(key)
        }
    }

    function toString(newAge: boolean = false): string {
        const keys = getAllKeys()
        const values = keys.map(key => localStorage.getItem(key) ?? null)
        const age = newAge ? new Date().getTime() : lastUpdated.value
        return compressToBase64(JSON.stringify({ keys, values, age }))
    }

    function unpack(value: string): {
        keys: string[],
        values: string[],
        age: number,
    } {
        const { keys, values, age } = JSON.parse(decompressFromBase64(value) ?? '{}')
        const parsedAge = new Date(age).getTime()
        return { keys, values, age: parsedAge }
    }

    function fromString(input: string): void {
        const { keys, values, age } = unpack(input)
        console.log(`Unpacked ${keys}`)
        if (!Array.isArray(keys) || !Array.isArray(values)) {
            console.warn('Values must be an array or an array.')
            return
        }
        keys.forEach((key, i) => {
            if (values[i] != null) {
                localStorage.setItem(key, values[i])
            }
        })
        localStorage.setItem(MASTER_KEY, JSON.stringify(keys))
        lastUpdated.value = age
        localStorage.setItem('age', JSON.stringify(lastUpdated.value))
    }

    return { get, set, remove, removeAll, toString, fromString, unpack, lastUpdated: readonly(lastUpdated) }
})
