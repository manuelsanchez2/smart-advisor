/**
 * Lightweight RemoteStorage module for the Todonna todos scope.
 * Focuses on reading todos so the Smart Advisor can reason over them.
 */

export const TodonnaModule = {
  name: "todonna",

  builder: function (privateClient, publicClient) {
    // Schema aligned with the Todonna spec
    privateClient.declareType("todonna-item", {
      type: "object",
      properties: {
        todo_item_id: { type: "string" },
        todo_item_text: { type: "string" },
        todo_item_status: { type: "string", enum: ["pending", "done", "archived"] },
        emoji: { type: "string" },
        date: { type: "string", format: "date-time" },
        time: { type: "string" },
        removed: { type: "boolean" }
      },
      required: ["todo_item_text"]
    })

    const toStorage = (todo) => {
      return {
        todo_item_id: todo.id,
        todo_item_text: todo.text,
        todo_item_status: todo.todo_item_status || (todo.completed ? "done" : "pending"),
        emoji: todo.emoji,
        date: todo.date ? new Date(todo.date).toISOString() : undefined,
        time: todo.time,
        removed: todo.removed || false
      }
    }

    const fromStorage = (id, stored) => {
      return {
        id: stored.todo_item_id || id,
        text: stored.todo_item_text,
        todo_item_status: stored.todo_item_status || "pending",
        emoji: stored.emoji,
        date: stored.date,
        time: stored.time,
        removed: stored.removed || false
      }
    }

    const isNotFoundError = (error) =>
      error?.status === 404 ||
      error?.code === 404 ||
      error?.name === "NotFoundError" ||
      (typeof error?.message === "string" && error.message.includes("Not Found"))

    return {
      exports: {
        add: async function (todo) {
          const payload = toStorage(todo)
          await privateClient.storeObject("todonna-item", todo.id, payload)
        },

        update: async function (id, updates) {
          const existing = await this.get(id)
          if (!existing) throw new Error("Todo not found")
          const payload = toStorage({ ...existing, ...updates, id })
          await privateClient.storeObject("todonna-item", id, payload)
        },

        remove: async function (id) {
          await privateClient.remove(id)
        },

        get: async function (id, maxAge) {
          try {
            const stored = await privateClient.getObject(id, maxAge)
            if (!stored) return null
            return fromStorage(id, stored)
          } catch (error) {
            if (isNotFoundError(error)) return null
            throw error
          }
        },

        getAll: async function ({ maxAge = 1000 * 60 * 60 * 24, includeRemoved = false } = {}) {
          const listing = await privateClient.getListing("", maxAge)
          if (!listing || typeof listing !== "object") return []

          const entries = await Promise.all(
            Object.keys(listing).map(async (key) => {
              try {
                const stored = await privateClient.getObject(key, maxAge)
                if (!stored || typeof stored !== "object") return null
                return fromStorage(key, stored)
              } catch (error) {
                if (isNotFoundError(error)) return null
                throw error
              }
            })
          )

          return entries.filter(Boolean).filter((todo) => includeRemoved || !todo.removed)
        }
      }
    }
  }
}
