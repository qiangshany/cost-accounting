# 氯碱厂成本管理系统 - 代码文件清单

## 📁 文件目录结构

```
项目目录/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 首页（路由跳转）
│   │   ├── components/
│   │   │   └── LoginPage.tsx           # 登录组件
│   │   ├── workshop/
│   │   │   └── page.tsx                # 车间填报页面
│   │   ├── purchasing/
│   │   │   └── page.tsx                # 采购部填报页面
│   │   ├── management/
│   │   │   └── page.tsx                # 生产管理部填报页面
│   │   ├── admin/
│   │   │   └── page.tsx                # 管理员页面
│   │   └── api/
│   │       ├── production-yields/
│   │       │   └── route.ts            # 产量数据接口
│   │       ├── material-costs/
│   │       │   └── route.ts            # 原材料成本接口
│   │       ├── purchase-price/
│   │       │   └── route.ts            # 采购单价接口
│   │       ├── labor-maintenance-costs/
│   │       │   └── route.ts            # 人工与维护成本接口
│   │       ├── period-expenses/
│   │       │   └── route.ts            # 期间费用接口
│   │       ├── adjustments/
│   │       │   └── route.ts            # 调整项接口
│   │       ├── sales-data/
│   │       │   └── route.ts            # 销售数据接口
│   │       └── admin-cost-list/
│   │           └── route.ts            # 管理员成本列表接口
│   └── storage/
│       └── database/
│           └── supabase-admin.ts       # Supabase 客户端
└── CODES/                              # 本目录下为参考代码文件
```

## 📄 代码文件说明

### 页面文件 (src/app/)

| 文件路径 | 说明 | 代码文件 |
|----------|------|----------|
| `page.tsx` | 首页（登录判断 + 路由跳转） | 见项目原有文件 |
| `components/LoginPage.tsx` | 登录页面组件 | `CODES/01_login_page.tsx` |
| `workshop/page.tsx` | 车间填报页面 | `CODES/02_workshop_page.tsx` |
| `purchasing/page.tsx` | 采购部填报页面 | `CODES/03_purchasing_page.tsx` |
| `management/page.tsx` | 生产管理部填报页面 | `CODES/04_management_page.tsx` |
| `admin/page.tsx` | 管理员页面 | 见项目原有文件（代码过长） |
| `admin/components/CostAnalysisView.tsx` | 成本分析视图组件 | `CODES/05_admin_cost_analysis.tsx` |

### API 路由文件 (src/app/api/)

| 文件路径 | 说明 | 代码文件 |
|----------|------|----------|
| `production-yields/route.ts` | 产量数据 CRUD | `CODES/api_01_production_yields.ts` |
| `material-costs/route.ts` | 原材料成本 CRUD | `CODES/api_02_material_costs.ts` |
| `purchase-price/route.ts` | 采购单价 CRUD | `CODES/api_03_purchase_price.ts` |
| `labor-maintenance-costs/route.ts` | 人工维护成本 CRUD | `CODES/api_04_labor_maintenance_costs.ts` |
| `period-expenses/route.ts` | 期间费用 CRUD | `CODES/api_05_period_expenses.ts` |
| `adjustments/route.ts` | 调整项 CRUD | `CODES/api_06_adjustments.ts` |
| `sales-data/route.ts` | 销售数据管理 | `CODES/api_07_sales_data.ts` |
| `admin-cost-list/route.ts` | 成本汇总查询 | `CODES/api_08_admin_cost_list.ts` |

### 数据库相关

| 文件路径 | 说明 |
|----------|------|
| `src/storage/database/supabase-admin.ts` | Supabase 管理员客户端 |
| 数据库 Schema | 见 REQUIREMENTS.md 文档 |

---

## 🔧 复制指南

### Step 1: 复制页面文件

将 `CODES/` 目录下的页面文件复制到对应位置：

