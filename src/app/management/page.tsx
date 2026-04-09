'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calculator, Save, DollarSign, LogOut } from 'lucide-react';

// 期间费用类成本项及单位
const PERIOD_EXPENSE_ITEMS: { name: string; unit: string }[] = [
  { name: '企业管理费', unit: '元' },
  { name: '财务费用', unit: '元' },
  { name: '税金及附加', unit: '元' },
  { name: '安全费用', unit: '元' },
  { name: '销售费用', unit: '元' },
];

// 调整项及单位
const ADJUSTMENT_ITEMS: { name: string; unit: string }[] = [
  { name: '调减其他收入', unit: '元' },
];

// 原材料类成本项及单位
const MATERIAL_ITEMS: { name: string; unit: string }[] = [
  { name: '原煤', unit: '吨' },
  { name: '矿盐', unit: '吨' },
  { name: '原盐', unit: '吨' },
  { name: '网电', unit: '度' },
  { name: '纯碱', unit: '千克' },
  { name: '三氯化铁', unit: '吨' },
  { name: '亚硫酸钠', unit: '吨' },
  { name: '31%盐酸', unit: '吨' },
  { name: '32%液碱', unit: '吨' },
  { name: '硫酸', unit: '吨' },
  { name: '氨水', unit: '吨' },
  { name: '柴油', unit: '吨' },
  { name: '地表水', unit: '吨' },
  { name: '电石渣', unit: '吨' },
  { name: '化水药品费用', unit: '元' },
  { name: '锅炉清焦剂等', unit: '元' },
  { name: '脱硫、铲硝及输煤费', unit: '元' },
];

// 人工与维护类成本项及单位
const LABOR_MAINTENANCE_ITEMS: { name: string; unit: string }[] = [
  { name: '工资及福利', unit: '元' },
  { name: '维修费', unit: '元' },
  { name: '设备外出修理费用', unit: '元' },
  { name: '外协车费用', unit: '元' },
  { name: '折旧费用', unit: '元' },
];

interface CostData {
  workshopData: {
    materials: Record<string, string>;
    laborAndMaintenance: Record<string, string>;
    workshopLabor: Record<string, Record<string, string>>; // 按车间存储工资及福利
  };
  managementData: {
    materials: Record<string, string>;
    laborAndMaintenance: Record<string, string>;
    periodExpenses: Record<string, string>;
    adjustments: Record<string, string>;
  };
}

interface MaterialCostData {
  material_name: string;
  quantity: number;
}

interface PurchasePriceData {
  material_name: string;
  price: number;
}

interface PeriodExpenseData {
  expense_item_name: string;
  amount: number;
}

interface AdjustmentData {
  adjustment_name: string;
  amount: number;
}

interface WorkshopLaborItem {
  cost_item_name: string;
  amount: number;
  workshop: string;
}

interface SalaryItem {
  report_date: string;
  cost_item_name: string;
  product: string;
  workshop: string;
  amount: number;
  unit: string;
}

