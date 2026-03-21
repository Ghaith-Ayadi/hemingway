// useLocalStorage — useState wrapper that reads initial value from localStorage and writes on every update.
// Supports functional updaters (e.g. setPrev => [...prev, item]) identically to useState.

import { useState } from 'react'

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function setAndStore(updater) {
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Quota exceeded or serialisation error — silently ignore
      }
      return next
    })
  }

  return [value, setAndStore]
}
