CREATE TABLE `sandbox_checkpoints` (
	`id` varchar(255) NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`data` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sandbox_checkpoints_id` PRIMARY KEY(`id`)
);
