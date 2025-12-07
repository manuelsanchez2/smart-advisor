/**
 * RemoteStorage Todonna Module
 * 
 * A RemoteStorage.js data module for managing todo items using the Todonna format.
 * This module provides a clean API for CRUD operations on todos, handling all the
 * complexity of serialization, storage, and synchronization with RemoteStorage.
 * 
 * @example
 * ```typescript
 * import { Todonna } from '@/lib/remotestorage-todonna';
 * import RemoteStorage from 'remotestoragejs';
 * 
 * const rs = new RemoteStorage({ modules: [Todonna] });
 * rs.access.claim('todonna', 'rw');
 * 
 * const todonna = rs.todonna;
 * 
 * // Add a todo
 * await todonna.add({
 *   id: 'abc123',
 *   text: 'Buy groceries',
 *   completed: false,
 *   emoji: '🛒',
 *   date: new Date(),
 *   time: '15:00'
 * });
 * 
 * // Get all todos
 * const todos = await todonna.getAll();
 * 
 * // Update a todo
 * await todonna.update('abc123', { completed: true });
 * 
 * // Delete a todo
 * await todonna.remove('abc123');
 * ```
 */

import type { RSModule } from 'remotestoragejs';
import type { TodoItem } from '@/types';

/**
 * Re-export TodoItem for convenience
 */
export type { TodoItem } from '@/types';

/**
 * Todonna storage format as defined by the Todonna specification
 * @see https://github.com/remotestorage/modules/tree/master/todonna
 */
interface TodonnaItem {
  /** The todo item ID */
  todo_item_id?: string;
  /** The todo text */
  todo_item_text: string;
  /** The status of the todo item */
  todo_item_status?: "pending" | "done" | "archived";
  /** Optional emoji icon */
  emoji?: string;
  /** ISO date string for the target date */
  date?: string;
  /** Time in HH:mm format */
  time?: string;
  /** Allow additional custom fields */
  [key: string]: any;
}

/**
 * Options for loading todos
 */
export interface LoadOptions {
  /** Maximum age of cached data in milliseconds (default: 24 hours) */
  maxAge?: number;
  /** Whether to include soft-deleted (removed) todos (default: false) */
  includeRemoved?: boolean;
}

/**
 * Options for batch operations
 */
