// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable, integer, text} from 'drizzle-orm/sqlite-core';
export const orgState=sqliteTable('org_state',{
 id:integer('id').primaryKey(),
 nodes:text('nodes').notNull(),
 history:text('history').notNull(),
 version:integer('version').notNull(),
 updatedAt:text('updated_at').notNull(),
});
