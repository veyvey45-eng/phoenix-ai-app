CREATE TABLE `agent_decisions` (
	`id` varchar(255) NOT NULL,
	`taskId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`decision` text NOT NULL,
	`reasoning` text NOT NULL,
	`options` json,
	`selectedOption` text,
	`outcome` enum('success','partial','failed','unknown') DEFAULT 'unknown',
	`feedback` text,
	`llmModel` varchar(100),
	`llmTokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_state` (
	`id` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`currentTaskId` varchar(255),
	`state` json,
	`lastCheckpointId` varchar(255),
	`lastCheckpointTime` timestamp,
	`isHealthy` boolean DEFAULT true,
	`lastHeartbeat` timestamp DEFAULT (now()),
	`crashCount` int DEFAULT 0,
	`lastCrashTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `autonomous_tasks` (
	`id` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`objective` text NOT NULL,
	`status` enum('pending','in_progress','completed','failed','paused') NOT NULL DEFAULT 'pending',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`steps` json,
	`currentStepIndex` int DEFAULT 0,
	`result` text,
	`errorMessage` text,
	`logs` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`estimatedDuration` int,
	`actualDuration` int,
	CONSTRAINT `autonomous_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_logs` (
	`id` varchar(255) NOT NULL,
	`taskId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`stepIndex` int,
	`stepId` varchar(255),
	`actionType` varchar(100) NOT NULL,
	`input` json,
	`output` json,
	`error` text,
	`startTime` timestamp DEFAULT (now()),
	`endTime` timestamp,
	`duration` int,
	`retryCount` int DEFAULT 0,
	`maxRetries` int DEFAULT 3,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `web_automation_sessions` (
	`id` varchar(255) NOT NULL,
	`taskId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(2048) NOT NULL,
	`objective` text NOT NULL,
	`actions` json,
	`extractedData` json,
	`screenshot` text,
	`status` enum('pending','in_progress','completed','failed') DEFAULT 'pending',
	`errorMessage` text,
	`startTime` timestamp DEFAULT (now()),
	`endTime` timestamp,
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `web_automation_sessions_id` PRIMARY KEY(`id`)
);
