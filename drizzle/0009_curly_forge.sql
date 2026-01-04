CREATE TABLE `stripeCustomers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeCustomerId` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeCustomers_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeCustomers_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `stripeCustomers_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`)
);
--> statement-breakpoint
CREATE TABLE `stripePayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripePaymentIntentId` varchar(255) NOT NULL,
	`stripeInvoiceId` varchar(255),
	`amount` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'usd',
	`status` enum('succeeded','processing','requires_payment_method','requires_confirmation','requires_action','canceled') NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripePayments_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripePayments_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`)
);
--> statement-breakpoint
CREATE TABLE `stripeSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeSubscriptionId` varchar(255) NOT NULL,
	`stripePriceId` varchar(255) NOT NULL,
	`status` enum('active','past_due','unpaid','canceled','incomplete','incomplete_expired','trialing') NOT NULL,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`canceledAt` timestamp,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeSubscriptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
