/**
 * Schéma E2B - Tables pour l'historique et les webhooks
 */

import { mysqlTable, int, text, varchar, timestamp, index, float } from 'drizzle-orm/mysql-core';

/**
 * Historique des exécutions E2B
 */
export const executionHistory = mysqlTable(
  'execution_history',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    conversationId: varchar('conversation_id', { length: 64 }),
    sandboxId: varchar('sandbox_id', { length: 128 }).notNull(),
    language: varchar('language', { length: 20 }).notNull(), // python, node, shell
    code: text('code').notNull(),
    success: int('success', { mode: 'boolean' }).notNull(),
    stdout: text('stdout'),
    stderr: text('stderr'),
    exitCode: int('exit_code'),
    duration: int('duration').notNull(), // en ms
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at').notNull(),
    fileInputs: text('file_inputs'), // JSON array
    fileOutputs: text('file_outputs'), // JSON array
    metadata: text('metadata'), // JSON
    tags: text('tags'), // JSON array
  },
  (table) => ({
    userIdIdx: index('execution_history_user_id_idx').on(table.userId),
    conversationIdIdx: index('execution_history_conversation_id_idx').on(table.conversationId),
    sandboxIdIdx: index('execution_history_sandbox_id_idx').on(table.sandboxId),
    startedAtIdx: index('execution_history_started_at_idx').on(table.startedAt),
  })
);

/**
 * Webhooks E2B pour les notifications asynchrones
 */
export const e2bWebhooks = mysqlTable(
  'e2b_webhooks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    executionId: varchar('execution_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 50 }).notNull(), // execution_started, execution_completed, execution_failed, timeout
    payload: text('payload').notNull(), // JSON
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, delivered, failed
    retries: int('retries').default(0),
    maxRetries: int('max_retries').default(3),
    nextRetryAt: timestamp('next_retry_at'),
    createdAt: timestamp('created_at').notNull(),
    deliveredAt: timestamp('delivered_at'),
    error: text('error'),
  },
  (table) => ({
    userIdIdx: index('e2b_webhooks_user_id_idx').on(table.userId),
    executionIdIdx: index('e2b_webhooks_execution_id_idx').on(table.executionId),
    statusIdx: index('e2b_webhooks_status_idx').on(table.status),
  })
);

/**
 * Patterns d'utilisation pour l'analyse
 */
export const executionPatterns = mysqlTable(
  'execution_patterns',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    language: varchar('language', { length: 20 }).notNull(), // python, node, shell
    pattern: varchar('pattern', { length: 255 }).notNull(), // data_analysis, web_scraping, etc
    frequency: int('frequency').notNull(),
    averageDuration: float('average_duration').notNull(), // en ms
    successRate: float('success_rate').notNull(), // 0-1
    lastUsedAt: timestamp('last_used_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    metadata: text('metadata'), // JSON
  },
  (table) => ({
    userIdIdx: index('execution_patterns_user_id_idx').on(table.userId),
    languageIdx: index('execution_patterns_language_idx').on(table.language),
  })
);

/**
 * Cache des résultats pour la rejoue
 */
export const executionCache = mysqlTable(
  'execution_cache',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(), // SHA256
    language: varchar('language', { length: 20 }).notNull(),
    result: text('result').notNull(), // JSON
    ttl: int('ttl').notNull(), // en secondes
    createdAt: timestamp('created_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    userIdIdx: index('execution_cache_user_id_idx').on(table.userId),
    codeHashIdx: index('execution_cache_code_hash_idx').on(table.codeHash),
    expiresAtIdx: index('execution_cache_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Statistiques d'utilisation par jour
 */
export const executionStats = mysqlTable(
  'execution_stats',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: int('user_id').notNull(),
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    totalExecutions: int('total_executions').default(0),
    successfulExecutions: int('successful_executions').default(0),
    failedExecutions: int('failed_executions').default(0),
    totalDuration: int('total_duration').default(0), // en ms
    averageDuration: float('average_duration').default(0),
    pythonCount: int('python_count').default(0),
    nodeCount: int('node_count').default(0),
    shellCount: int('shell_count').default(0),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => ({
    userIdDateIdx: index('execution_stats_user_id_date_idx').on(table.userId, table.date),
  })
);

export type ExecutionHistory = typeof executionHistory.$inferSelect;
export type ExecutionHistoryInsert = typeof executionHistory.$inferInsert;
export type E2BWebhook = typeof e2bWebhooks.$inferSelect;
export type E2BWebhookInsert = typeof e2bWebhooks.$inferInsert;
export type ExecutionPattern = typeof executionPatterns.$inferSelect;
export type ExecutionPatternInsert = typeof executionPatterns.$inferInsert;
export type ExecutionCache = typeof executionCache.$inferSelect;
export type ExecutionCacheInsert = typeof executionCache.$inferInsert;
export type ExecutionStats = typeof executionStats.$inferSelect;
export type ExecutionStatsInsert = typeof executionStats.$inferInsert;
