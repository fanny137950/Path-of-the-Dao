CREATE TABLE IF NOT EXISTS `story_messages` (
	`world` text NOT NULL,
	`id` text NOT NULL,
	`seq` integer NOT NULL,
	`minute` integer NOT NULL,
	`location` text NOT NULL,
	`speaker` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`audience` text NOT NULL,
	`event` text,
	PRIMARY KEY(`world`, `id`),
	FOREIGN KEY (`world`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `story_message_sequence` ON `story_messages` (`world`,`seq`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `story_requests` (
	`world` text NOT NULL,
	`request` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text NOT NULL,
	`lease` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL,
	`prepared` text,
	PRIMARY KEY(`world`, `request`),
	FOREIGN KEY (`world`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS story_messages_no_update BEFORE UPDATE ON story_messages BEGIN SELECT RAISE(ABORT, 'dialogue history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS story_messages_no_delete BEFORE DELETE ON story_messages BEGIN SELECT RAISE(ABORT, 'dialogue history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS story_commit_guard BEFORE INSERT ON turn_commits WHEN (SELECT json_extract(iif(json_valid(state),state,'{}'),'$.mode') FROM worlds WHERE id=NEW.world)='story-v1' AND NOT EXISTS (SELECT 1 FROM worlds w JOIN story_requests r ON r.world=w.id WHERE w.id=NEW.world AND w.revision+1=NEW.revision AND r.request=NEW.request AND r.status='processing' AND r.lease=json_extract(NEW.result,'$.lease') AND r.expires>unixepoch()*1000) BEGIN SELECT RAISE(ABORT, 'story revision or lease conflict'); END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS story_request_status ON story_requests(world,status,expires);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS story_event_time ON event_ledger(world,minute);