export interface BatchOperationOptions {
  /** Whether to stop on first error (default: false) */
  stopOnError?: boolean;
  /** Callback for progress updates */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Result of a batch operation
 */
export interface BatchResult {
  /** Number of successful operations */
  succeeded: number;
  /** Number of failed operations */
  failed: number;
  /** Array of errors that occurred */
  errors: Array<{ id: string; error: Error }>;
}

/**
 * RemoteStorage Todonna Module
 * 
 * Provides a clean, documented API for managing todos using RemoteStorage.js
 * and the Todonna format specification.
 */
export const Todonna: RSModule = {
  name: 'todonna',
  builder: function (privateClient, publicClient) {
    // Declare the Todonna type schema
    privateClient.declareType('todonna-item', {
      type: 'object',
      properties: {
        todo_item_id: {
          type: 'string',
          description: 'The unique identifier for the todo item',
        },
        todo_item_text: {
          type: 'string',
          description: 'The text content of the todo item',
        },
        todo_item_status: {
          type: 'string',
          enum: ['pending', 'done', 'archived'],
          default: 'pending',
          description: 'The status of the todo item',
        },
        emoji: {
          type: 'string',
          description: 'Optional emoji icon for the todo',
        },
        date: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 date string for the target date',
        },
        time: {
          type: 'string',
          pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
          description: 'Time in HH:mm format (24-hour)',
        },
      },
      required: ['todo_item_text'],
    });

    /**
     * Converts a TodoItem to Todonna storage format
     * Only includes fields with defined values to avoid schema validation errors
     */
    function toTodonnaItem(todo: TodoItem): TodonnaItem {
      const item: TodonnaItem = {
        todo_item_id: todo.id,
        todo_item_text: todo.text,
      };

      // Convert completed boolean to todo_item_status
      // TodoItem uses 'completed' boolean, but Todonna uses 'todo_item_status'
      if ('completed' in todo && todo.completed !== undefined) {
        item.todo_item_status = todo.completed ? 'done' : 'pending';
      } else if ('todo_item_status' in todo && todo.todo_item_status !== undefined) {
        // Support both formats for backwards compatibility
        item.todo_item_status = todo.todo_item_status;
      }

      if (todo.emoji !== undefined && todo.emoji !== '') {
        item.emoji = todo.emoji;
      }
      if (todo.date !== undefined) {
        item.date = todo.date instanceof Date ? todo.date.toISOString() : todo.date;
      }
      if (todo.time !== undefined && todo.time !== '') {
        item.time = todo.time;
      }

      return item;
    }

    /**
     * Converts Todonna storage format to TodoItem
     */
    function fromTodonnaItem(id: string, item: TodonnaItem): TodoItem {
      // Handle conversion from 'todo_item_status' to 'completed' boolean
      // Todonna uses status strings, but TodoItem uses completed boolean
      let completed = false;
      if (item.todo_item_status) {
        completed = item.todo_item_status === 'done';
      } else if ('completed' in item && (item as any).completed === true) {
        // Support legacy completed field
        completed = true;
      }
      
      return {
        id: item.todo_item_id || id, // Use todo_item_id if present, otherwise fall back to filename-based id
        text: item.todo_item_text,
        todo_item_status: completed ? 'done' : 'pending',
        emoji: item.emoji,
        date: item.date ? new Date(item.date) : new Date(),
        time: item.time,
        removed: false,
      };
    }

    return {
      exports: {
        /**
         * Add a new todo item to RemoteStorage
         * 
         * @param todo - The todo item to add
         * @returns Promise that resolves when the todo is stored
         * 
         * @example
         * ```typescript
         * await todonna.add({
         *   id: 'todo-123',
         *   text: 'Buy groceries',
         *   completed: false,
         *   emoji: '🛒',
         *   date: new Date('2025-11-08'),
         *   time: '15:00'
         * });
         * ```
         */
        add: async function (todo: TodoItem): Promise<void> {
          const item = toTodonnaItem(todo);
          await privateClient.storeObject('todonna-item', todo.id, item);
        },

        /**
         * Update an existing todo item
         * 
         * @param id - The ID of the todo to update
         * @param updates - Partial todo object with fields to update
         * @returns Promise that resolves when the todo is updated
         * 
         * @example
         * ```typescript
         * await todonna.update('todo-123', { 
         *   completed: true,
         *   text: 'Buy groceries (done!)' 
         * });
         * ```
         */
        update: async function (
          id: string,
          updates: Partial<Omit<TodoItem, 'id'>>
        ): Promise<void> {
          const existing = await privateClient.getObject(id, 0);

          if (!existing || typeof existing !== 'object') {
            throw new Error(`Todo with id ${id} not found`);
          }

          const currentTodo = fromTodonnaItem(id, existing as TodonnaItem);
          const updatedTodo = { ...currentTodo, ...updates, id };
          const item = toTodonnaItem(updatedTodo);

          await privateClient.storeObject('todonna-item', id, item);
        },

        /**
         * Remove a todo item from RemoteStorage
         * 
         * By default, this performs a hard delete. To soft-delete, use the `update` method
         * with `removed: true` instead.
         * 
         * @param id - The ID of the todo to remove
         * @returns Promise that resolves when the todo is removed
         * 
         * @example
         * ```typescript
         * // Hard delete
         * await todonna.remove('todo-123');
         * 
         * // Soft delete (mark as removed)
         * await todonna.update('todo-123', { removed: true });
         * ```
         */
        remove: async function (id: string): Promise<void> {
          await privateClient.remove(id);
        },

        /**
         * Get a specific todo item by ID
         * 
         * @param id - The ID of the todo to retrieve
         * @param maxAge - Optional cache max age in milliseconds
         * @returns Promise that resolves to the todo item, or null if not found
         * 
         * @example
         * ```typescript
         * const todo = await todonna.get('todo-123');
         * if (todo) {
         *   console.log(todo.text);
         * }
         * ```
         */
        get: async function (
          id: string,
          maxAge?: number
        ): Promise<TodoItem | null> {
          const item = await privateClient.getObject(id, maxAge);

          if (!item || typeof item !== 'object' || !('todo_item_text' in item)) {
            return null;
          }

          return fromTodonnaItem(id, item as TodonnaItem);
        },

        /**
         * Get all todo items from RemoteStorage
         * 
         * @param options - Options for loading todos
         * @returns Promise that resolves to an array of todo items
         * 
         * @example
         * ```typescript
         * // Get all active todos
         * const todos = await todonna.getAll();
         * 
         * // Get all todos including removed ones
         * const allTodos = await todonna.getAll({ includeRemoved: true });
         * 
         * // Use fresher cache (5 minutes)
         * const recentTodos = await todonna.getAll({ maxAge: 5 * 60 * 1000 });
         * ```
         */
        getAll: async function (options?: LoadOptions): Promise<TodoItem[]> {
          const maxAge = options?.maxAge ?? 1000 * 60 * 60 * 24; // 24 hours default
          const includeRemoved = options?.includeRemoved ?? false;

          const listing = await privateClient.getListing('', maxAge);

          if (!listing || typeof listing !== 'object') {
            return [];
          }

          const filenames = Object.keys(listing);
          const todos: TodoItem[] = [];

          // Load all todos in parallel
          const results = await Promise.allSettled(
            filenames.map(async (filename) => {
              const item = await privateClient.getObject(filename, maxAge);

              if (
                item &&
                typeof item === 'object' &&
                'todo_item_text' in item
              ) {
                return fromTodonnaItem(filename, item as TodonnaItem);
              }
              return null;
            })
          );

          // Filter out failed loads and null results
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              if (includeRemoved || !result.value.removed) {
                todos.push(result.value);
              }
            }
          }

          return todos;
        },

        /**
         * Get todos for a specific date
         * 
         * @param date - The date to filter by
         * @param options - Options for loading todos
         * @returns Promise that resolves to an array of todo items for the date
         * 
         * @example
         * ```typescript
         * const today = new Date();
         * const todayTodos = await todonna.getByDate(today);
         * ```
         */
        getByDate: async function (
          date: Date,
          options?: LoadOptions
        ): Promise<TodoItem[]> {
          const allTodos = await this.getAll(options);
          const targetDateStr = date.toDateString();

          return allTodos.filter((todo: TodoItem) => {
            const todoDate = new Date(todo.date);
            return todoDate.toDateString() === targetDateStr;
          });
        },

        /**
         * Batch add multiple todos
         * 
         * @param todos - Array of todos to add
         * @param options - Options for the batch operation
         * @returns Promise that resolves to batch operation result
         * 
         * @example
         * ```typescript
         * const result = await todonna.batchAdd([
         *   { id: '1', text: 'Task 1', completed: false, date: new Date() },
         *   { id: '2', text: 'Task 2', completed: false, date: new Date() }
         * ], {
         *   onProgress: (completed, total) => console.log(`${completed}/${total}`)
         * });
         * console.log(`Added ${result.succeeded} todos, ${result.failed} failed`);
         * ```
         */
        batchAdd: async function (
          todos: TodoItem[],
          options?: BatchOperationOptions
        ): Promise<BatchResult> {
          const result: BatchResult = {
            succeeded: 0,
            failed: 0,
            errors: [],
          };

          for (let i = 0; i < todos.length; i++) {
            try {
              await this.add(todos[i]);
              result.succeeded++;
              options?.onProgress?.(i + 1, todos.length);
            } catch (error) {
              result.failed++;
              result.errors.push({
                id: todos[i].id,
                error: error instanceof Error ? error : new Error(String(error)),
              });

              if (options?.stopOnError) {
                break;
              }
            }
          }

          return result;
        },

        /**
         * Batch update multiple todos
         * 
         * @param updates - Array of objects with id and updates
         * @param options - Options for the batch operation
         * @returns Promise that resolves to batch operation result
         * 
         * @example
         * ```typescript
         * const result = await todonna.batchUpdate([
         *   { id: '1', updates: { completed: true } },
         *   { id: '2', updates: { completed: true } }
         * ]);
         * ```
         */
        batchUpdate: async function (
          updates: Array<{ id: string; updates: Partial<Omit<TodoItem, 'id'>> }>,
          options?: BatchOperationOptions
        ): Promise<BatchResult> {
          const result: BatchResult = {
            succeeded: 0,
            failed: 0,
            errors: [],
          };

          for (let i = 0; i < updates.length; i++) {
            try {
              await this.update(updates[i].id, updates[i].updates);
              result.succeeded++;
              options?.onProgress?.(i + 1, updates.length);
            } catch (error) {
              result.failed++;
              result.errors.push({
                id: updates[i].id,
                error: error instanceof Error ? error : new Error(String(error)),
              });

              if (options?.stopOnError) {
                break;
              }
            }
          }

          return result;
        },

        /**
         * Batch remove multiple todos
         * 
         * @param ids - Array of todo IDs to remove
         * @param options - Options for the batch operation
         * @returns Promise that resolves to batch operation result
         * 
         * @example
         * ```typescript
         * const result = await todonna.batchRemove(['1', '2', '3']);
         * console.log(`Removed ${result.succeeded} todos`);
         * ```
         */
        batchRemove: async function (
          ids: string[],
          options?: BatchOperationOptions
        ): Promise<BatchResult> {
          const result: BatchResult = {
            succeeded: 0,
            failed: 0,
            errors: [],
          };

          for (let i = 0; i < ids.length; i++) {
            try {
              await this.remove(ids[i]);
              result.succeeded++;
              options?.onProgress?.(i + 1, ids.length);
            } catch (error) {
              result.failed++;
              result.errors.push({
                id: ids[i],
                error: error instanceof Error ? error : new Error(String(error)),
              });

              if (options?.stopOnError) {
                break;
              }
            }
          }

          return result;
        },

        /**
         * Clear all todos for a specific date
         * 
         * @param date - The date to clear todos for
         * @returns Promise that resolves to the number of todos cleared
         * 
         * @example
         * ```typescript
         * const today = new Date();
         * const cleared = await todonna.clearByDate(today);
         * console.log(`Cleared ${cleared} todos`);
         * ```
         */
        clearByDate: async function (date: Date): Promise<number> {
          const todos = await this.getByDate(date);
          const ids = todos.map((t: TodoItem) => t.id);
          const result = await this.batchRemove(ids);
          return result.succeeded;
        },

        /**
         * Clear completed todos for a specific date
         * 
         * @param date - The date to clear completed todos for
         * @returns Promise that resolves to the number of todos cleared
         * 
         * @example
         * ```typescript
         * const today = new Date();
         * const cleared = await todonna.clearCompletedByDate(today);
         * console.log(`Cleared ${cleared} completed todos`);
         * ```
         */
        clearCompletedByDate: async function (date: Date): Promise<number> {
          const todos = await this.getByDate(date);
          const completedIds = todos.filter((t: TodoItem) => t.todo_item_status === "done").map((t: TodoItem) => t.id);
          const result = await this.batchRemove(completedIds);
          return result.succeeded;
        },

        /**
         * Clear incomplete todos for a specific date
         * 
         * @param date - The date to clear incomplete todos for
         * @returns Promise that resolves to the number of todos cleared
         * 
         * @example
         * ```typescript
         * const today = new Date();
         * const cleared = await todonna.clearIncompleteByDate(today);
         * console.log(`Cleared ${cleared} incomplete todos`);
         * ```
         */
        clearIncompleteByDate: async function (date: Date): Promise<number> {
          const todos = await this.getByDate(date);
          const incompleteIds = todos
            .filter((t: TodoItem) => t.todo_item_status === "pending")
            .map((t: TodoItem) => t.id);
          const result = await this.batchRemove(incompleteIds);
          return result.succeeded;
        },

        /**
         * Replace all todos with a new set (useful for bulk sync operations)
         * 
         * This will remove all existing todos and add the new ones.
         * Use with caution as this is a destructive operation.
         * 
         * @param todos - Array of todos to replace with
         * @returns Promise that resolves to batch operation result
         * 
         * @example
         * ```typescript
         * const newTodos = [
         *   { id: '1', text: 'Task 1', completed: false, date: new Date() },
         *   { id: '2', text: 'Task 2', completed: false, date: new Date() }
         * ];
         * await todonna.replaceAll(newTodos);
         * ```
         */
        replaceAll: async function (todos: TodoItem[]): Promise<BatchResult> {
          // Get all existing todos
          const existing = await this.getAll({ includeRemoved: true });
          const existingIds = new Set(existing.map((t: TodoItem) => t.id));
          const newIds = new Set(todos.map((t: TodoItem) => t.id));

          // Determine what to add, update, and remove
          const toAdd = todos.filter((t: TodoItem) => !existingIds.has(t.id));
          const toUpdate = todos.filter((t: TodoItem) => existingIds.has(t.id));
          const toRemove = existing
            .filter((t: TodoItem) => !newIds.has(t.id))
            .map((t: TodoItem) => t.id);

          // Execute operations
          const [addResult, updateResult, removeResult] = await Promise.all([
            this.batchAdd(toAdd),
            this.batchUpdate(
              toUpdate.map((t: TodoItem) => ({ id: t.id, updates: t }))
            ),
            this.batchRemove(toRemove),
          ]);

          return {
            succeeded:
              addResult.succeeded +
              updateResult.succeeded +
              removeResult.succeeded,
            failed: addResult.failed + updateResult.failed + removeResult.failed,
            errors: [
              ...addResult.errors,
              ...updateResult.errors,
              ...removeResult.errors,
            ],
          };
        },

        /**
         * Count todos matching specific criteria
         * 
         * @param filter - Optional filter function
         * @returns Promise that resolves to the count
         * 
         * @example
         * ```typescript
         * // Count all todos
         * const total = await todonna.count();
         * 
         * // Count completed todos
         * const completed = await todonna.count(t => t.completed);
         * 
         * // Count todos for today
         * const today = new Date().toDateString();
         * const todayCount = await todonna.count(t => 
         *   new Date(t.date).toDateString() === today
         * );
         * ```
         */
        count: async function (
          filter?: (todo: TodoItem) => boolean
        ): Promise<number> {
          const todos = await this.getAll();
          return filter ? todos.filter(filter).length : todos.length;
        },
      },
    };
  },
};

