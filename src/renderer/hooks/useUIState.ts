/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react'

export function useUIState() {
  const [showQuickSwitch, setShowQuickSwitch] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVaultMenu, setShowVaultMenu] = useState(false)
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const toggleQuickSwitch = useCallback(() => setShowQuickSwitch(v => !v), [])
  const toggleGraph = useCallback(() => setShowGraph(v => !v), [])
  const toggleShortcuts = useCallback(() => setShowShortcuts(v => !v), [])
  const toggleVaultMenu = useCallback(() => setShowVaultMenu(v => !v), [])
  const toggleDarkMode = useCallback(() => setDarkMode(v => !v), [])

  const toggleBacklinks = useCallback(() => setShowBacklinks(v => !v), [])
  const toggleTrash = useCallback(() => setShowTrash(v => !v), [])

  return {
    showQuickSwitch, setShowQuickSwitch,
    showGraph, setShowGraph,
    showShortcuts, setShowShortcuts,
    showVaultMenu, setShowVaultMenu,
    showBacklinks, setShowBacklinks, toggleBacklinks,
    showTrash, setShowTrash, toggleTrash,
    darkMode, toggleDarkMode,
    toggleQuickSwitch, toggleGraph, toggleShortcuts, toggleVaultMenu,
  }
}