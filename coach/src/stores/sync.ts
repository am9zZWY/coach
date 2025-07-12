// noinspection t

import { onUnmounted, ref, watch } from 'vue'
import type { DataConnection } from 'peerjs'
import Peer from 'peerjs'
import { useDB } from '@/composables/useDB.ts'
import { defineStore, storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

type Connections = Record<string, DataConnection>

export const useSyncStore = defineStore('sync', () => {
  const db = useDB()
  const { lastUpdated } = storeToRefs(db)

  const clientId = ref<string>(localStorage.getItem('client') ?? `life-coach-${uuidv4()}`)
  localStorage.setItem('client', clientId.value)
  const knownClients = ref<string[]>(JSON.parse(localStorage.getItem('known-clients') ?? '[]'))
  watch(knownClients, kc => localStorage.setItem('known-clients', JSON.stringify(kc)), { deep: true, immediate: true })

  const connections = ref<Connections>({})
  const peer = new Peer(clientId.value, { debug: 0 })

  onUnmounted(() => peer.destroy())

  function addConnection(conn: DataConnection) {
    connections.value[conn.peer] = conn
    conn.on('data', (data: unknown) => {
      const { age } = db.unpack(data as string)
      if (age > db.lastUpdated) {
        db.fromString(data as string)
      }
    })
    conn.on('error', () => {
    })
    conn.on('close', () => delete connections.value[conn.peer])
  }

  peer.on('connection', (conn: DataConnection) => addConnection(conn))
  peer.on('error', () => {
  })

  function connectToPeer(targetId: string, trial = 0) {
    if (trial >= 3 || targetId === clientId.value) {
      return
    }
    if (connections?.value[targetId]?.open ?? false) {
      return
    }
    try {
      const conn = peer.connect(targetId)
      connections.value[targetId] = conn
      conn.on('open', () => {
      })
      conn.on('error', () => setTimeout(() => connectToPeer(targetId, trial + 1), 1000 * (trial + 1)))
      conn.on('close', () => delete connections.value[targetId])
      addConnection(conn)
    } catch {
      setTimeout(() => connectToPeer(targetId, trial + 1), 1000 * (trial + 1))
    }
  }

  function sync(targetId: string, force = false) {
    const conn = connections.value[targetId]
    if (conn?.open ?? false) {
      conn.send(db.toString(force))
    }
  }

  const syncAll = (force = false): void => {
    knownClients.value.forEach(id => {
      connectToPeer(id)
      sync(id, force)
    })
  }

  watch(lastUpdated, () => syncAll(), { immediate: true })
  watch(knownClients, () => knownClients.value.forEach(connectToPeer), { immediate: true })

  return { syncAll, clientId, knownClients }
})
