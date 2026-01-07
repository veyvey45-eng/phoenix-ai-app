CREATE TABLE `workspace_file_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`content` text,
	`storageKey` varchar(512),
	`version` int NOT NULL,
	`changeType` enum('create','edit','delete','rename') NOT NULL,
	`changeDescription` text,
	`changedBy` enum('user','agent') DEFAULT 'agent',
	`diffPatch` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspace_file_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`path` varchar(1024) NOT NULL,
	`name` varchar(255) NOT NULL,
	`fileType` enum('file','directory') NOT NULL DEFAULT 'file',
	`mimeType` varchar(100),
	`size` int DEFAULT 0,
	`content` text,
	`storageKey` varchar(512),
	`storageUrl` text,
	`language` varchar(50),
	`encoding` varchar(20) DEFAULT 'utf-8',
	`lineCount` int,
	`version` int DEFAULT 1,
	`lastModifiedBy` enum('user','agent') DEFAULT 'agent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_files_id` PRIMARY KEY(`id`)
);
