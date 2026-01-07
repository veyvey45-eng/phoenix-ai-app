import { mysqlTable, int, varchar, text, timestamp, json, boolean, mysqlEnum, float } from "drizzle-orm/mysql-core";

// ============================================================================
// PHOENIX PROJECTS - Système de Persistance des Projets
// ============================================================================

/**
 * PHOENIX PROJECT - Projet créé par Phoenix
 * Stocke les métadonnées du projet et son état
 */
export const phoenixProjects = mysqlTable("phoenixProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  projectType: mysqlEnum("projectType", ["static", "nodejs", "python", "react", "nextjs", "other"]).default("static").notNull(),
  status: mysqlEnum("status", ["active", "archived", "deleted"]).default("active").notNull(),
  
  // Sandbox E2B
  sandboxId: varchar("sandboxId", { length: 255 }), // ID du sandbox E2B actif
  sandboxExpiresAt: timestamp("sandboxExpiresAt"), // Quand le sandbox expire
  
  // Preview
  previewUrl: varchar("previewUrl", { length: 512 }), // URL publique du preview
  previewPort: int("previewPort"), // Port utilisé pour le preview
  isPreviewActive: boolean("isPreviewActive").default(false).notNull(),
  
  // Métadonnées
  totalFiles: int("totalFiles").default(0),
  totalSize: int("totalSize").default(0), // Taille totale en bytes
  lastSyncedAt: timestamp("lastSyncedAt"), // Dernière synchronisation avec E2B
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhoenixProject = typeof phoenixProjects.$inferSelect;
export type InsertPhoenixProject = typeof phoenixProjects.$inferInsert;

/**
 * PHOENIX PROJECT FILE - Fichier d'un projet
 * Stocke le contenu des fichiers pour la persistance
 */
export const phoenixProjectFiles = mysqlTable("phoenixProjectFiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  
  // Chemin et contenu
  path: varchar("path", { length: 512 }).notNull(), // Chemin relatif dans le projet
  content: text("content"), // Contenu du fichier (pour fichiers texte)
  contentUrl: varchar("contentUrl", { length: 512 }), // URL S3 pour fichiers binaires
  
  // Métadonnées
  fileType: mysqlEnum("fileType", ["text", "binary", "image", "other"]).default("text").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  size: int("size").default(0), // Taille en bytes
  encoding: varchar("encoding", { length: 32 }).default("utf-8"),
  
  // Versioning
  version: int("version").default(1),
  isDeleted: boolean("isDeleted").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhoenixProjectFile = typeof phoenixProjectFiles.$inferSelect;
export type InsertPhoenixProjectFile = typeof phoenixProjectFiles.$inferInsert;

/**
 * PHOENIX PROJECT SNAPSHOT - Snapshot d'un projet
 * Permet de sauvegarder l'état complet d'un projet à un moment donné
 */
export const phoenixProjectSnapshots = mysqlTable("phoenixProjectSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  
  // Métadonnées
  name: varchar("name", { length: 255 }), // Nom optionnel du snapshot
  description: text("description"),
  
  // Contenu compressé
  filesJson: json("filesJson").$type<Array<{
    path: string;
    content: string;
    mimeType: string;
    size: number;
  }>>(), // Tous les fichiers en JSON
  
  // Statistiques
  totalFiles: int("totalFiles").default(0),
  totalSize: int("totalSize").default(0),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PhoenixProjectSnapshot = typeof phoenixProjectSnapshots.$inferSelect;
export type InsertPhoenixProjectSnapshot = typeof phoenixProjectSnapshots.$inferInsert;

/**
 * PHOENIX PROJECT LOG - Journal des actions sur un projet
 * Trace toutes les opérations effectuées
 */
export const phoenixProjectLogs = mysqlTable("phoenixProjectLogs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId"),
  
  // Action
  action: mysqlEnum("action", [
    "create", "update", "delete", "restore",
    "start_preview", "stop_preview",
    "sync_to_db", "sync_from_db",
    "create_snapshot", "restore_snapshot",
    "download", "upload"
  ]).notNull(),
  
  // Détails
  details: json("details").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PhoenixProjectLog = typeof phoenixProjectLogs.$inferSelect;
export type InsertPhoenixProjectLog = typeof phoenixProjectLogs.$inferInsert;
