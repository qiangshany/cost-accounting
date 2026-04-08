import { pgTable, serial, timestamp, varchar, numeric, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 销售数据表
export const salesData = pgTable(
  "sales_data",
  {
    id: serial().primaryKey(),
    order_date: varchar("order_date", { length: 20 }).notNull(), // 单据日期
    customer: varchar("customer", { length: 255 }).notNull(), // 客户
    salesman: varchar("salesman", { length: 100 }), // 业务员
    material_name: varchar("material_name", { length: 255 }).notNull(), // 物料名称
    plan_quantity: numeric("plan_quantity", { precision: 18, scale: 2 }).notNull().default("0"), // 销售计划数量
    tax_price: numeric("tax_price", { precision: 18, scale: 2 }).default("0"), // 含税净价
    tax_total: numeric("tax_total", { precision: 18, scale: 2 }).default("0"), // 价税合计
    out_quantity: numeric("out_quantity", { precision: 18, scale: 2 }).default("0"), // 出库数量
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sales_data_order_date_idx").on(table.order_date),
    index("sales_data_customer_idx").on(table.customer),
    index("sales_data_material_name_idx").on(table.material_name),
  ]
);
