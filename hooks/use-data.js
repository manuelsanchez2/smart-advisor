"use client"

import { useState, useEffect, useCallback, useRef } from "react"

/**
 * Hook to sync data with RemoteStorage
 * Provides methods for CRUD operations and automatic syncing
 *
 * @param {Object|null} remoteStorage - RemoteStorage instance from useRemoteStorage
 * @returns {Object} Data and methods for managing your data
 */
export function useData(remoteStorage) {
  // State
  const [items, setItems] = useState([])
  const [itemsList, setItemsList] = useState([])
  const [settings, setSettings] = useState({ theme: 'light', language: 'en' })
  const [todos, setTodos] = useState([])
  const [stockItems, setStockItems] = useState([])
  const [aiConfig, setAiConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  // Ref to prevent reload loops during saves
  const isSavingRef = useRef(false)

  // Check connection status
  useEffect(() => {
    if (!remoteStorage) {
      setIsConnected(false)
      return
    }

    const updateConnectionStatus = () => {
      setIsConnected(remoteStorage.connected || false)
    }

    updateConnectionStatus()

    // Listen for connection events
    remoteStorage.on?.('connected', updateConnectionStatus)
    remoteStorage.on?.('disconnected', updateConnectionStatus)

    return () => {
      remoteStorage.off?.('connected', updateConnectionStatus)
      remoteStorage.off?.('disconnected', updateConnectionStatus)
    }
  }, [remoteStorage])

  // Load all data when connected
  const loadAllData = useCallback(async () => {
    if (!remoteStorage || !isConnected) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Load items list (metadata)
      if (remoteStorage.mymodule?.getItemsList) {
        const list = await remoteStorage.mymodule.getItemsList()
        setItemsList(list)
      }

      // Load settings
      if (remoteStorage.mymodule?.loadSettings) {
        const loadedSettings = await remoteStorage.mymodule.loadSettings()
        setSettings(loadedSettings)
      }

      // Load todos from todonna scope
      if (remoteStorage.todonna?.getAll) {
        const loadedTodos = await remoteStorage.todonna.getAll({ maxAge: 5 * 60 * 1000 })
        setTodos(Array.isArray(loadedTodos) ? loadedTodos : [])
      }

      // Load stock items from einkauf scope
      if (remoteStorage.einkauf?.getItemsList) {
        const stockList = await remoteStorage.einkauf.getItemsList()
        setStockItems(Array.isArray(stockList) ? stockList : [])
      }

      // Load AI Wallet configuration
      if (remoteStorage["ai-wallet"]?.getConfig) {
        const config = await remoteStorage["ai-wallet"].getConfig()
        setAiConfig(config || null)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [remoteStorage, isConnected])

  // Initial load
  useEffect(() => {
    if (!remoteStorage || !isConnected) {
      setIsLoading(false)
      return
    }

    loadAllData()
  }, [remoteStorage, isConnected, loadAllData])

  // Listen for remote changes
  useEffect(() => {
    if (!remoteStorage || !isConnected) return

    const changeHandler = (event) => {
      // Don't reload if we're currently saving (prevents loops)
      if (isSavingRef.current) return

      // Reload data when remote changes occur
      loadAllData()
    }

    // RemoteStorage uses onChange with a path
    try {
      remoteStorage.onChange?.('/mymodule/', changeHandler)
      remoteStorage.onChange?.('/todonna/', changeHandler)
      remoteStorage.onChange?.('/einkauf/', changeHandler)
      remoteStorage.onChange?.('/ai-wallet/', changeHandler)
    } catch (error) {
      console.warn("Could not attach change listener:", error)
    }

    return () => {
      // Cleanup: RemoteStorage handles cleanup automatically
    }
  }, [remoteStorage, isConnected, loadAllData])

  // ==================== ITEMS METHODS ====================

  /**
   * Save an item
   * @param {Object} item - The item to save
   */
  const saveItem = useCallback(async (item) => {
    if (!remoteStorage?.mymodule || !isConnected) {
      throw new Error("RemoteStorage is not connected. Please connect to RemoteStorage.")
    }

    isSavingRef.current = true

    try {
      // Save to RemoteStorage
      await remoteStorage.mymodule.saveItem(item)

      // Reload items list to get updated metadata
      const updatedList = await remoteStorage.mymodule.getItemsList()
      setItemsList(updatedList)
    } catch (error) {
      console.error("Error saving item:", error)
      // Reload to get correct state
      await loadAllData()
      throw error
    } finally {
      setTimeout(() => {
        isSavingRef.current = false
      }, 100)
    }
  }, [remoteStorage, isConnected, loadAllData])

  /**
   * Load an item by ID
   * @param {string} id - The item ID
   * @returns {Promise<Object|null>}
   */
  const loadItem = useCallback(async (id) => {
    if (!remoteStorage?.mymodule || !isConnected) {
      return null
    }

    try {
      return await remoteStorage.mymodule.loadItem(id)
    } catch (error) {
      console.error("Error loading item:", error)
      return null
    }
  }, [remoteStorage, isConnected])

  /**
   * Delete an item by ID
   * @param {string} id - The item ID
   */
  const deleteItem = useCallback(async (id) => {
    if (!remoteStorage?.mymodule || !isConnected) {
      throw new Error("RemoteStorage is not connected")
    }

    isSavingRef.current = true

    try {
      await remoteStorage.mymodule.deleteItem(id)

      // Reload items list
      const updatedList = await remoteStorage.mymodule.getItemsList()
      setItemsList(updatedList)
    } catch (error) {
      console.error("Error deleting item:", error)
      throw error
    } finally {
      setTimeout(() => {
        isSavingRef.current = false
      }, 100)
    }
  }, [remoteStorage, isConnected])

  // ==================== SETTINGS METHODS ====================

  /**
   * Save settings
   * @param {Object} newSettings - Settings object to save
   */
  const saveSettings = useCallback(async (newSettings) => {
    if (!remoteStorage?.mymodule || !isConnected) {
      throw new Error("RemoteStorage is not connected")
    }

    isSavingRef.current = true

    try {
      // Optimistic update
      setSettings(newSettings)

      // Save to RemoteStorage
      await remoteStorage.mymodule.saveSettings(newSettings)
    } catch (error) {
      console.error("Error saving settings:", error)
      // Reload to get correct state
      await loadAllData()
      throw error
    } finally {
      setTimeout(() => {
        isSavingRef.current = false
      }, 100)
    }
  }, [remoteStorage, isConnected, loadAllData])

  /**
   * Save AI wallet configuration
   * @param {Object} config - AI wallet configuration object
   */
  const saveAiConfig = useCallback(async (config) => {
    if (!remoteStorage?.["ai-wallet"] || !isConnected) {
      throw new Error("RemoteStorage is not connected")
    }

    isSavingRef.current = true
    try {
      await remoteStorage["ai-wallet"].setConfig(config)
      setAiConfig(config)
    } catch (error) {
      console.error("Error saving AI wallet config:", error)
      throw error
    } finally {
      setTimeout(() => {
        isSavingRef.current = false
      }, 100)
    }
  }, [remoteStorage, isConnected])

  const connect = useCallback((userAddress) => {
    if (!remoteStorage?.connect) {
      throw new Error("RemoteStorage is not ready yet")
    }
    remoteStorage.connect(userAddress)
  }, [remoteStorage])

  const disconnect = useCallback(() => {
    if (!remoteStorage?.disconnect) return
    remoteStorage.disconnect()
  }, [remoteStorage])

  return {
    // State
    isLoading,
    isConnected,
    aiConfig,
    todos,
    stockItems,

    // Items
    items,
    itemsList,
    saveItem,
    loadItem,
    deleteItem,

    // Settings
    settings,
    saveSettings,

    // AI config
    saveAiConfig,

    // Connection controls
    connect,
    disconnect,

    // Utility
    reload: loadAllData
  }
}
