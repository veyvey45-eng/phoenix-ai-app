CREATE TABLE `user_files` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`storageUrl` text NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`extractedText` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_files_id` PRIMARY KEY(`id`)
);
