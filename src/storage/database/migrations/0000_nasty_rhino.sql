CREATE TABLE "adjustments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"adjustment_name" varchar(100) NOT NULL,
	"product" varchar(50) NOT NULL,
	"amount" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "adjustments_unique_key" UNIQUE("report_date","adjustment_name","product")
);
--> statement-breakpoint
CREATE TABLE "cost_reports" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" varchar(50) NOT NULL,
	"report_date" date NOT NULL,
	"workshop" varchar(50) NOT NULL,
	"materials" jsonb,
	"labor_and_maintenance" jsonb,
	"period_expenses" jsonb,
	"adjustments" jsonb,
	"alkali_yield" real,
	"chlorine_yield" real,
	"hydrochloric_acid_yield" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "cost_reports_product_workshop_date_unique" UNIQUE("product","report_date","workshop")
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "labor_maintenance_costs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"cost_item_name" varchar(100) NOT NULL,
	"product" varchar(50) NOT NULL,
	"workshop" varchar(50) NOT NULL,
	"amount" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "labor_maintenance_costs_unique_key" UNIQUE("report_date","cost_item_name","workshop","product")
);
--> statement-breakpoint
CREATE TABLE "material_costs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"material_name" varchar(100) NOT NULL,
	"product" varchar(50) NOT NULL,
	"workshop" varchar(50) NOT NULL,
	"quantity" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "material_costs_unique_key" UNIQUE("report_date","material_name","workshop","product")
);
--> statement-breakpoint
CREATE TABLE "period_expenses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"expense_item_name" varchar(100) NOT NULL,
	"product" varchar(50) NOT NULL,
	"amount" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "period_expenses_unique_key" UNIQUE("report_date","expense_item_name","product")
);
--> statement-breakpoint
CREATE TABLE "production_yields" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"product" varchar(50) NOT NULL,
	"workshop" varchar(50) NOT NULL,
	"alkali_yield" real,
	"chlorine_yield" real,
	"hydrochloric_acid_yield" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "production_yields_date_workshop_product_unique" UNIQUE("report_date","workshop","product")
);
--> statement-breakpoint
CREATE TABLE "purchase_prices" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"material_name" varchar(100) NOT NULL,
	"price" real NOT NULL,
	"unit" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "purchase_prices_unique_key" UNIQUE("report_date","material_name")
);
--> statement-breakpoint
CREATE INDEX "adjustments_report_date_idx" ON "adjustments" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "cost_reports_report_date_idx" ON "cost_reports" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "labor_maintenance_costs_report_date_idx" ON "labor_maintenance_costs" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "material_costs_report_date_idx" ON "material_costs" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "material_costs_material_name_idx" ON "material_costs" USING btree ("material_name" text_ops);--> statement-breakpoint
CREATE INDEX "period_expenses_report_date_idx" ON "period_expenses" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "production_yields_report_date_idx" ON "production_yields" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "purchase_prices_report_date_idx" ON "purchase_prices" USING btree ("report_date" date_ops);--> statement-breakpoint
CREATE INDEX "purchase_prices_material_name_idx" ON "purchase_prices" USING btree ("material_name" text_ops);