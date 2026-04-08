import { pgTable, serial, timestamp, index, unique, varchar, date, jsonb, real, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 产量数据表
export const productionYields = pgTable(
  "production_yields",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    product: varchar({ length: 50 }).notNull(),
    workshop: varchar({ length: 50 }).notNull(),
    alkaliYield: numeric("alkali_yield"), // 碱产量
    chlorineYield: numeric("chlorine_yield"), // 氯产量
    hydrochloricAcidYield: numeric("hydrochloric_acid_yield"), // 盐酸产量
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    unique("production_yields_date_workshop_product_unique").on(table.reportDate, table.workshop, table.product),
    index("production_yields_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
  ]
);

// 原材料成本表（车间填报数量）
export const materialCosts = pgTable(
  "material_costs",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    materialName: varchar("material_name", { length: 100 }).notNull(),
    product: varchar({ length: 50 }).notNull(),
    workshop: varchar({ length: 50 }).notNull(),
    quantity: numeric().notNull(), // 数量
    unit: varchar({ length: 20 }).notNull(), // 单位
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // 主键约束：日期 + 成本项目 + 车间 + 产品
    unique("material_costs_unique_key").on(table.reportDate, table.materialName, table.workshop, table.product),
    index("material_costs_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
    index("material_costs_material_name_idx").using("btree", table.materialName.asc().nullsLast().op("text_ops")),
  ]
);

// 采购单价表（采购部填报单价）
export const purchasePrices = pgTable(
  "purchase_prices",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    materialName: varchar("material_name", { length: 100 }).notNull(),
    price: numeric().notNull(), // 单价
    unit: varchar({ length: 20 }).notNull(), // 单位
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // 主键约束：日期 + 成本项目
    unique("purchase_prices_unique_key").on(table.reportDate, table.materialName),
    index("purchase_prices_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
    index("purchase_prices_material_name_idx").using("btree", table.materialName.asc().nullsLast().op("text_ops")),
  ]
);

// 人工与维护成本表
export const laborMaintenanceCosts = pgTable(
  "labor_maintenance_costs",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    costItemName: varchar("cost_item_name", { length: 100 }).notNull(),
    product: varchar({ length: 50 }).notNull(),
    workshop: varchar({ length: 50 }).notNull(),
    amount: numeric().notNull(), // 金额
    unit: varchar({ length: 20 }).notNull(), // 单位
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // 主键约束：日期 + 成本项目 + 车间 + 产品
    unique("labor_maintenance_costs_unique_key").on(table.reportDate, table.costItemName, table.workshop, table.product),
    index("labor_maintenance_costs_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
  ]
);

// 期间费用表（生产管理部填报，不分车间）
export const periodExpenses = pgTable(
  "period_expenses",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    expenseItemName: varchar("expense_item_name", { length: 100 }).notNull(),
    product: varchar({ length: 50 }).notNull(),
    amount: numeric().notNull(), // 金额
    unit: varchar({ length: 20 }).notNull(), // 单位
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // 主键约束：日期 + 费用项目 + 产品
    unique("period_expenses_unique_key").on(table.reportDate, table.expenseItemName, table.product),
    index("period_expenses_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
  ]
);

// 调整项表（生产管理部填报，不分车间）
export const adjustments = pgTable(
  "adjustments",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    reportDate: date("report_date").notNull(),
    adjustmentName: varchar("adjustment_name", { length: 100 }).notNull(),
    product: varchar({ length: 50 }).notNull(),
    amount: numeric().notNull(), // 金额
    unit: varchar({ length: 20 }).notNull(), // 单位
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    // 主键约束：日期 + 调整项目 + 产品
    unique("adjustments_unique_key").on(table.reportDate, table.adjustmentName, table.product),
    index("adjustments_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
  ]
);

// 保留旧表结构以便数据迁移
export const costReports = pgTable(
  "cost_reports",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    product: varchar({ length: 50 }).notNull(),
    reportDate: date("report_date").notNull(),
    workshop: varchar({ length: 50 }).notNull(),
    materials: jsonb(),
    laborAndMaintenance: jsonb("labor_and_maintenance"),
    periodExpenses: jsonb("period_expenses"),
    adjustments: jsonb(),
    alkaliYield: real("alkali_yield"), // 碱产量
    chlorineYield: real("chlorine_yield"), // 氯产量
    hydrochloricAcidYield: real("hydrochloric_acid_yield"), // 盐酸产量
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("cost_reports_report_date_idx").using("btree", table.reportDate.asc().nullsLast().op("date_ops")),
    unique("cost_reports_product_workshop_date_unique").on(table.product, table.reportDate, table.workshop),
  ]
);

// 销售数据表（用于销售计划数据分析）
export const salesData = pgTable(
  "sales_data",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    orderDate: date("order_date").notNull(), // 单据日期
    customer: varchar("customer", { length: 100 }).notNull(), // 客户
    salesman: varchar("salesman", { length: 50 }), // 业务员
    materialName: varchar("material_name", { length: 100 }).notNull(), // 物料名称
    planQuantity: varchar("plan_quantity", { length: 20 }).notNull(), // 销售计划数量
    taxPrice: varchar("tax_price", { length: 20 }).notNull(), // 含税净价
    taxTotal: varchar("tax_total", { length: 20 }).notNull(), // 价税合计
    outQuantity: varchar("out_quantity", { length: 20 }).notNull(), // 出库数量
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("sales_data_order_date_idx").using("btree", table.orderDate.asc().nullsLast().op("date_ops")),
    index("sales_data_material_name_idx").using("btree", table.materialName.asc().nullsLast().op("text_ops")),
    index("sales_data_customer_idx").using("btree", table.customer.asc().nullsLast().op("text_ops")),
  ]
);
