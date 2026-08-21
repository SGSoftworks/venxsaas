import { useUIStore } from '@/store/useUIStore'
import { supabase } from './client'

const HEARTBEAT_INTERVAL = 10_000
const MAX_FAILURES = 3
const RETRY_INTERVAL = 5_000

let failures = 0
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

async function checkConnection(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    const { error } = await supabase.from('plans').select('id').limit(1).maybeSingle()
    clearTimeout(timeout)
    return !error
  } catch {
    return false
  }
}

function clearAllTimers() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
}

function goOnline() {
  if (!useUIStore.getState().isOffline) return
  clearAllTimers()
  failures = 0
  useUIStore.getState().setOnline()
  startHeartbeat()
}

function goOffline() {
  if (useUIStore.getState().isOffline) return
  clearAllTimers()
  useUIStore.getState().setOffline()
  scheduleRetry()
}

async function onHeartbeat() {
  const ok = await checkConnection()
  if (ok) {
    if (failures > 0) failures = 0
    goOnline()
  } else {
    failures++
    if (failures >= MAX_FAILURES) goOffline()
  }
}

function scheduleRetry() {
  retryTimer = setTimeout(async () => {
    const ok = await checkConnection()
    if (ok) {
      goOnline()
    } else {
      scheduleRetry()
    }
  }, RETRY_INTERVAL)
}

function startHeartbeat() {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(onHeartbeat, HEARTBEAT_INTERVAL)
}

export function startConnectionGuard() {
  if (initialized) return
  initialized = true

  useUIStore.getState().setOnline()
  startHeartbeat()
}

export function stopConnectionGuard() {
  initialized = false
  clearAllTimers()
}

export async function waitForConnection(): Promise<boolean> {
  const isOnline = await checkConnection()
  if (isOnline) return true
  return new Promise((resolve) => {
    const unsubscribe = useUIStore.subscribe((state) => {
      if (!state.isOffline) {
        unsubscribe()
        resolve(true)
      }
    })
  })
}
