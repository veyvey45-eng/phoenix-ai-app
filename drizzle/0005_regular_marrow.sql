CREATE TABLE `document_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkId` int,
	`accessType` enum('view','search','rag_query','download') NOT NULL,
	`query` text,
	`relevanceScore` float,
	`userId` int,
	`contextId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`pageNumber` int,
	`sectionTitle` varchar(255),
	`priority` enum('H0','H1','H2','H3') NOT NULL DEFAULT 'H2',
	`embedding` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_concepts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`definition` text,
	`priority` enum('H0','H1','H2','H3') NOT NULL DEFAULT 'H2',
	`sourceDocumentId` int,
	`sourceChunkId` int,
	`relatedConcepts` json,
	`tags` json,
	`confidence` float DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_concepts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reference_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100) DEFAULT 'application/pdf',
	`priority` enum('H0','H1','H2','H3') NOT NULL DEFAULT 'H2',
	`category` varchar(100),
	`tags` json,
	`isIndexed` boolean DEFAULT false,
	`indexedAt` timestamp,
	`uploadedBy` int NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`status` enum('pending','approved','rejected','archived') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reference_documents_id` PRIMARY KEY(`id`)
);
