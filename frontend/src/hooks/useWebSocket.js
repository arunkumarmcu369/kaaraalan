import { useCallback, useEffect, useRef, useState } from 'react'

export function useWebSocket(url, { enabled = true, onMessage } = {}) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const retryRef = useRef(0)

  const connect = useCallback(() => {
    if (!enabled || !url) return
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => {
        setConnected(true)
        retryRef.current = 0
      }
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          onMessageRef.current?.(data)
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        setConnected(false)
        const delay = Math.min(30000, 1000 * 2 ** retryRef.current)
        retryRef.current += 1
        setTimeout(connect, delay)
      }
      ws.onerror = () => ws.close()
    } catch {
      setConnected(false)
    }
  }, [enabled, url])

  useEffect(() => {
    connect()
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 25000)
    return () => {
      clearInterval(ping)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
