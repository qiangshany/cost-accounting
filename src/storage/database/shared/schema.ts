import { pgTable, serial, timestamp, index, unique, varchar, date, jsonb, real, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const costReports = pgTable("cost_reports", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	product: varchar({ length: 50 }).notNull(),
	reportDate: date("report_date").notNull(),
	workshop: varchar({ length: 50 }).notNull(),
	materials: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	laborAndMaintenance: jsonb("labor_and_maintenance"),
	periodExpenses: jsonb("period_expenses"),
	adjustments: jsonb(),
	alkaliYield: real("alkali_yield"),
	chlorineYield: real("chlorine_yield"),
	hydrochloricAcidYield: real("hydrochloric_acid_yield"),
}, (table) => [
	index("cost_reports_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("cost_reports_product_workshop_date_unique").on(table.product, table.reportDate, table.workshop),
]);

export const laborMaintenanceCosts = pgTable("labor_maintenance_costs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	costItemName: varchar("cost_item_name", { length: 100 }).notNull(),
	product: varchar({ length: 50 }).notNull(),
	workshop: varchar({ length: 50 }).notNull(),
	amount: numeric({ precision: 20, scale:  10 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("labor_maintenance_costs_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("labor_maintenance_costs_unique_key").on(table.reportDate, table.costItemName, table.product, table.workshop),
]);

export const adjustments = pgTable("adjustments", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	adjustmentName: varchar("adjustment_name", { length: 100 }).notNull(),
	product: varchar({ length: 50 }).notNull(),
	amount: numeric({ precision: 20, scale:  10 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("adjustments_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("adjustments_unique_key").on(table.reportDate, table.adjustmentName, table.product),
]);

export const materialCosts = pgTable("material_costs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	materialName: varchar("material_name", { length: 100 }).notNull(),
	product: varchar({ length: 50 }).notNull(),
	workshop: varchar({ length: 50 }).notNull(),
	quantity: numeric({ precision: 20, scale:  10 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("material_costs_material_name_idx").using("btree", table.materialName.asc().nullsLast().op("text_ops")),
	index("material_costs_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("material_costs_unique_key").on(table.reportDate, table.materialName, table.product, table.workshop),
]);

export const periodExpenses = pgTable("period_expenses", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	expenseItemName: varchar("expense_item_name", { length: 100 }).notNull(),
	product: varchar({ length: 50 }).notNull(),
	amount: numeric({ precision: 20, scale:  10 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("period_expenses_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("period_expenses_unique_key").on(table.reportDate, table.expenseItemName, table.product),
]);

export const purchasePrices = pgTable("purchase_prices", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	materialName: varchar("material_name", { length: 100 }).notNull(),
	price: numeric({ precision: 20, scale:  10 }).notNull(),
	unit: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("purchase_prices_material_name_idx").using("btree", table.materialName.asc().nullsLast().op("text_ops")),
	index("purchase_prices_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("purchase_prices_unique_key").on(table.reportDate, table.materialName),
]);

export const productionYields = pgTable("production_yields", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	reportDate: date("report_date").notNull(),
	product: varchar({ length: 50 }).notNull(),
	workshop: varchar({ length: 50 }).notNull(),
	yield32Percent: numeric("yield_32_percent", { precision: 20, scale: 10 }), // 32%烧碱产量
	yield50Percent: numeric("yield_50_percent", { precision: 20, scale: 10 }), // 50%烧碱产量
	chlorineYield: numeric("chlorine_yield", { precision: 20, scale:  10 }),
	hydrochloricAcidYield: numeric("hydrochloric_acid_yield", { precision: 20, scale:  10 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("production_yields_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
	unique("production_yields_date_workshop_product_unique").on(table.reportDate, table.product, table.workshop),
]);
