/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react'

export function useUIState() {
  const [showQuickSwitch, setShowQuickSwitch] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVaultMenu, setShowVaultMenu] = useState(false)

  const toggleQuickSwitch = useCallback(() => setShowQuickSwitch(v => !v), [])
  const toggleGraph = useCallback(() => setShowGraph(v => !v), [])
  const toggleShortcuts = useCallback(() => setShowShortcuts(v => !v), [])
  const toggleVaultMenu = useCallback(() => setShowVaultMenu(v => !v), [])

  return {
    showQuickSwitch, setShowQuickSwitch,
    showGraph, setShowGraph,
    showShortcuts, setShowShortcuts,
    showVaultMenu, setShowVaultMenu,
    toggleQuickSwitch, toggleGraph, toggleShortcuts, toggleVaultMenu,
  }
}