```bash
cp CODES/01_login_page.tsx src/app/components/LoginPage.tsx
cp CODES/02_workshop_page.tsx src/app/workshop/page.tsx
cp CODES/03_purchasing_page.tsx src/app/purchasing/page.tsx
cp CODES/04_management_page.tsx src/app/management/page.tsx
cp CODES/05_admin_cost_analysis.tsx src/app/admin/components/CostAnalysisView.tsx
```

### Step 2: 复制 API 路由文件

```bash
cp CODES/api_01_production_yields.ts src/app/api/production-yields/route.ts
cp CODES/api_02_material_costs.ts src/app/api/material-costs/route.ts
cp CODES/api_03_purchase_price.ts src/app/api/purchase-price/route.ts
cp CODES/api_04_labor_maintenance_costs.ts src/app/api/labor-maintenance-costs/route.ts
cp CODES/api_05_period_expenses.ts src/app/api/period-expenses/route.ts
cp CODES/api_06_adjustments.ts src/app/api/adjustments/route.ts
cp CODES/api_07_sales_data.ts src/app/api/sales-data/route.ts
cp CODES/api_08_admin_cost_list.ts src/app/api/admin-cost-list/route.ts
```

### Step 3: 复制首页文件

项目原有的首页 `page.tsx`：

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from './components/LoginPage';

export default function HomePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn');
      const userRole = localStorage.getItem('userRole');

      if (loggedIn === 'true' && userRole) {
        switch (userRole) {
          case 'workshop': router.push('/workshop'); break;
          case 'management': router.push('/management'); break;
          case 'purchasing': router.push('/purchasing'); break;
          case 'admin': router.push('/admin'); break;
          default:
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            localStorage.removeItem('username');
            localStorage.removeItem('loginTime');
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  const handleLoginSuccess = () => {
    const userRole = localStorage.getItem('userRole');
    if (userRole) {
      switch (userRole) {
        case 'workshop': router.push('/workshop'); break;
        case 'management': router.push('/management'); break;
        case 'purchasing': router.push('/purchasing'); break;
        case 'admin': router.push('/admin'); break;
      }
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
```

### Step 4: 创建目录结构（如需要）

```bash
mkdir -p src/app/workshop
mkdir -p src/app/purchasing
mkdir -p src/app/management
mkdir -p src/app/admin/components
mkdir -p src/app/api/production-yields
mkdir -p src/app/api/material-costs
mkdir -p src/app/api/purchase-price
mkdir -p src/app/api/labor-maintenance-costs
mkdir -p src/app/api/period-expenses
mkdir -p src/app/api/adjustments
mkdir -p src/app/api/sales-data
mkdir -p src/app/api/admin-cost-list
```

---

## 📋 依赖说明

### npm 依赖

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "xlsx": "^0.18.0",
    "recharts": "^2.10.0",
    "sonner": "^1.0.0",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "@radix-ui/react-slot": "^1.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-popover": "^1.0.0",
    "@radix-ui/react-label": "^2.0.0",
    "@radix-ui/react-calendar": "^1.0.0"
  }
}
```

### 环境变量

创建 `.env.local` 文件：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🔑 账号配置

在 `LoginPage.tsx` 中配置：

```tsx
const ACCOUNTS = {
  '碱车间': { password: 'xinlong', role: 'workshop' },
  '氯车间': { password: 'xinlong', role: 'workshop' },
  '生产管理部': { password: 'xinlong', role: 'management' },
  '采购部': { password: 'xinlong', role: 'purchasing' },
  'admin': { password: 'xinlong', role: 'admin' },
};
```

---

## 📊 数据表 Schema

详见 `REQUIREMENTS.md` 文档中的数据库表结构定义。

需要创建以下数据表：
- `production_yields` - 产量数据表
- `material_costs` - 原材料成本表
- `purchase_prices` - 采购单价表
- `labor_maintenance_costs` - 人工与维护成本表
- `period_expenses` - 期间费用表
- `adjustments` - 调整项表
- `sales_data` - 销售数据表
