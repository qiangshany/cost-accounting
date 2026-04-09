'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calculator, Save, DollarSign, LogOut, TrendingUp } from 'lucide-react';

// 直接材料成本项目及单位（对应碱车间填报+采购部单价）
const DIRECT_MATERIAL_ITEMS: { name: string; unit: string }[] = [
  { name: '矿盐', unit: '吨' },
  { name: '原盐', unit: '吨' },
  { name: '电', unit: '度' },
  { name: '蒸汽', unit: '吨' },
  { name: '纯碱', unit: '千克' },
  { name: '31%盐酸', unit: '吨' },
  { name: '98%硫酸', unit: '吨' },
  { name: '32%烧碱', unit: '吨' },
  { name: '液氯', unit: '吨' },
  { name: '三氯化铁', unit: '吨' },
  { name: '亚硫酸钠', unit: '吨' },
  { name: '除盐水', unit: '吨' },
];

// 制造费用项目及单位
const MANUFACTURING_COST_ITEMS: { name: string; unit: string }[] = [
  { name: '工人工资及保险', unit: '元' },
  { name: '维修费', unit: '元' },
  { name: '外协维修', unit: '元' },
  { name: '盐泥、铲销费用', unit: '元' },
  { name: '外协车费用', unit: '元' },
  { name: '污水处理费用', unit: '元' },
  { name: '今日折旧', unit: '元' },
];

// 其他费用项目及单位（期间费用）
const OTHER_COST_ITEMS: { name: string; unit: string }[] = [
  { name: '企业管理费', unit: '元' },
  { name: '财务费用', unit: '元' },
  { name: '税金及附加', unit: '元' },
  { name: '安全费用', unit: '元' },
  { name: '销售费用', unit: '元' },
];

interface CostData {
  // 直接材料：数量（来自碱车间填报）
  directMaterials: Record<string, string>;
  // 制造费用：金额
  manufacturingCosts: Record<string, string>;
  // 其他费用：金额
  otherCosts: Record<string, string>;
}

interface MaterialCostData {
  material_name: string;
  quantity: number;
  workshop?: string;
}

interface LaborCostData {
  cost_item_name: string;
  amount: number;
  workshop?: string;
}

interface PurchasePriceData {
  material_name: string;
  price: number;
}

interface PeriodExpenseData {
  expense_item_name: string;
  amount: number;
}