export default function ManagementPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('氯碱');
  const [costData, setCostData] = useState<CostData>({
    workshopData: {
      materials: {},
      laborAndMaintenance: {},
      workshopLabor: {
        '碱车间': { '工资及福利': '' },
        '氯车间': { '工资及福利': '' },
      },
    },
    managementData: {
      materials: {},
      laborAndMaintenance: {},
      periodExpenses: {},
      adjustments: {},
    },
  });
  const [purchasePrices, setPurchasePrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 检查登录状态和角色
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');

    if (loggedIn !== 'true' || userRole !== 'management') {
      router.push('/');
      return;
    }
  }, [router]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 初始化成本项
  useEffect(() => {
    const initCostData = () => {
      const workshopMaterials: Record<string, string> = {};
      MATERIAL_ITEMS.forEach(item => workshopMaterials[item.name] = '');

      const workshopLabor: Record<string, string> = {};
      LABOR_MAINTENANCE_ITEMS.forEach(item => workshopLabor[item.name] = '');

      const periodExpenses: Record<string, string> = {};
      PERIOD_EXPENSE_ITEMS.forEach(item => periodExpenses[item.name] = '');

      const adjustments: Record<string, string> = {};
      ADJUSTMENT_ITEMS.forEach(item => adjustments[item.name] = '');

      return {
        workshopData: {
          materials: workshopMaterials,
          laborAndMaintenance: workshopLabor,
          workshopLabor: {
            '碱车间': { '工资及福利': '' },
            '氯车间': { '工资及福利': '' },
          },
        },
        managementData: {
          materials: {},
          laborAndMaintenance: {},
          periodExpenses,
          adjustments,
        },
      };
    };

    setCostData(initCostData());
  }, []);

  // 加载现有数据
  useEffect(() => {
    const loadExistingData = async () => {
      if (!selectedDate || !selectedProduct) {
        return;
      }

      try {
        // 并行查询车间原材料数据、车间人工与维护成本数据、采购部单价数据
        const [materialResponse, workshopLaborResponse, periodResponse, adjustmentResponse, priceResponse] = await Promise.all([
          fetch(`/api/material-costs?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/period-expenses?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/adjustments?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/purchase-price?date=${selectedDate}`),
        ]);

        const [periodData, adjustmentData, materialData, priceData, workshopLaborJson] = await Promise.all([
          periodResponse.json(),
          adjustmentResponse.json(),
          materialResponse.json(),
          priceResponse.json(),
          workshopLaborResponse.json(),
        ]);

        // 加载车间原材料成本数据（汇总所有车间）
        if (materialData.success && materialData.data) {
          const materialMap: Record<string, string> = {};
          materialData.data.forEach((item: MaterialCostData) => {
            const currentValue = materialMap[item.material_name] ? parseFloat(materialMap[item.material_name] || '0') || 0 : 0;
            materialMap[item.material_name] = String(currentValue + (item.quantity || 0));
          });
          setCostData(prev => ({
            ...prev,
            workshopData: {
              ...prev.workshopData,
              materials: materialMap,
            },
          }));
        }

        // 加载车间人工与维护成本数据（汇总所有车间，按车间分别加载工资及福利）
        if (workshopLaborJson.success && workshopLaborJson.data) {
          const laborMap: Record<string, string> = {};
          const workshopLaborMap: Record<string, Record<string, string>> = {
            '碱车间': { '工资及福利': '' },
            '氯车间': { '工资及福利': '' },
          };

          workshopLaborJson.data.forEach((item: WorkshopLaborItem) => {
            if (item.cost_item_name === '工资及福利') {
              // 按车间分别加载工资及福利
              if (item.workshop && workshopLaborMap[item.workshop]) {
                workshopLaborMap[item.workshop]['工资及福利'] = item.amount === null ? '' : String(item.amount);
              }
            } else {
              // 汇总所有车间的人工与维护成本（不包括工资及福利）
              const currentValue = laborMap[item.cost_item_name] ? parseFloat(laborMap[item.cost_item_name] || '0') || 0 : 0;
              laborMap[item.cost_item_name] = String(currentValue + (item.amount || 0));
            }
          });

          setCostData(prev => ({
            ...prev,
            workshopData: {
              ...prev.workshopData,
              laborAndMaintenance: laborMap,
              workshopLabor: workshopLaborMap,
            },
          }));
        }

        // 加载期间费用数据
        if (periodData.success && periodData.data) {
          const periodMap: Record<string, string> = {};
          periodData.data.forEach((item: PeriodExpenseData) => {
            periodMap[item.expense_item_name] = item.amount === null ? '' : String(item.amount);
          });
          setCostData(prev => ({
            ...prev,
            managementData: {
              ...prev.managementData,
              periodExpenses: periodMap,
            },
          }));
        }

        // 加载调整项数据
        if (adjustmentData.success && adjustmentData.data) {
          const adjustmentMap: Record<string, string> = {};
          adjustmentData.data.forEach((item: AdjustmentData) => {
            adjustmentMap[item.adjustment_name] = item.amount === null ? '' : String(item.amount);
          });
          setCostData(prev => ({
            ...prev,
            managementData: {
              ...prev.managementData,
              adjustments: adjustmentMap,
            },
          }));
        }

        // 加载采购部单价数据
        if (priceData.success && priceData.data) {
          const priceMap: Record<string, number> = {};
          priceData.data.forEach((item: PurchasePriceData) => {
            priceMap[item.material_name] = item.price || 0;
          });
          setPurchasePrices(priceMap);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };

    loadExistingData();
  }, [selectedDate, selectedProduct]);

  const handleValueChange = (
    section: 'workshop' | 'management',
    category: 'materials' | 'laborAndMaintenance' | 'periodExpenses' | 'adjustments',
    item: string,
    value: string
  ) => {
    setCostData(prev => {
      if (section === 'workshop') {
        return {
          ...prev,
          workshopData: {
            ...prev.workshopData,
            [category]: { ...prev.workshopData[category as keyof typeof prev.workshopData], [item]: value }
          }
        };
      } else {
        return {
          ...prev,
          managementData: {
            ...prev.managementData,
            [category]: { ...prev.managementData[category], [item]: value }
          }
        };
      }
    });
  };

  // 处理车间工资及福利变化
  const handleWorkshopLaborChange = (workshop: string, itemName: string, value: string) => {
    setCostData(prev => ({
      ...prev,
      workshopData: {
        ...prev.workshopData,
        workshopLabor: {
          ...prev.workshopData.workshopLabor,
          [workshop]: {
            ...prev.workshopData.workshopLabor[workshop],
            [itemName]: value,
          },
        },
      },
    }));
  };

  // 计算小计（将字符串转换为数字）
  const calculateSubtotal = (obj: Record<string, string>) => {
    return Object.values(obj).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  // 计算直接材料成本小计（原材料 × 单价）
  const calculateDirectMaterialCost = (materials: Record<string, string>) => {
    return MATERIAL_ITEMS.reduce((sum, item) => {
      const quantity = parseFloat(materials[item.name]) || 0;
      // 原材料都需要乘以单价
      const price = purchasePrices[item.name] || 0;
      return sum + (quantity * price);
    }, 0);
  };

  // 计算制造费用小计（人工与维护成本 + 工资及福利）
  const calculateManufacturingCost = (labor: Record<string, string>, workshopLabor: Record<string, Record<string, string>>) => {
    // 计算人工与维护成本：非"工资及福利"的项目
    const laborCostItems = LABOR_MAINTENANCE_ITEMS.filter(item => item.name !== '工资及福利');
    const laborCost = laborCostItems.reduce((sum, item) => {
      return sum + (parseFloat(labor[item.name]) || 0);
    }, 0);

    // 计算所有车间的工资及福利总和
    const totalSalaryAndBenefits = Object.values(workshopLabor).reduce((sum, workshop) => {
      return sum + (parseFloat(workshop['工资及福利']) || 0);
    }, 0);

    return laborCost + totalSalaryAndBenefits;
  };

  // 计算生产成本小计（直接材料 + 制造费用）
  const calculateWorkshopProductionCost = (materials: Record<string, string>, labor: Record<string, string>, workshopLabor: Record<string, Record<string, string>>) => {
    return calculateDirectMaterialCost(materials) + calculateManufacturingCost(labor, workshopLabor);
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
    router.push('/');
    toast.success('已退出登录');
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedProduct) {
      toast.error('请填写完整的筛选条件');
      return;
    }

    setIsLoading(true);
    try {
      // 提交工资及福利数据（按车间分别存储）
      // 先删除旧数据，再插入新数据
      const workshops = ['碱车间', '氯车间'];

      // 删除所有车间的工资及福利数据
      for (const workshop of workshops) {
        const deleteSalaryResponse = await fetch(
          `/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}&workshop=${workshop}&costItemName=工资及福利`,
          {
            method: 'DELETE',
          }
        );

        if (!deleteSalaryResponse.ok) {
          throw new Error(`删除${workshop}旧工资及福利数据失败`);
        }
      }

      // 提交工资及福利数据
      const salaryItems: SalaryItem[] = [];

      workshops.forEach(workshop => {
        const amountStr = costData.workshopData.workshopLabor[workshop]?.['工资及福利'] || '';
        const amount = amountStr === '' ? 0 : parseFloat(amountStr);
        if (amount > 0) {
          salaryItems.push({
            report_date: selectedDate,
            cost_item_name: '工资及福利',
            product: selectedProduct,
            workshop: workshop,
            amount: amount,
            unit: '元',
          });
        }
      });

      if (salaryItems.length > 0) {
        const salaryResponse = await fetch('/api/labor-maintenance-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: salaryItems,
          }),
        });

        if (!salaryResponse.ok) {
          throw new Error('工资及福利数据提交失败');
        }
      }

      // 提交期间费用数据
      // 先删除旧数据，再插入新数据
      const deletePeriodResponse = await fetch(
        `/api/period-expenses?date=${selectedDate}&product=${selectedProduct}`,
        {
          method: 'DELETE',
        }
      );

      if (!deletePeriodResponse.ok) {
        throw new Error('删除旧期间费用数据失败');
      }

      // 提交期间费用数据（只提交有金额的项目）
      const periodItems = PERIOD_EXPENSE_ITEMS
        .filter(item => {
          const valStr = costData.managementData.periodExpenses[item.name] || '';
          const val = valStr === '' ? 0 : parseFloat(valStr);
          return val > 0;
        })
        .map(item => ({
          report_date: selectedDate,
          expense_item_name: item.name,
          product: selectedProduct,
          amount: parseFloat(costData.managementData.periodExpenses[item.name]) || 0,
          unit: item.unit,
        }));

      if (periodItems.length > 0) {
        const periodResponse = await fetch('/api/period-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: periodItems,
          }),
        });

        if (!periodResponse.ok) {
          throw new Error('期间费用数据提交失败');
        }
      }

      // 提交调整项数据
      // 先删除旧数据，再插入新数据
      const deleteAdjustmentResponse = await fetch(
        `/api/adjustments?date=${selectedDate}&product=${selectedProduct}`,
        {
          method: 'DELETE',
        }
      );

      if (!deleteAdjustmentResponse.ok) {
        throw new Error('删除旧调整项数据失败');
      }

      // 提交调整项数据（只提交有金额的项目）
      const adjustmentItems = ADJUSTMENT_ITEMS
        .filter(item => {
          const valStr = costData.managementData.adjustments[item.name] || '';
          const val = valStr === '' ? 0 : parseFloat(valStr);
          return val > 0;
        })
        .map(item => ({
          report_date: selectedDate,
          adjustment_name: item.name,
          product: selectedProduct,
          amount: parseFloat(costData.managementData.adjustments[item.name]) || 0,
          unit: item.unit,
        }));

      if (adjustmentItems.length > 0) {
        const adjustmentResponse = await fetch('/api/adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: adjustmentItems,
          }),
        });

        if (!adjustmentResponse.ok) {
          throw new Error('调整项数据提交失败');
        }
      }

      toast.success('生产管理部成本数据已成功提交');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-slate-100 dark:from-slate-950 dark:via-violet-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Calculator className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                生产管理部填报
              </h1>
              <p className="text-slate-500 dark:text-slate-400">期间费用与总成本汇总</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>

        {/* 筛选条件区域 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 py-4">
          <CardContent className="pt-2">
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="product" className="text-sm font-medium text-slate-500 dark:text-slate-500">产品</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger id="product" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="氯碱">氯碱</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="date" className="text-sm font-medium text-slate-500 dark:text-slate-500">日期</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 工资及福利 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              工资及福利（按车间填报）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* 碱车间工资及福利 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                <Label className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                  碱车间 - 工资及福利
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={costData.workshopData.workshopLabor['碱车间']?.['工资及福利'] ?? ''}
                  onChange={(e) => handleWorkshopLaborChange('碱车间', '工资及福利', e.target.value)}
                  className="md:col-span-2 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                />
                <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                  元
                </div>
              </div>

              {/* 氯车间工资及福利 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                <Label className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                  氯车间 - 工资及福利
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={costData.workshopData.workshopLabor['氯车间']?.['工资及福利'] ?? ''}
                  onChange={(e) => handleWorkshopLaborChange('氯车间', '工资及福利', e.target.value)}
                  className="md:col-span-2 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                />
                <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                  元
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 期间费用与税费 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                <DollarSign className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              期间费用与税费
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">数量</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
            </div>
            <div className="space-y-3">
              {PERIOD_EXPENSE_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor={`period-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                    {item.name}
                  </Label>
                  <Input
                    id={`period-${item.name}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={costData.managementData.periodExpenses[item.name] ?? ''}
                    onChange={(e) => handleValueChange('management', 'periodExpenses', item.name, e.target.value)}
                    className="md:col-span-2 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                  />
                  <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                    {item.unit}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-100 dark:border-violet-900/30">
              <div className="flex items-center justify-between">
                <span className="text-xl font-semibold text-slate-700 dark:text-slate-300">小计</span>
                <span className="text-3xl font-bold text-violet-700 dark:text-violet-400">
                  ¥{calculateSubtotal(costData.managementData.periodExpenses).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 调整项 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
                <Calculator className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              调整项
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">数量</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
            </div>
            <div className="space-y-3">
              {ADJUSTMENT_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor={`adjustment-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                    {item.name}
                  </Label>
                  <Input
                    id={`adjustment-${item.name}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={costData.managementData.adjustments[item.name] ?? ''}
                    onChange={(e) => handleValueChange('management', 'adjustments', item.name, e.target.value)}
                    className="md:col-span-2 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                  />
                  <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                    {item.unit}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 总成本汇总 */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-violet-950/30">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
            <CardTitle className="text-xl text-center text-slate-800 dark:text-slate-200">总成本汇总</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* 直接材料成本小计 */}
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">直接材料成本小计</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                  ¥{calculateDirectMaterialCost(costData.workshopData.materials).toFixed(2)}
                </span>
              </div>
              {/* 制造费用小计 */}
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">制造费用小计</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                  ¥{calculateManufacturingCost(costData.workshopData.laborAndMaintenance, costData.workshopData.workshopLabor).toFixed(2)}
                </span>
              </div>
              {/* 其他费用小计 */}
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">其他费用小计</span>
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                  ¥{calculateSubtotal(costData.managementData.periodExpenses).toFixed(2)}
                </span>
              </div>
              {/* 总成本合计 */}
              <div className="flex items-center justify-between py-4 px-6 bg-gradient-to-r from-violet-600 to-violet-700 dark:from-violet-700 dark:to-violet-800 text-white rounded-xl mt-6 shadow-md">
                <span className="text-2xl font-bold">总成本合计</span>
                <span className="text-4xl font-bold">
                  ¥{(calculateWorkshopProductionCost(costData.workshopData.materials, costData.workshopData.laborAndMaintenance, costData.workshopData.workshopLabor) +
                      calculateSubtotal(costData.managementData.periodExpenses)).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            size="lg"
            className="min-w-[200px] bg-violet-600 hover:bg-violet-700 text-white shadow-md"
          >
            <Save className="w-5 h-5 mr-2" />
            {isLoading ? '提交中...' : '提交生产管理部数据'}
          </Button>
        </div>
      </div>
    </div>
  );
}
// Management page component
