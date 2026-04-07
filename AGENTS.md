# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下`package.json`文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。


## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 数据库集成

### Supabase 集成

- **数据库位置**: `src/storage/database/`
- **Schema 定义**: `src/storage/database/shared/schema.ts`
- **客户端配置**: `src/storage/database/supabase-client.ts`
- **Schema 管理命令**:
  - 同步模型: `coze-coding-ai db generate-models`
  - 升级数据库: `coze-coding-ai db upgrade`

### 成本核算系统（新架构 - 每个成本项独立存储）

#### 数据表结构

1. **production_yields** - 产量数据表
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + workshop + product`
   - **字段**:
     - `report_date`: 报告日期
     - `product`: 产品名称（如"氯碱"）
     - `workshop`: 车间名称（如"碱车间"、"氯车间"）
     - `alkali_yield`: 碱产量
     - `chlorine_yield`: 氯产量
     - `hydrochloric_acid_yield`: 盐酸产量

2. **material_costs** - 原材料成本表（车间填报数量）
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + material_name + workshop + product`
   - **字段**:
     - `report_date`: 报告日期
     - `material_name`: 材料名称（如"原煤"、"矿盐"）
     - `product`: 产品名称
     - `workshop`: 车间名称
     - `quantity`: 数量
     - `unit`: 单位（如"吨"、"千克"、"度"）

3. **purchase_prices** - 采购单价表（采购部填报单价）
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + material_name`
   - **字段**:
     - `report_date`: 报告日期
     - `material_name`: 材料名称
     - `price`: 单价
     - `unit`: 单位（如"元/吨"、"元/千克"）

4. **labor_maintenance_costs** - 人工与维护成本表
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + cost_item_name + workshop + product`
   - **字段**:
     - `report_date`: 报告日期
     - `cost_item_name`: 成本项目名称（如"工资及福利"、"维修费"）
     - `product`: 产品名称
     - `workshop`: 车间名称
     - `amount`: 金额
     - `unit`: 单位（如"元"）

5. **period_expenses** - 期间费用表（生产管理部填报，不分车间）
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + expense_item_name + product`
   - **字段**:
     - `report_date`: 报告日期
     - `expense_item_name`: 费用项目名称（如"管理费用"、"财务费用"）
     - `product`: 产品名称
     - `amount`: 金额
     - `unit`: 单位（如"元"）

6. **adjustments** - 调整项表（生产管理部填报，不分车间）
   - **主键**: `id` (UUID)
   - **唯一键**: `report_date + adjustment_name + product`
   - **字段**:
     - `report_date`: 报告日期
     - `adjustment_name`: 调整项目名称（如"调减其他收入"）
     - `product`: 产品名称
     - `amount`: 金额
     - `unit`: 单位（如"元"）

#### 成本项列表

- **原材料类（18项）**:
  - 原煤（吨）、矿盐（吨）、原盐（吨）、网电（度）、纯碱（千克）
  - 三氯化铁（千克）、亚硫酸钠（千克）、31%盐酸（吨）、32%液碱（吨）、硫酸（吨）
  - 氨水（吨）、柴油（升）、地表水（立方米）、电石渣（吨）、脱硫（元）、铲硝及输煤费（元）

- **人工与维护类（5项）**:
  - 工资及福利、维修费、设备外出修理费用、外协车费用、折旧费用

- **期间费用类（5项）**:
  - 管理费用、财务费用、安全费用、销售费用、营业税金及附加

- **调整项（1项）**:
  - 调减其他收入

#### 页面结构

- **车间填报页面**: 填报原材料数量、部分人工与维护成本（工资及福利只读）
- **采购部填报页面**: 填报原材料单价
- **生产管理部填报页面**: 填报期间费用、调整项、部分人工与维护成本，并显示总成本汇总
- **管理员页面**: 查看所有数据汇总

#### API 接口

1. **产量数据**: `/api/production-yields`
   - GET: 查询产量数据（支持日期、产品、车间筛选）
   - POST: 提交产量数据
   - DELETE: 删除产量数据

2. **原材料成本**: `/api/material-costs`
   - GET: 查询原材料成本数据
   - POST: 提交原材料成本数据（批量upsert）
   - DELETE: 删除原材料成本数据

3. **采购单价**: `/api/purchase-price`
   - GET: 查询采购单价数据
   - POST: 提交采购单价数据（批量upsert）
   - DELETE: 删除采购单价数据

4. **人工与维护成本**: `/api/labor-maintenance-costs`
   - GET: 查询人工与维护成本数据
   - POST: 提交人工与维护成本数据（批量upsert）
   - DELETE: 删除人工与维护成本数据

5. **期间费用**: `/api/period-expenses`
   - GET: 查询期间费用数据
   - POST: 提交期间费用数据（批量upsert）
   - DELETE: 删除期间费用数据

6. **调整项**: `/api/adjustments`
   - GET: 查询调整项数据
   - POST: 提交调整项数据（批量upsert）
   - DELETE: 删除调整项数据

#### 旧表结构（保留用于数据迁移）

- **数据表**: `cost_reports`（已废弃，建议使用新架构）
- **唯一键**: `product + report_date + workshop`

