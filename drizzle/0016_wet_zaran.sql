CREATE TABLE `agentCheckpoints` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`stepNumber` int NOT NULL,
	`state` json NOT NULL,
	`reason` varchar(255),
	`isAutomatic` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentCheckpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`data` json NOT NULL,
	`sequence` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`priority` int DEFAULT 0,
	`position` int NOT NULL,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`workerId` varchar(64),
	`queuedAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `agentQueue_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentQueue_taskId_unique` UNIQUE(`taskId`)
);
--> statement-breakpoint
CREATE TABLE `agentSteps` (
	`id` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`stepNumber` int NOT NULL,
	`type` enum('think','plan','tool_call','observe','answer','error','checkpoint') NOT NULL,
	`content` text,
	`thinking` text,
	`toolName` varchar(255),
	`toolArgs` json,
	`toolResult` json,
	`status` enum('pending','executing','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `agentSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentTasks` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`goal` text NOT NULL,
	`config` json,
	`status` enum('pending','running','paused','waiting','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`currentPhase` varchar(255),
	`currentIteration` int DEFAULT 0,
	`totalToolCalls` int DEFAULT 0,
	`result` text,
	`error` text,
	`workingMemory` json,
	`artifacts` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`lastCheckpointAt` timestamp,
	CONSTRAINT `agentTasks_id` PRIMARY KEY(`id`)
);
