/**
 * RemoteStorage module for the "einkauf" scope.
 * Stores everything under /einkauf/stock/.
 */

export const EinkaufModule = {
  name: "einkauf",

  builder: function (privateClient, publicClient) {
    // ==================== TYPE DECLARATIONS ====================
    privateClient.declareType("item", {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        category: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string" },
        notes: { type: "string" },
        expirationDate: { type: ["string", "null"] },
        aiEstimation: {
          type: "object",
          properties: {
            status: { type: "string" },
            predictedDate: { type: ["string", "null"] },
            confidence: { type: ["number", "null"] },
            requestedAt: { type: "string" },
          },
        },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
      },
      required: ["id", "name", "category", "createdAt"],
    })

    privateClient.declareType("settings", {
      type: "object",
      properties: {
        theme: { type: "string" },
        language: { type: "string" },
        updated_at: { type: "string" },
      },
    })

    // ==================== EXPORTED METHODS ====================

    return {
      exports: {
        /**
         * Save an item
         * @param {Object} item - The item to save
         * @returns {Promise<void>}
         */
        saveItem: async function (item) {
          const timestamp = new Date().toISOString()
          const data = {
            ...item,
            updatedAt: timestamp,
          }

          // Save to RemoteStorage under /einkauf/stock/items/
          await privateClient.storeObject(
            "item",
            `stock/items/${item.id}.json`,
            data
          )

          // Update the items list metadata
          const itemsList = await this.getItemsList()
          const meta = {
            id: item.id,
            name: item.name,
            category: item.category,
            expirationDate: item.expirationDate || null,
            aiStatus: item.aiEstimation?.status || "none",
            updatedAt: timestamp,
          }

          const existingIndex = itemsList.findIndex((i) => i.id === item.id)

          if (existingIndex >= 0) {
            itemsList[existingIndex] = meta
          } else {
            itemsList.push(meta)
          }

          // Sort by updated date, newest first
          itemsList.sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
          )

          await privateClient.storeFile(
            "application/json",
            "stock/list.json",
            JSON.stringify(itemsList)
          )
        },

        /**
         * Load an item by ID
         * @param {string} id - The item ID
         * @returns {Promise<Object|null>}
         */
        loadItem: async function (id) {
          try {
            const data = await privateClient.getObject(`stock/items/${id}.json`)
            return data || null
          } catch (error) {
            if (isNotFoundError(error)) {
              return null
            }
            throw error
          }
        },

        /**
         * Get list of all items (metadata only)
         * @returns {Promise<Array>}
         */
        getItemsList: async function () {
          try {
            const file = await privateClient.getFile("stock/list.json")

            if (file && file.data) {
              const parsed =
                typeof file.data === "string"
                  ? JSON.parse(file.data)
                  : file.data
              return Array.isArray(parsed) ? parsed : []
            }

            return []
          } catch (error) {
            if (isNotFoundError(error)) {
              return []
            }
            console.error("Error loading items list:", error)
            return []
          }
        },

        /**
         * Delete an item by ID
         * @param {string} id - The item ID
         * @returns {Promise<void>}
         */
        deleteItem: async function (id) {
          try {
            // Remove the item file
            await privateClient.remove(`stock/items/${id}.json`)

            // Update the items list
            const itemsList = await this.getItemsList()
            const updatedList = itemsList.filter((i) => i.id !== id)

            // Save updated list
            await privateClient.storeFile(
              "application/json",
              "stock/list.json",
              JSON.stringify(updatedList)
            )
          } catch (error) {
            console.error("Error deleting item:", error)
            throw error
          }
        },

        // ==================== SETTINGS METHODS ====================

        /**
         * Save settings
         * @param {Object} settings - Settings object
         * @returns {Promise<void>}
         */
        saveSettings: async function (settings) {
          const data = {
            ...settings,
            updated_at: new Date().toISOString(),
          }
          await privateClient.storeObject(
            "settings",
            "stock/settings.json",
            data
          )
        },

        /**
         * Load settings
         * @returns {Promise<Object>}
         */
        loadSettings: async function () {
          const defaultSettings = {
            theme: "light",
            language: "de",
          }

          try {
            const data = await privateClient.getObject("stock/settings.json")
            return data ? { ...defaultSettings, ...data } : defaultSettings
          } catch (error) {
            if (isNotFoundError(error)) {
              return defaultSettings
            }
            console.error("Error loading settings:", error)
            return defaultSettings
          }
        },
      },
    }
  },
}

/**
 * Helper function to check if error is a "not found" error
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isNotFoundError(error) {
  return (
    error?.status === 404 ||
    error?.code === 404 ||
    error?.code === "NotFound" ||
    error?.name === "NotFoundError" ||
    (error?.message && error.message.includes("404")) ||
    (error?.message && error.message.includes("Not Found")) ||
    (error?.message && error.message.includes("Not a folder"))
  )
}
