// /**
//  * Example usage of the RemoteStorage Todonna Module
//  *
//  * This file demonstrates common patterns and best practices
//  * for using the Todonna module in your application.
//  */

// import type RemoteStorage from 'remotestoragejs';
// import { Todonna } from './remotestorage-todonna';
// import type { TodoItem } from '@/types';

// /**
//  * Initialize RemoteStorage with Todonna module
//  */
// export async function initializeRemoteStorage(): Promise<RemoteStorage> {
//   const RemoteStorageLib = (await import('remotestoragejs')).default;

//   const remoteStorage = new RemoteStorageLib({
//     modules: [Todonna]
//   });

//   // Claim access to the todonna scope
//   remoteStorage.access.claim('todonna', 'rw');

//   // Enable caching for better performance
//   remoteStorage.caching.enable('/todonna/');

//   return remoteStorage;
// }

// /**
//  * Example: Basic CRUD Operations
//  */
// export async function exampleBasicCRUD(remoteStorage: RemoteStorage) {
//   // Create a new todo
//   const newTodo: TodoItem = {
//     id: Math.random().toString(36).substring(7),
//     text: 'Buy groceries',
//     completed: false,
//     emoji: '🛒',
//     date: new Date(),
//     time: '15:00'
//   };

//   await remoteStorage.todonna.add(newTodo);
//   console.log('✅ Todo added');

//   // Read the todo
//   const todo = await remoteStorage.todonna.get(newTodo.id);
//   console.log('📖 Todo:', todo);

//   // Update the todo
//   await remoteStorage.todonna.update(newTodo.id, {
//     completed: true,
//     text: 'Buy groceries (organic)'
//   });
//   console.log('✏️ Todo updated');

//   // Delete the todo
//   await remoteStorage.todonna.remove(newTodo.id);
//   console.log('🗑️ Todo deleted');
// }

// /**
//  * Example: Working with Dates
//  */
// export async function exampleDateOperations(remoteStorage: RemoteStorage) {
//   // Add todos for today
//   const today = new Date();
//   await remoteStorage.todonna.add({
//     id: '1',
//     text: 'Morning meeting',
//     completed: false,
//     emoji: '📅',
//     date: today,
//     time: '09:00'
//   });

//   await remoteStorage.todonna.add({
//     id: '2',
//     text: 'Lunch with team',
//     completed: false,
//     emoji: '🍕',
//     date: today,
//     time: '12:00'
//   });

//   // Get all todos for today
//   const todayTodos = await remoteStorage.todonna.getByDate(today);
//   console.log(`📅 ${todayTodos.length} todos for today`);

//   // Clear completed todos for today
//   const cleared = await remoteStorage.todonna.clearCompletedByDate(today);
//   console.log(`🗑️ Cleared ${cleared} completed todos`);
// }

// /**
//  * Example: Batch Operations
//  */
// export async function exampleBatchOperations(remoteStorage: RemoteStorage) {
//   // Create multiple todos
//   const todos: TodoItem[] = [
//     {
//       id: '1',
//       text: 'Task 1',
//       completed: false,
//       date: new Date()
//     },
//     {
//       id: '2',
//       text: 'Task 2',
//       completed: false,
//       date: new Date()
//     },
//     {
//       id: '3',
//       text: 'Task 3',
//       completed: false,
//       date: new Date()
//     }
//   ];

//   // Add all todos at once
//   const addResult = await remoteStorage.todonna.batchAdd(todos, {
//     onProgress: (completed, total) => {
//       console.log(`Progress: ${completed}/${total}`);
//     }
//   });

//   console.log(`✅ Added ${addResult.succeeded} todos`);

//   // Mark all as completed
//   const updateResult = await remoteStorage.todonna.batchUpdate(
//     todos.map(t => ({ id: t.id, updates: { completed: true } }))
//   );

//   console.log(`✅ Updated ${updateResult.succeeded} todos`);

//   // Remove all
//   const removeResult = await remoteStorage.todonna.batchRemove(
//     todos.map(t => t.id)
//   );

//   console.log(`🗑️ Removed ${removeResult.succeeded} todos`);
// }

// /**
//  * Example: Optimistic Updates Pattern
//  */
// export async function exampleOptimisticUpdate(
//   remoteStorage: RemoteStorage,
//   todoId: string,
//   localTodos: TodoItem[],
//   setLocalTodos: (todos: TodoItem[]) => void
// ) {
//   // Save previous state for rollback
//   const previousTodos = [...localTodos];

//   try {
//     // 1. Update UI immediately (optimistic)
//     setLocalTodos(
//       localTodos.map(t =>
//         t.id === todoId ? { ...t, completed: true } : t
//       )
//     );

//     // 2. Persist to RemoteStorage in background
//     await remoteStorage.todonna.update(todoId, { completed: true });

//     console.log('✅ Update successful');
//   } catch (error) {
//     // 3. Rollback on error
//     setLocalTodos(previousTodos);
//     console.error('❌ Update failed, rolled back:', error);

//     // 4. Show user feedback
//     alert('Failed to update todo. Please try again.');
//   }
// }

// /**
//  * Example: Counting and Filtering
//  */
// export async function exampleCountingAndFiltering(remoteStorage: RemoteStorage) {
//   // Count all todos
//   const total = await remoteStorage.todonna.count();
//   console.log(`📊 Total todos: ${total}`);

//   // Count completed todos
//   const completed = await remoteStorage.todonna.count(t => t.completed);
//   console.log(`✅ Completed: ${completed}`);

//   // Count incomplete todos
//   const incomplete = await remoteStorage.todonna.count(t => !t.completed);
//   console.log(`⏳ Incomplete: ${incomplete}`);

