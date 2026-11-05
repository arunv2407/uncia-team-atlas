CREATE TABLE `org_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`nodes` text NOT NULL,
	`history` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` text NOT NULL
);
