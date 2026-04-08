'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShoppingCart, Save, LogOut, DollarSign } from 'lucide-react';

// 原材料类成本项及单位（仅需要填写单价的材料，单位不是"元"的）
const MATERIAL_ITEMS: { name: string; unit: string }[] = [
  { name: '原煤', unit: '元/吨' },
  { name: '矿盐', unit: '元/吨' },
  { name: '原盐', unit: '元/吨' },
  { name: '网电', unit: '元/度' },
  { name: '纯碱', unit: '元/千克' },
  { name: '三氯化铁', unit: '元/吨' },
  { name: '亚硫酸钠', unit: '元/吨' },
  { name: '31%盐酸', unit: '元/吨' },
  { name: '32%液碱', unit: '元/吨' },
  { name: '硫酸', unit: '元/吨' },
  { name: '氨水', unit: '元/吨' },
  { name: '柴油', unit: '元/吨' },
  { name: '地表水', unit: '元/吨' },
  { name: '电石渣', unit: '元/吨' },
];

interface PriceData {
  materials: Record<string, number>;
}

export default function PurchasingPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [priceData, setPriceData] = useState<PriceData>({
    materials: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  // 检查登录状态和角色
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');

    if (loggedIn !== 'true' || userRole !== 'purchasing') {
      router.push('/');
      return;
    }
  }, [router]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 初始化价格项
  useEffect(() => {
    const materials: Record<string, number> = {};
    MATERIAL_ITEMS.forEach(item => materials[item.name] = 0);
    setPriceData({ materials });
  }, []);

  // 加载已有数据
  useEffect(() => {
    const loadExistingData = async () => {
      if (!selectedDate) return;

      try {
        const response = await fetch(`/api/purchase-price?date=${selectedDate}`);
        const data = await response.json();

interface PurchasePriceItem {
  material_name: string;
  price: number;
}

        if (data.success && data.data && data.data.length > 0) {
          // 构建价格映射
          const priceMap: Record<string, number> = {};
          data.data.forEach((item: PurchasePriceItem) => {
            priceMap[item.material_name] = item.price || 0;
          });

          // 更新状态
          setPriceData(prev => ({
            materials: { ...prev.materials, ...priceMap }
          }));
        }
      } catch (error) {
        console.error('加载采购单价数据失败:', error);
      }
    };

    loadExistingData();
  }, [selectedDate]);

  const handleValueChange = (
    category: keyof PriceData,
    item: string,
    value: number
  ) => {
    setPriceData(prev => ({
      ...prev,
      [category]: { ...prev[category], [item]: value }
    }));
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
    if (!selectedDate) {
      toast.error('请选择日期');
      return;
    }

    // 只提交有价格的材料（大于0的材料）
    const itemsToSubmit = MATERIAL_ITEMS
      .filter(item => (priceData.materials[item.name] || 0) > 0)
      .map(item => ({
        report_date: selectedDate,
        material_name: item.name,
        price: priceData.materials[item.name] || 0,
        unit: item.unit,
      }));

    if (itemsToSubmit.length === 0) {
      toast.error('请至少填写一个材料的价格');
      return;
    }

    setIsLoading(true);
    try {
      // 保存采购单价数据（使用新API）
      const response = await fetch('/api/purchase-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSubmit,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '提交失败');
      }

      toast.success('采购单价数据已成功提交');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-100 dark:from-slate-950 dark:via-emerald-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <ShoppingCart className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                采购部填报
              </h1>
              <p className="text-slate-500 dark:text-slate-400">原材料采购单价</p>
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

        {/* 原材料采购单价 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/30 py-4">
            <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              原材料采购单价
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {/* 表头 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
              <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">单价</div>
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
                    step="0.000000001"
                    min="0"
                    placeholder="0"
                    value={priceData.materials[item.name] !== undefined && priceData.materials[item.name] !== null ? String(priceData.materials[item.name]) : ''}
                    onChange={(e) => handleValueChange('materials', item.name, e.target.value === '' ? 0 : parseFloat(e.target.value))}
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

        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            size="lg"
            className="min-w-[200px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
          >
            <Save className="w-5 h-5 mr-2" />
            {isLoading ? '提交中...' : '提交采购单价'}
          </Button>
        </div>
      </div>
    </div>
  );
}
