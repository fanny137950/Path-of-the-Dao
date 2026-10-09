CREATE TABLE `saves` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`world` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text NOT NULL,
	`created` text NOT NULL
);
