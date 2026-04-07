'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Factory, TrendingUp, Shield, LogOut } from 'lucide-react';

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
  materials: Record<string, number>;
  laborAndMaintenance: Record<string, number>;
}

interface ProductionYieldData {
  alkali_yield?: number;
  chlorine_yield?: number;
  hydrochloric_acid_yield?: number;
}

interface MaterialCostData {
  material_name: string;
  quantity: number;
}

interface LaborCostData {
  cost_item_name: string;
  amount: number;
  workshop: string;
}

interface PurchasePriceData {
  material_name: string;
  price: number;
}

export default function WorkshopPage() {
  const router = useRouter();
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('氯碱');
  const [costData, setCostData] = useState<CostData>({
    materials: {},
    laborAndMaintenance: {},
  });
  const [purchasePrices, setPurchasePrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [yields, setYields] = useState({
    alkaliYield: 0, // 碱产量
    chlorineYield: 0, // 氯产量
    hydrochloricAcidYield: 0, // 盐酸产量
  });

  // 检查登录状态和角色
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');
    const user = localStorage.getItem('username');

    if (loggedIn !== 'true' || userRole !== 'workshop') {
      router.push('/');
      return;
    }

    setUsername(user || '');

    // 根据用户名设置车间
    if (user === '碱车间') {
      setSelectedWorkshop('碱车间');
    } else if (user === '氯车间') {
      setSelectedWorkshop('氯车间');
    } else {
      setSelectedWorkshop('车间一');
    }
  }, [router]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 初始化成本项
  useEffect(() => {
    const initCostData = () => {
      const materials: Record<string, number> = {};
      MATERIAL_ITEMS.forEach(item => materials[item.name] = 0);

      const laborAndMaintenance: Record<string, number> = {};
      LABOR_MAINTENANCE_ITEMS.forEach(item => laborAndMaintenance[item.name] = 0);

      return { materials, laborAndMaintenance };
    };

    setCostData(initCostData());
  }, []);

  // 加载现有数据
  useEffect(() => {
    const loadExistingData = async () => {
      if (!selectedDate || !selectedProduct || !selectedWorkshop) {
        return;
      }

      try {
        // 并行查询所有数据（包括采购部单价）
        const [yieldResponse, materialResponse, laborResponse, priceResponse] = await Promise.all([
          fetch(`/api/production-yields?date=${selectedDate}&product=${selectedProduct}&workshop=${selectedWorkshop}`),
          fetch(`/api/material-costs?date=${selectedDate}&product=${selectedProduct}&workshop=${selectedWorkshop}`),
          fetch(`/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}&workshop=${selectedWorkshop}`), // 读取当前车间的数据
          fetch(`/api/purchase-price?date=${selectedDate}`),
        ]);

        const [yieldData, materialData, laborData, priceData] = await Promise.all([
          yieldResponse.json(),
          materialResponse.json(),
          laborResponse.json(),
          priceResponse.json(),
        ]);

        // 加载产量数据
        if (yieldData.success && yieldData.data && yieldData.data.length > 0) {
          const yieldRecord = yieldData.data[0] as ProductionYieldData;
          if (yieldRecord.alkali_yield !== undefined) {
            setYields(prev => ({ ...prev, alkaliYield: yieldRecord.alkali_yield || 0 }));
          }
          if (yieldRecord.chlorine_yield !== undefined) {
            setYields(prev => ({ ...prev, chlorineYield: yieldRecord.chlorine_yield || 0 }));
          }
          if (yieldRecord.hydrochloric_acid_yield !== undefined) {
            setYields(prev => ({ ...prev, hydrochloricAcidYield: yieldRecord.hydrochloric_acid_yield || 0 }));
          }
        }

        // 加载原材料成本数据
        if (materialData.success && materialData.data) {
          const materialMap: Record<string, number> = {};
          materialData.data.forEach((item: MaterialCostData) => {
            materialMap[item.material_name] = item.quantity || 0;
          });
          setCostData(prev => ({
            ...prev,
            materials: { ...prev.materials, ...materialMap },
          }));
        }

        // 加载人工与维护成本数据
        if (laborData.success && laborData.data) {
          const laborMap: Record<string, number> = {};

          laborData.data.forEach((item: LaborCostData) => {
            // 直接使用当前车间的数据（包括工资及福利）
            laborMap[item.cost_item_name] = item.amount || 0;
          });

          setCostData(prev => ({
            ...prev,
            laborAndMaintenance: { ...prev.laborAndMaintenance, ...laborMap },
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
  }, [selectedDate, selectedProduct, selectedWorkshop]);

  const handleValueChange = (
    category: keyof CostData,
    item: string,
    value: number
  ) => {
    setCostData(prev => ({
      ...prev,
      [category]: { ...prev[category], [item]: value }
    }));
  };

  // 计算生产成本小计（数量 × 单价 + 金额类项目 + 工资及福利）
  const calculateProductionCost = (materials: Record<string, number>, labor: Record<string, number>) => {
    // 计算原材料成本：数量 × 单价（针对单位为物理量的项目）+ 金额（针对单位为"元"的项目）
    const materialCost = MATERIAL_ITEMS.reduce((sum, item) => {
      const quantity = materials[item.name] || 0;
      if (item.unit === '元') {
        // 单位为"元"的项目，直接作为金额
        return sum + quantity;
      } else {
        // 单位为物理量的项目，需要乘以单价
        const price = purchasePrices[item.name] || 0;
        return sum + (quantity * price);
      }
    }, 0);

    // 计算人工与维护成本：包含所有项目（包括工资及福利）
    const laborCost = LABOR_MAINTENANCE_ITEMS.reduce((sum, item) => {
      return sum + (labor[item.name] || 0);
    }, 0);

    return materialCost + laborCost;
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
    if (!selectedWorkshop || !selectedDate || !selectedProduct) {
      toast.error('请填写完整的筛选条件');
      return;
    }

    setIsLoading(true);
    try {
      // 提交产量数据
      if (yields.alkaliYield || yields.chlorineYield || yields.hydrochloricAcidYield) {
        const yieldResponse = await fetch('/api/production-yields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_date: selectedDate,
            product: selectedProduct,
            workshop: selectedWorkshop,
            alkali_yield: yields.alkaliYield || 0,
            chlorine_yield: yields.chlorineYield || 0,
            hydrochloric_acid_yield: yields.hydrochloricAcidYield || 0,
          }),
        });

        if (!yieldResponse.ok) {
          throw new Error('产量数据提交失败');
        }
      }

      // 提交原材料成本数据
      // 先删除旧数据，再插入新数据
      const deleteMaterialResponse = await fetch(
        `/api/material-costs?date=${selectedDate}&product=${selectedProduct}&workshop=${selectedWorkshop}`,
        {
          method: 'DELETE',
        }
      );

      if (!deleteMaterialResponse.ok) {
        throw new Error('删除旧原材料数据失败');
      }

      // 提交原材料成本数据（只提交有数量的材料）
      const materialItems = MATERIAL_ITEMS
        .filter(item => (costData.materials[item.name] || 0) > 0)
        .map(item => ({
          report_date: selectedDate,
          material_name: item.name,
          product: selectedProduct,
          workshop: selectedWorkshop,
          quantity: costData.materials[item.name] || 0,
          unit: item.unit,
        }));

      if (materialItems.length > 0) {
        const materialResponse = await fetch('/api/material-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: materialItems,
          }),
        });

        if (!materialResponse.ok) {
          throw new Error('原材料成本数据提交失败');
        }
      }

      // 提交人工与维护成本数据
      // 先删除旧数据，再插入新数据
      const deleteLaborResponse = await fetch(
        `/api/labor-maintenance-costs?date=${selectedDate}&product=${selectedProduct}&workshop=${selectedWorkshop}`,
        {
          method: 'DELETE',
        }
      );

      if (!deleteLaborResponse.ok) {
        throw new Error('删除旧人工与维护数据失败');
      }

      // 提交人工与维护成本数据（只提交有金额的项目）
      const laborItems = LABOR_MAINTENANCE_ITEMS
        .filter(item => (costData.laborAndMaintenance[item.name] || 0) > 0)
        .map(item => ({
          report_date: selectedDate,
          cost_item_name: item.name,
          product: selectedProduct,
          workshop: selectedWorkshop,
          amount: costData.laborAndMaintenance[item.name] || 0,
          unit: item.unit,
        }));

      if (laborItems.length > 0) {
        const laborResponse = await fetch('/api/labor-maintenance-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: laborItems,
          }),
        });

        if (!laborResponse.ok) {
          throw new Error('人工与维护成本数据提交失败');
        }
      }

      toast.success('车间成本数据已成功提交');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Factory className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                车间填报
              </h1>
              <p className="text-slate-500 dark:text-slate-400">生产成本填报 - {username}</p>
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
            <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
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
                <Label htmlFor="workshop" className="text-sm font-medium text-slate-500 dark:text-slate-500">车间</Label>
                <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop} disabled>
                  <SelectTrigger id="workshop" className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="碱车间">碱车间</SelectItem>
                    <SelectItem value="氯车间">氯车间</SelectItem>
                    <SelectItem value="车间一">车间一</SelectItem>
                    <SelectItem value="车间二">车间二</SelectItem>
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

        {/* 产量输入 - 仅碱车间显示 */}
        {selectedWorkshop === '碱车间' && (
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 py-4">
              <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <Factory className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                产量统计
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* 表头 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="md:col-span-9 text-xl font-semibold text-slate-700 dark:text-slate-300">产量项目</div>
                <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">产量（吨）</div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor="alkali-yield" className="md:col-span-9 text-xl font-medium text-slate-600 dark:text-slate-400">
                    碱产量
                  </Label>
                  <Input
                    id="alkali-yield"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={yields.alkaliYield || ''}
                    onChange={(e) => setYields(prev => ({ ...prev, alkaliYield: parseFloat(e.target.value) || 0 }))}
                    className="md:col-span-3 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor="chlorine-yield" className="md:col-span-9 text-xl font-medium text-slate-600 dark:text-slate-400">
                    氯产量
                  </Label>
                  <Input
                    id="chlorine-yield"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={yields.chlorineYield || ''}
                    onChange={(e) => setYields(prev => ({ ...prev, chlorineYield: parseFloat(e.target.value) || 0 }))}
                    className="md:col-span-3 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor="hydrochloric-acid-yield" className="md:col-span-9 text-xl font-medium text-slate-600 dark:text-slate-400">
                    盐酸产量
                  </Label>
                  <Input
                    id="hydrochloric-acid-yield"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={yields.hydrochloricAcidYield || ''}
                    onChange={(e) => setYields(prev => ({ ...prev, hydrochloricAcidYield: parseFloat(e.target.value) || 0 }))}
                    className="md:col-span-3 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 原材料类成本 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              原材料类成本
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
              {MATERIAL_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor={`material-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                    {item.name}
                  </Label>
                  <Input
                    id={`material-${item.name}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={costData.materials[item.name] || ''}
                    onChange={(e) => handleValueChange('materials', item.name, parseFloat(e.target.value) || 0)}
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

        {/* 人工与维护类成本 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              人工与维护类成本
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">金额</div>
              <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
            </div>
            <div className="space-y-3">
              {LABOR_MAINTENANCE_ITEMS.map((item) => (
                <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                  <Label htmlFor={`labor-${item.name}`} className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                    {item.name}
                  </Label>
                  {item.name === '工资及福利' ? (
                    <Input
                      id={`labor-${item.name}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costData.laborAndMaintenance[item.name] || ''}
                      readOnly
                      className="md:col-span-2 h-12 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-xl"
                    />
                  ) : (
                    <Input
                      id={`labor-${item.name}`}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={costData.laborAndMaintenance[item.name] || ''}
                      onChange={(e) => handleValueChange('laborAndMaintenance', item.name, parseFloat(e.target.value) || 0)}
                      className="md:col-span-2 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xl"
                    />
                  )}
                  <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                    {item.unit}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between">
                <span className="text-xl font-semibold text-slate-700 dark:text-slate-300">生产成本小计</span>
                <span className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  ¥{calculateProductionCost(costData.materials, costData.laborAndMaintenance).toFixed(2)}
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
            className="min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          >
            <Save className="w-5 h-5 mr-2" />
            {isLoading ? '提交中...' : '提交车间数据'}
          </Button>
        </div>
      </div>
    </div>
  );
}
