CREATE TABLE `phoenixProjectFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`path` varchar(512) NOT NULL,
	`content` text,
	`contentUrl` varchar(512),
	`fileType` enum('text','binary','image','other') NOT NULL DEFAULT 'text',
	`mimeType` varchar(128),
	`size` int DEFAULT 0,
	`encoding` varchar(32) DEFAULT 'utf-8',
	`version` int DEFAULT 1,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phoenixProjectFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phoenixProjectLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int,
	`action` enum('create','update','delete','restore','start_preview','stop_preview','sync_to_db','sync_from_db','create_snapshot','restore_snapshot','download','upload') NOT NULL,
	`details` json,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phoenixProjectLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phoenixProjectSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255),
	`description` text,
	`filesJson` json,
	`totalFiles` int DEFAULT 0,
	`totalSize` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phoenixProjectSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phoenixProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`projectType` enum('static','nodejs','python','react','nextjs','other') NOT NULL DEFAULT 'static',
	`status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`sandboxId` varchar(255),
	`sandboxExpiresAt` timestamp,
	`previewUrl` varchar(512),
	`previewPort` int,
	`isPreviewActive` boolean NOT NULL DEFAULT false,
	`totalFiles` int DEFAULT 0,
	`totalSize` int DEFAULT 0,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phoenixProjects_id` PRIMARY KEY(`id`)
);
