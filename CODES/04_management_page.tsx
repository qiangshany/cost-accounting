'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calculator, Save, DollarSign, LogOut, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';

// 直接材料成本项目及单位
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

// 制造费用项目
const MANUFACTURING_COST_ITEMS: { name: string; unit: string }[] = [
  { name: '工人工资及保险', unit: '元' },
  { name: '维修费', unit: '元' },
  { name: '外协维修', unit: '元' },
  { name: '盐泥、铲销费用', unit: '元' },
  { name: '外协车费用', unit: '元' },
  { name: '污水处理费用', unit: '元' },
  { name: '今日折旧', unit: '元' },
];

// 其他费用项目（期间费用）
const OTHER_COST_ITEMS: { name: string; unit: string }[] = [
  { name: '企业管理费', unit: '元' },
  { name: '财务费用', unit: '元' },
  { name: '税金及附加', unit: '元' },
  { name: '安全费用', unit: '元' },
  { name: '销售费用', unit: '元' },
];

interface CostData {
  directMaterials: Record<string, string>;
  manufacturingCosts: Record<string, string>;
  otherCosts: Record<string, string>;
}

export default function ManagementPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('氯碱');
  const [costData, setCostData] = useState<CostData>({
    directMaterials: {},
    manufacturingCosts: {},
    otherCosts: {},
  });
  const [purchasePrices, setPurchasePrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined;

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

  useEffect(() => {
    const loadExistingData = async () => {
      if (!selectedDate || !selectedProduct) return;

      try {
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

        const initDirectMaterials: Record<string, string> = {};
        DIRECT_MATERIAL_ITEMS.forEach(item => initDirectMaterials[item.name] = '');
        const initManufacturingCosts: Record<string, string> = {};
        MANUFACTURING_COST_ITEMS.forEach(item => initManufacturingCosts[item.name] = '');
        const initOtherCosts: Record<string, string> = {};
        OTHER_COST_ITEMS.forEach(item => initOtherCosts[item.name] = '');
        const initPrices: Record<string, number> = {};

        if (materialData.success && materialData.data && materialData.data.length > 0) {
          materialData.data.forEach((item: { material_name: string; quantity: number }) => {
            const matchedItem = DIRECT_MATERIAL_ITEMS.find(dm => dm.name === item.material_name);
            if (matchedItem) {
              initDirectMaterials[item.material_name] = item.quantity === null ? '' : String(item.quantity);
            }
          });
        }

        if (laborData.success && laborData.data && laborData.data.length > 0) {
          laborData.data.forEach((item: { cost_item_name: string; amount: number }) => {
            const matchedItem = MANUFACTURING_COST_ITEMS.find(mc => mc.name === item.cost_item_name);
            if (matchedItem) {
              initManufacturingCosts[item.cost_item_name] = item.amount === null ? '' : String(item.amount);
            }
          });
        }

        if (priceData.success && priceData.data && priceData.data.length > 0) {
          priceData.data.forEach((item: { material_name: string; price: number }) => {
            initPrices[item.material_name] = item.price || 0;
          });
        }

        if (periodData.success && periodData.data && periodData.data.length > 0) {
          periodData.data.forEach((item: { expense_item_name: string; amount: number }) => {
            initOtherCosts[item.expense_item_name] = item.amount === null ? '' : String(item.amount);
          });
        }

        setCostData({
          directMaterials: initDirectMaterials,
          manufacturingCosts: initManufacturingCosts,
          otherCosts: initOtherCosts,
        });
        setPurchasePrices(initPrices);
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };

    loadExistingData();
  }, [selectedDate, selectedProduct]);

  const handleValueChange = (category: keyof CostData, item: string, value: string) => {
    setCostData(prev => ({
      ...prev,
      [category]: { ...prev[category], [item]: value }
    }));
  };

  const calculateDirectMaterialCost = () => {
    return DIRECT_MATERIAL_ITEMS.reduce((sum, item) => {
      const quantity = parseFloat(costData.directMaterials[item.name]) || 0;
      const price = purchasePrices[item.name] || 0;
      return sum + (quantity * price);
    }, 0);
  };

  const calculateManufacturingCost = () => {
    return MANUFACTURING_COST_ITEMS.reduce((sum, item) => {
      return sum + (parseFloat(costData.manufacturingCosts[item.name]) || 0);
    }, 0);
  };

  const calculateOtherCost = () => {
    return OTHER_COST_ITEMS.reduce((sum, item) => {
      return sum + (parseFloat(costData.otherCosts[item.name]) || 0);
    }, 0);
  };

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
      // 提交制造费用数据
      await fetch(`/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}`, { method: 'DELETE' });
      
      const manufacturingItems = MANUFACTURING_COST_ITEMS
        .filter(item => parseFloat(costData.manufacturingCosts[item.name]) || 0 > 0)
        .map(item => ({
          report_date: selectedDate,
          cost_item_name: item.name,
          product: selectedProduct,
          workshop: '碱车间',
          amount: parseFloat(costData.manufacturingCosts[item.name]) || 0,
          unit: item.unit,
        }));

      if (manufacturingItems.length > 0) {
        const laborResponse = await fetch('/api/labor-maintenance-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: manufacturingItems }),
        });
        if (!laborResponse.ok) throw new Error('制造费用数据提交失败');
      }

      // 提交期间费用数据
      await fetch(`/api/period-expenses?date=${selectedDate}&product=${selectedProduct}`, { method: 'DELETE' });
      
      const otherCostItems = OTHER_COST_ITEMS
        .filter(item => parseFloat(costData.otherCosts[item.name]) || 0 > 0)
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
          body: JSON.stringify({ items: otherCostItems }),
        });
        if (!periodResponse.ok) throw new Error('其他费用数据提交失败');
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
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Calculator className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">生产管理部填报</h1>
              <p className="text-slate-500 dark:text-slate-400">成本数据汇总填报</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-600 dark:text-slate-400">
            <LogOut className="w-4 h-4 mr-2" />退出登录
          </Button>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 py-4">
          <CardContent className="pt-2">
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-500">产品</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-10 bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="氯碱">氯碱</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium text-slate-500">日期</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-start text-left bg-white dark:bg-slate-900">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDateObj!, 'yyyy-MM-dd', { locale: zhCN }) : "选择日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDateObj} onSelect={(date) => {
                      if (date) { setSelectedDate(format(date, 'yyyy-MM-dd')); setIsCalendarOpen(false); }
                    }} locale={zhCN} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 直接材料成本 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-sky-600" />
              直接材料成本（数量×单价）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200">
              <div className="md:col-span-4 text-lg font-semibold">成本项目</div>
              <div className="md:col-span-2 text-lg font-semibold text-right">数量</div>
              <div className="md:col-span-1 text-lg font-semibold text-center">单位</div>
              <div className="md:col-span-2 text-lg font-semibold text-right">单价（元）</div>
              <div className="md:col-span-3 text-lg font-semibold text-right">成本（元）</div>
            </div>
            <div className="space-y-3">
              {DIRECT_MATERIAL_ITEMS.map((item) => {
                const quantity = parseFloat(costData.directMaterials[item.name]) || 0;
                const price = purchasePrices[item.name] || 0;
                const cost = quantity * price;
                return (
                  <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                    <div className="md:col-span-4 text-lg font-medium text-slate-600">{item.name}</div>
                    <div className="md:col-span-2 text-lg text-slate-700 text-right">{quantity > 0 ? quantity.toFixed(2) : '-'}</div>
                    <div className="md:col-span-1 text-lg text-slate-500 text-center">{item.unit}</div>
                    <div className="md:col-span-2 text-lg text-slate-700 text-right">{price > 0 ? price.toFixed(2) : '-'}</div>
                    <div className="md:col-span-3 text-lg text-slate-700 text-right font-semibold">{cost > 0 ? `¥${cost.toFixed(2)}` : '-'}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 p-4 bg-sky-50 dark:bg-sky-950/20 rounded-lg border border-sky-100">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">小计</span>
                <span className="text-xl font-bold text-sky-700">¥{calculateDirectMaterialCost().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 制造费用 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              制造费用
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200">
              <div className="md:col-span-7 text-lg font-semibold">成本项目</div>
              <div className="md:col-span-3 text-lg font-semibold text-right">金额（元）</div>
              <div className="md:col-span-2 text-lg font-semibold text-center">单位</div>
            </div>
            <div className="space-y-3">
              {MANUFACTURING_COST_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label className="md:col-span-7 text-lg font-medium text-slate-600">{item.name}</Label>
                  <Input type="text" inputMode="decimal" placeholder="0" value={costData.manufacturingCosts[item.name] ?? ''}
                    onChange={(e) => handleValueChange('manufacturingCosts', item.name, e.target.value)}
                    className="md:col-span-3 h-11" />
                  <div className="md:col-span-2 text-lg text-slate-500 text-center">{item.unit}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">小计</span>
                <span className="text-xl font-bold text-amber-700">¥{calculateManufacturingCost().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 其他费用 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              期间费用
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200">
              <div className="md:col-span-7 text-lg font-semibold">成本项目</div>
              <div className="md:col-span-3 text-lg font-semibold text-right">金额（元）</div>
              <div className="md:col-span-2 text-lg font-semibold text-center">单位</div>
            </div>
            <div className="space-y-3">
              {OTHER_COST_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label className="md:col-span-7 text-lg font-medium text-slate-600">{item.name}</Label>
                  <Input type="text" inputMode="decimal" placeholder="0" value={costData.otherCosts[item.name] ?? ''}
                    onChange={(e) => handleValueChange('otherCosts', item.name, e.target.value)}
                    className="md:col-span-3 h-11" />
                  <div className="md:col-span-2 text-lg text-slate-500 text-center">{item.unit}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-100">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">小计</span>
                <span className="text-xl font-bold text-violet-700">¥{calculateOtherCost().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 总成本 */}
        <Card className="shadow-lg border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-white to-violet-50">
          <CardContent className="py-8">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-700">总成本</span>
              <span className="text-4xl font-bold text-blue-600">¥{calculateTotalCost().toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={handleSubmit} disabled={isLoading} size="lg"
            className="min-w-[200px] bg-violet-600 hover:bg-violet-700 text-white shadow-md">
            <Save className="w-5 h-5 mr-2" />
            {isLoading ? '提交中...' : '提交数据'}
          </Button>
        </div>
      </div>
    </div>
  );
}
