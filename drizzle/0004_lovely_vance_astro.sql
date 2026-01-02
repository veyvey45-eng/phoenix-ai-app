CREATE TABLE `adminAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` int,
	`changes` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`validationId` int NOT NULL,
	`decisionId` int,
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`requestedBy` int NOT NULL,
	`approvedBy` int,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `approvalRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moduleConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moduleId` varchar(64) NOT NULL,
	`moduleName` varchar(128) NOT NULL,
	`description` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`config` json,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `moduleConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `moduleConfigs_moduleId_unique` UNIQUE(`moduleId`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`category` enum('axiom_validation','module_config','audit_access','user_management','system_config') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `rolePermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('admin','user','viewer') NOT NULL,
	`permissionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rolePermissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sensitiveValidations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`axiomId` varchar(64) NOT NULL,
	`axiomName` varchar(255) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`description` text,
	`requiresApproval` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sensitiveValidations_id` PRIMARY KEY(`id`)
);
