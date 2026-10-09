CREATE TABLE `event_ledger` (
	`world` text NOT NULL,
	`id` text NOT NULL,
	`minute` integer NOT NULL,
	`type` text NOT NULL,
	`location` text NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`world`, `id`),
	FOREIGN KEY (`world`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `actor_knowledge` (
	`world` text NOT NULL,
	`actor` text NOT NULL,
	`event` text NOT NULL,
	`acquired` integer NOT NULL,
	`status` text DEFAULT 'witnessed' NOT NULL,
	PRIMARY KEY(`world`, `actor`, `event`),
	FOREIGN KEY (`world`,`event`) REFERENCES `event_ledger`(`world`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sealed_truths` (
	`world` text NOT NULL,
	`id` text NOT NULL,
	`hash` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`world`, `id`),
	FOREIGN KEY (`world`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `turn_commits` (
	`world` text NOT NULL,
	`request` text NOT NULL,
	`revision` integer NOT NULL,
	`result` text NOT NULL,
	PRIMARY KEY(`world`, `request`),
	FOREIGN KEY (`world`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `turn_revision_unique` ON `turn_commits` (`world`,`revision`);--> statement-breakpoint
CREATE INDEX ledger_world_time ON event_ledger(world,minute);
--> statement-breakpoint
CREATE INDEX knowledge_actor_time ON actor_knowledge(world,actor,acquired);
--> statement-breakpoint
CREATE TRIGGER ledger_immutable_update BEFORE UPDATE ON event_ledger BEGIN SELECT RAISE(ABORT,'objective event immutable'); END;
--> statement-breakpoint
CREATE TRIGGER ledger_immutable_delete BEFORE DELETE ON event_ledger BEGIN SELECT RAISE(ABORT,'objective event immutable'); END;
--> statement-breakpoint
CREATE TRIGGER truth_immutable_update BEFORE UPDATE ON sealed_truths BEGIN SELECT RAISE(ABORT,'sealed truth immutable'); END;
--> statement-breakpoint
CREATE TRIGGER truth_immutable_delete BEFORE DELETE ON sealed_truths BEGIN SELECT RAISE(ABORT,'sealed truth immutable'); END;