export default function ManagementPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('氯碱');
  const [costData, setCostData] = useState<CostData>({
    directMaterials: {},
    manufacturingCosts: {},
    otherCosts: {},
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
      const directMaterials: Record<string, string> = {};
      DIRECT_MATERIAL_ITEMS.forEach(item => directMaterials[item.name] = '');

      const manufacturingCosts: Record<string, string> = {};
      MANUFACTURING_COST_ITEMS.forEach(item => manufacturingCosts[item.name] = '');

      const otherCosts: Record<string, string> = {};
      OTHER_COST_ITEMS.forEach(item => otherCosts[item.name] = '');

      return { directMaterials, manufacturingCosts, otherCosts };
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
        // 并行查询所有数据
        const [materialResponse, laborResponse, priceResponse, periodResponse] = await Promise.all([
          fetch(`/api/material-costs?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}`),
          fetch(`/api/purchase-price?date=${selectedDate}`),
          fetch(`/api/period-expenses?date=${selectedDate}&product=${selectedProduct}`),
        ]);

        const [materialData, laborData, priceData, periodData] = await Promise.all([
          materialResponse.json(),
          laborResponse.json(),
          priceResponse.json(),
          periodResponse.json(),
        ]);

        // 加载直接材料数量（来自碱车间填报）
        if (materialData.success && materialData.data) {
          const materialMap: Record<string, string> = {};
          materialData.data.forEach((item: MaterialCostData) => {
            // 匹配 DIRECT_MATERIAL_ITEMS 中的项目
            const matchedItem = DIRECT_MATERIAL_ITEMS.find(dm => dm.name === item.material_name);
            if (matchedItem) {
              materialMap[item.material_name] = item.quantity === null ? '' : String(item.quantity);
            }
          });
          setCostData(prev => ({
            ...prev,
            directMaterials: { ...prev.directMaterials, ...materialMap },
          }));
        }

        // 加载制造费用
        if (laborData.success && laborData.data) {
          const manufacturingMap: Record<string, string> = {};
          laborData.data.forEach((item: LaborCostData) => {
            // 匹配 MANUFACTURING_COST_ITEMS 中的项目
            const matchedItem = MANUFACTURING_COST_ITEMS.find(mc => mc.name === item.cost_item_name);
            if (matchedItem) {
              manufacturingMap[item.cost_item_name] = item.amount === null ? '' : String(item.amount);
            }
          });
          setCostData(prev => ({
            ...prev,
            manufacturingCosts: { ...prev.manufacturingCosts, ...manufacturingMap },
          }));
        }

        // 加载采购部单价
        if (priceData.success && priceData.data) {
          const priceMap: Record<string, number> = {};
          priceData.data.forEach((item: PurchasePriceData) => {
            priceMap[item.material_name] = item.price || 0;
          });
          setPurchasePrices(priceMap);
        }

        // 加载其他费用（期间费用）
        if (periodData.success && periodData.data) {
          const otherCostMap: Record<string, string> = {};
          periodData.data.forEach((item: PeriodExpenseData) => {
            otherCostMap[item.expense_item_name] = item.amount === null ? '' : String(item.amount);
          });
          setCostData(prev => ({
            ...prev,
            otherCosts: { ...prev.otherCosts, ...otherCostMap },
          }));
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };

    loadExistingData();
  }, [selectedDate, selectedProduct]);

  const handleValueChange = (
    category: keyof CostData,
    item: string,
    value: string
  ) => {
    setCostData(prev => ({
      ...prev,
      [category]: { ...prev[category], [item]: value }
    }));
  };

  // 计算直接材料成本小计
  const calculateDirectMaterialCost = () => {
    return DIRECT_MATERIAL_ITEMS.reduce((sum, item) => {
      const quantity = parseFloat(costData.directMaterials[item.name]) || 0;
      const price = purchasePrices[item.name] || 0;
      return sum + (quantity * price);
    }, 0);
  };

  // 计算制造费用小计
  const calculateManufacturingCost = () => {
    return MANUFACTURING_COST_ITEMS.reduce((sum, item) => {
      return sum + (parseFloat(costData.manufacturingCosts[item.name]) || 0);
    }, 0);
  };

  // 计算其他费用小计
  const calculateOtherCost = () => {
    return OTHER_COST_ITEMS.reduce((sum, item) => {
      return sum + (parseFloat(costData.otherCosts[item.name]) || 0);
    }, 0);
  };

  // 计算总成本
  const calculateTotalCost = () => {
    return calculateDirectMaterialCost() + calculateManufacturingCost() + calculateOtherCost();
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
      // 提交制造费用数据（人工与维护成本）
      // 先删除旧数据，再插入新数据
      const deleteLaborResponse = await fetch(
        `/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}`,
        {
          method: 'DELETE',
        }
      );

      if (!deleteLaborResponse.ok) {
        throw new Error('删除旧制造费用数据失败');
      }

      // 提交制造费用数据
      const manufacturingItems = MANUFACTURING_COST_ITEMS
        .filter(item => {
          const val = parseFloat(costData.manufacturingCosts[item.name]) || 0;
          return val > 0;
        })
        .map(item => ({
          report_date: selectedDate,
          cost_item_name: item.name,
          product: selectedProduct,
          workshop: '碱车间', // 制造费用统一归到碱车间
          amount: parseFloat(costData.manufacturingCosts[item.name]) || 0,
          unit: item.unit,
        }));

      if (manufacturingItems.length > 0) {
        const laborResponse = await fetch('/api/labor-maintenance-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: manufacturingItems,
          }),
        });

        if (!laborResponse.ok) {
          throw new Error('制造费用数据提交失败');
        }
      }

      // 提交其他费用数据（期间费用）
      // 先删除旧数据，再插入新数据
      const deletePeriodResponse = await fetch(
        `/api/period-expenses?date=${selectedDate}&product=${selectedProduct}`,
        {
          method: 'DELETE',
        }
      );

      if (!deletePeriodResponse.ok) {
        throw new Error('删除旧其他费用数据失败');
      }

      // 提交其他费用数据
      const otherCostItems = OTHER_COST_ITEMS
        .filter(item => {
          const val = parseFloat(costData.otherCosts[item.name]) || 0;
          return val > 0;
        })
        .map(item => ({
          report_date: selectedDate,
          expense_item_name: item.name,
          product: selectedProduct,
          amount: parseFloat(costData.otherCosts[item.name]) || 0,
          unit: item.unit,
        }));

      if (otherCostItems.length > 0) {
        const periodResponse = await fetch('/api/period-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: otherCostItems,
          }),
        });

        if (!periodResponse.ok) {
          throw new Error('其他费用数据提交失败');
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
              <p className="text-slate-500 dark:text-slate-400">成本数据汇总填报</p>
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

        {/* 1. 直接材料成本 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                <DollarSign className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              直接材料成本（数量×单价）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-4 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">数量</div>
              <div className="md:col-span-1 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">单价（元）</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">成本（元）</div>
            </div>
            <div className="space-y-3">
              {DIRECT_MATERIAL_ITEMS.map((item) => {
                const quantity = parseFloat(costData.directMaterials[item.name]) || 0;
                const price = purchasePrices[item.name] || 0;
                const cost = quantity * price;

                return (
                  <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                    <div className="md:col-span-4 text-xl font-medium text-slate-600 dark:text-slate-400">
                      {item.name}
                    </div>
                    <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                      {quantity > 0 ? quantity.toFixed(2) : '-'}
                    </div>
                    <div className="md:col-span-1 text-xl text-slate-500 dark:text-slate-500 text-center">
                      {item.unit}
                    </div>
                    <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                      {price > 0 ? price.toFixed(2) : '-'}
                    </div>
                    <div className="md:col-span-3 text-xl text-slate-700 dark:text-slate-300 text-right font-semibold">
                      {cost > 0 ? `¥${cost.toFixed(2)}` : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 bg-sky-50 dark:bg-sky-950/20 rounded-lg border border-sky-100 dark:border-sky-900/30">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                <span className="text-xl font-bold text-sky-700 dark:text-sky-400">
                  ¥{calculateDirectMaterialCost().toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. 制造费用 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              制造费用
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">金额（元）</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
            </div>
            <div className="space-y-3">
              {MANUFACTURING_COST_ITEMS.map((item) => {
                const amount = parseFloat(costData.manufacturingCosts[item.name]) || 0;
                return (
                  <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                    <Label htmlFor={`manufacturing-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                      {item.name}
                    </Label>
                    <Input
                      id={`manufacturing-${item.name}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={costData.manufacturingCosts[item.name] ?? ''}
                      onChange={(e) => handleValueChange('manufacturingCosts', item.name, e.target.value)}
                      className="md:col-span-3 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                    />
                    <div className="md:col-span-2 text-xl text-slate-500 dark:text-slate-500 text-center">
                      {item.unit}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
                  ¥{calculateManufacturingCost().toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. 其他费用 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              其他费用
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">金额（元）</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
            </div>
            <div className="space-y-3">
              {OTHER_COST_ITEMS.map((item) => {
                const amount = parseFloat(costData.otherCosts[item.name]) || 0;
                return (
                  <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                    <Label htmlFor={`other-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                      {item.name}
                    </Label>
                    <Input
                      id={`other-${item.name}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={costData.otherCosts[item.name] ?? ''}
                      onChange={(e) => handleValueChange('otherCosts', item.name, e.target.value)}
                      className="md:col-span-3 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                    />
                    <div className="md:col-span-2 text-xl text-slate-500 dark:text-slate-500 text-center">
                      {item.unit}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-100 dark:border-violet-900/30">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                <span className="text-xl font-bold text-violet-700 dark:text-violet-400">
                  ¥{calculateOtherCost().toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. 成本汇总 */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-violet-950/30">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
            <CardTitle className="text-xl text-center text-slate-800 dark:text-slate-200">成本汇总</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">直接材料成本小计</span>
                <span className="text-3xl font-bold text-sky-700 dark:text-sky-400">
                  ¥{calculateDirectMaterialCost().toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">制造费用小计</span>
                <span className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                  ¥{calculateManufacturingCost().toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <span className="text-xl text-slate-600 dark:text-slate-400">其他费用小计</span>
                <span className="text-3xl font-bold text-violet-700 dark:text-violet-400">
                  ¥{calculateOtherCost().toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 text-white rounded-xl mt-6 shadow-md">
                <span className="text-2xl font-bold">总成本合计</span>
                <span className="text-4xl font-bold">
                  ¥{calculateTotalCost().toFixed(2)}
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
