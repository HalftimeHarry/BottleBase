import {
	boolean,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	integer
} from 'drizzle-orm/pg-core';

export const inventoryModeEnum = pgEnum('inventory_mode', [
	'disabled',
	'simple-counts',
	'detailed-tracking'
]);

export const bars = pgTable('bars', {
	id: uuid('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const bottles = pgTable('bottles', {
	id: uuid('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').unique().notNull(),
	brand: text('brand').notNull(),
	category: text('category').notNull(),
	subcategory: text('subcategory'),
	origin: text('origin'),
	abv: numeric('abv', { precision: 5, scale: 2 }),
	description: text('description'),
	image: text('image').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const bottleAliases = pgTable('bottle_aliases', {
	id: uuid('id').primaryKey(),
	bottleId: uuid('bottle_id')
		.references(() => bottles.id, { onDelete: 'cascade' })
		.notNull(),
	alias: text('alias').notNull()
});

export const barBottles = pgTable('bar_bottles', {
	id: uuid('id').primaryKey(),
	barId: uuid('bar_id')
		.references(() => bars.id, { onDelete: 'cascade' })
		.notNull(),
	bottleId: uuid('bottle_id')
		.references(() => bottles.id, { onDelete: 'cascade' })
		.notNull(),
	displayName: text('display_name').notNull(),
	location: text('location'),
	notes: text('notes'),
	price: numeric('price', { precision: 12, scale: 2 }),
	isVisible: boolean('is_visible').default(true).notNull(),
	inventoryMode: inventoryModeEnum('inventory_mode').default('disabled').notNull(),
	currentCount: numeric('current_count', { precision: 10, scale: 2 }).default('0').notNull(),
	parLevel: numeric('par_level', { precision: 10, scale: 2 }).default('0').notNull(),
	reorderLevel: numeric('reorder_level', { precision: 10, scale: 2 }).default('0').notNull(),
	decimalIncrements: numeric('decimal_increments', { precision: 6, scale: 3 })
		.default('0.5')
		.notNull(),
	countUnit: text('count_unit').default('bottle').notNull(),
	packageSize: integer('package_size').default(1).notNull()
});

export const cocktails = pgTable('cocktails', {
	id: uuid('id').primaryKey(),
	name: text('name').notNull(),
	isHouseCocktail: boolean('is_house_cocktail').default(false).notNull()
});

export const ingredients = pgTable('ingredients', {
	id: uuid('id').primaryKey(),
	cocktailId: uuid('cocktail_id')
		.references(() => cocktails.id, { onDelete: 'cascade' })
		.notNull(),
	bottleId: uuid('bottle_id')
		.references(() => bottles.id, { onDelete: 'cascade' })
		.notNull(),
	amount: numeric('amount', { precision: 10, scale: 3 }).notNull(),
	unit: text('unit').notNull()
});

export * from './auth.schema';
