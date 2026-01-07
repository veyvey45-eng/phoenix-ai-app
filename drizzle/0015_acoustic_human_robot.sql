CREATE TABLE `hostedSites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`siteType` enum('landing','portfolio','business','ecommerce','blog','custom') NOT NULL DEFAULT 'custom',
	`htmlContent` text NOT NULL,
	`cssContent` text,
	`jsContent` text,
	`isPublic` boolean NOT NULL DEFAULT true,
	`customDomain` varchar(255),
	`viewCount` int DEFAULT 0,
	`lastViewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hostedSites_id` PRIMARY KEY(`id`),
	CONSTRAINT `hostedSites_slug_unique` UNIQUE(`slug`)
);