//   // Count todos for today
//   const today = new Date().toDateString();
//   const todayCount = await remoteStorage.todonna.count(t =>
//     new Date(t.date).toDateString() === today
//   );
//   console.log(`📅 Today: ${todayCount}`);

//   // Count by emoji
//   const groceryCount = await remoteStorage.todonna.count(t =>
//     t.emoji === '🛒'
//   );
//   console.log(`🛒 Grocery todos: ${groceryCount}`);
// }

// /**
//  * Example: Bulk Sync (Replace All)
//  */
// export async function exampleBulkSync(
//   remoteStorage: RemoteStorage,
//   newTodos: TodoItem[]
// ) {
//   console.log('🔄 Starting bulk sync...');

//   const result = await remoteStorage.todonna.replaceAll(newTodos);

//   console.log(`✅ Synced successfully:`);
//   console.log(`  - ${result.succeeded} operations succeeded`);
//   console.log(`  - ${result.failed} operations failed`);

//   if (result.errors.length > 0) {
//     console.error('❌ Errors:', result.errors);
//   }
// }

// /**
//  * Example: Soft Delete vs Hard Delete
//  */
// export async function exampleDeleteStrategies(remoteStorage: RemoteStorage) {
//   const todoId = '123';

//   // Soft delete (mark as removed, can be recovered)
//   await remoteStorage.todonna.update(todoId, { removed: true });
//   console.log('🗑️ Todo soft-deleted (can be recovered)');

//   // Hard delete (permanent removal)
//   await remoteStorage.todonna.remove(todoId);
//   console.log('💥 Todo hard-deleted (permanent)');
// }

// /**
//  * Example: Custom Cache Strategy
//  */
// export async function exampleCacheStrategy(remoteStorage: RemoteStorage) {
//   // Use default cache (24 hours)
//   const cachedTodos = await remoteStorage.todonna.getAll();
//   console.log('📦 Loaded from cache');

//   // Force fresh data (bypass cache)
//   const freshTodos = await remoteStorage.todonna.getAll({ maxAge: 0 });
//   console.log('🔄 Loaded fresh data');

//   // Use 5-minute cache
//   const recentTodos = await remoteStorage.todonna.getAll({
//     maxAge: 5 * 60 * 1000
//   });
//   console.log('📦 Loaded from 5-minute cache');
// }

// /**
//  * Example: Error Handling Best Practices
//  */
// export async function exampleErrorHandling(remoteStorage: RemoteStorage) {
//   try {
//     await remoteStorage.todonna.update('non-existent-id', {
//       completed: true
//     });
//   } catch (error) {
//     if (error instanceof Error) {
//       if (error.message.includes('not found')) {
//         console.log('ℹ️ Todo not found, might have been deleted');
//       } else {
//         console.error('❌ Unexpected error:', error.message);
//         // Log to error tracking service
//         // Sentry.captureException(error);
//       }
//     }
//   }
// }

// /**
//  * Example: Progress Tracking for Large Operations
//  */
// export async function exampleProgressTracking(remoteStorage: RemoteStorage) {
//   const todos: TodoItem[] = Array.from({ length: 100 }, (_, i) => ({
//     id: String(i),
//     text: `Task ${i}`,
//     completed: false,
//     date: new Date()
//   }));

//   let progressBar = '';

//   const result = await remoteStorage.todonna.batchAdd(todos, {
//     onProgress: (completed, total) => {
//       const percentage = Math.round((completed / total) * 100);
//       progressBar = '█'.repeat(percentage / 5) + '░'.repeat(20 - percentage / 5);
//       console.log(`[${progressBar}] ${percentage}% (${completed}/${total})`);
//     }
//   });

//   console.log(`\n✅ Batch operation complete: ${result.succeeded} succeeded`);
// }

// /**
//  * Example: Integration with React State
//  */
// export function exampleReactIntegration() {
//   const code = `
// import { useState, useEffect } from 'react';
// import { useRemoteStorage } from '@/hooks/use-remote-storage';
// import type { TodoItem } from '@/lib/remotestorage-todonna';

// export function TodoList() {
//   const remoteStorage = useRemoteStorage();
//   const [todos, setTodos] = useState<TodoItem[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     if (!remoteStorage) return;

//     // Load todos on mount
//     remoteStorage.todonna.getAll()
//       .then(setTodos)
//       .finally(() => setLoading(false));

//     // Listen for changes
//     const handleChange = () => {
//       remoteStorage.todonna.getAll().then(setTodos);
//     };

//     remoteStorage.onChange('/todonna/', handleChange);
//   }, [remoteStorage]);

//   const handleToggle = async (id: string) => {
//     const todo = todos.find(t => t.id === id);
//     if (!todo || !remoteStorage) return;

//     // Optimistic update
//     setTodos(todos.map(t =>
//       t.id === id ? { ...t, completed: !t.completed } : t
//     ));

//     try {
//       await remoteStorage.todonna.update(id, {
//         completed: !todo.completed
//       });
//     } catch (error) {
//       // Rollback on error
//       setTodos(todos);
//       alert('Failed to update todo');
//     }
//   };

//   if (loading) return <div>Loading...</div>;

//   return (
//     <ul>
//       {todos.map(todo => (
//         <li key={todo.id}>
//           <input
//             type="checkbox"
//             checked={todo.completed}
//             onChange={() => handleToggle(todo.id)}
//           />
//           {todo.text}
//         </li>
//       ))}
//     </ul>
//   );
// }
//   `;

//   console.log('📝 React Integration Example:\n', code);
// }
