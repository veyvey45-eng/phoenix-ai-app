CREATE TABLE `actionRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tool` varchar(128) NOT NULL,
	`params` json,
	`scope` json,
	`riskLevel` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`requiresHumanOk` boolean NOT NULL DEFAULT false,
	`status` enum('pending','approved','rejected','executed') NOT NULL DEFAULT 'pending',
	`decisionId` int,
	`signature` varchar(128),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actionRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `actionResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionRequestId` int NOT NULL,
	`tool` varchar(128) NOT NULL,
	`output` text,
	`checks` json,
	`sideEffects` json,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`signature` varchar(128),
	`executionTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actionResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` enum('utterance_created','decision_made','issue_detected','issue_resolved','action_requested','action_executed','action_rejected','memory_stored','memory_retrieved','torment_updated','criteria_changed','security_violation','consolidation_run') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`details` json,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`contextId` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversations_contextId_unique` UNIQUE(`contextId`)
);
--> statement-breakpoint
CREATE TABLE `criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`level` enum('0','1','2') NOT NULL DEFAULT '1',
	`description` text,
	`rule` text NOT NULL,
	`weight` float NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`version` int NOT NULL DEFAULT 1,
	`changelog` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`options` json NOT NULL,
	`chosen` varchar(64) NOT NULL,
	`rationale` text NOT NULL,
	`criteriaSnapshot` json,
	`tormentBefore` float DEFAULT 0,
	`tormentAfter` float DEFAULT 0,
	`contextId` varchar(64),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('contradiction','hallucination','mismatch','error','uncertainty') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`evidence` text NOT NULL,
	`status` enum('open','investigating','resolved','deferred') NOT NULL DEFAULT 'open',
	`ttl` int DEFAULT 86400,
	`attempts` int DEFAULT 0,
	`resolution` text,
	`relatedUtteranceId` int,
	`relatedDecisionId` int,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` text NOT NULL,
	`embedding` json,
	`tags` json,
	`salience` float DEFAULT 0.5,
	`provenance` varchar(255),
	`memoryType` enum('fact','hypothesis','experience','rule') NOT NULL DEFAULT 'fact',
	`lastUsed` timestamp,
	`useCount` int DEFAULT 0,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phoenixState` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tormentScore` float NOT NULL DEFAULT 0,
	`activeHypotheses` json,
	`identityVersion` int NOT NULL DEFAULT 1,
	`lastConsolidation` timestamp,
	`openIssuesCount` int NOT NULL DEFAULT 0,
	`totalDecisions` int NOT NULL DEFAULT 0,
	`totalUtterances` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phoenixState_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `utterances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`contextId` varchar(64),
	`confidence` float DEFAULT 1,
	`sources` json,
	`decisionId` int,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `utterances_id` PRIMARY KEY(`id`)
);
