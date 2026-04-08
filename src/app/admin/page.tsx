'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calculator, LogOut, TrendingUp, Calendar, Factory, Trash2, List, BarChart3 } from 'lucide-react';

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

// 期间费用类成本项及单位
const PERIOD_EXPENSE_ITEMS: { name: string; unit: string }[] = [
  { name: '管理费用', unit: '元' },
  { name: '财务费用', unit: '元' },
  { name: '安全费用', unit: '元' },
  { name: '销售费用', unit: '元' },
  { name: '营业税金及附加', unit: '元' },
];

// 调整项及单位
const ADJUSTMENT_ITEMS: { name: string; unit: string }[] = [
  { name: '调减其他收入', unit: '元' },
];

interface SummaryData {
  materials: {
    quantities: Record<string, number>; // 数量汇总
    costs: Record<string, number>; // 成本汇总（数量 × 单价）
    prices: Record<string, number>; // 单价
  };
  laborAndMaintenance: Record<string, number>;
  periodExpenses: Record<string, number>;
  adjustments: Record<string, number>;
  workshops: string[];
  totalYield: number; // 总产量
}

export default function AdminPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('氯碱');
  const [view, setView] = useState<'list' | 'analysis'>('list');
  const [summaryData, setSummaryData] = useState<SummaryData>({
    materials: { quantities: {}, costs: {}, prices: {} },
    laborAndMaintenance: {},
    periodExpenses: {},
    adjustments: {},
    workshops: [],
    totalYield: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 检查登录状态和角色
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');

    if (loggedIn !== 'true' || userRole !== 'admin') {
      router.push('/');
      return;
    }
  }, [router]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      // 如果日期或产品为空，不加载数据
      if (!selectedDate || !selectedProduct) {
        return;
      }

      setIsLoading(true);
      // 清空旧数据，避免闪烁
      setSummaryData({
        materials: { quantities: {}, costs: {}, prices: {} },
        laborAndMaintenance: {},
        periodExpenses: {},
        adjustments: {},
        workshops: [],
        totalYield: 0,
      });
      try {
        const response = await fetch(
          `/api/admin-summary?date=${selectedDate}&product=${selectedProduct}`
        );

        if (!response.ok) {
          // API返回错误状态，直接显示无数据
          setSummaryData({
            materials: { quantities: {}, costs: {}, prices: {} },
            laborAndMaintenance: {},
            periodExpenses: {},
            adjustments: {},
            workshops: [],
            totalYield: 0,
          });
          setIsLoading(false);
          return;
        }

        const text = await response.text();
        if (!text) {
          // 空响应
          setSummaryData({
            materials: { quantities: {}, costs: {}, prices: {} },
            laborAndMaintenance: {},
            periodExpenses: {},
            adjustments: {},
            workshops: [],
            totalYield: 0,
          });
          setIsLoading(false);
          return;
        }

        const data = JSON.parse(text);

        if (data.success && data.data) {
          setSummaryData(data.data);
        } else {
          setSummaryData({
            materials: { quantities: {}, costs: {}, prices: {} },
            laborAndMaintenance: {},
            periodExpenses: {},
            adjustments: {},
            workshops: [],
            totalYield: 0,
          });
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        setSummaryData({
          materials: { quantities: {}, costs: {}, prices: {} },
          laborAndMaintenance: {},
          periodExpenses: {},
          adjustments: {},
          workshops: [],
          totalYield: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedDate, selectedProduct]);

  // 计算小计
  const calculateSubtotal = (obj: Record<string, number>) => {
    return Object.values(obj).reduce((sum, val) => sum + (val || 0), 0);
  };

  // 判断是否有任何数据
  const hasAnyData = () => {
    const hasMaterials = Object.keys(summaryData.materials.quantities).length > 0;
    const hasLabor = Object.keys(summaryData.laborAndMaintenance).length > 0;
    const hasPeriod = Object.keys(summaryData.periodExpenses).length > 0;
    const hasAdjustments = Object.keys(summaryData.adjustments).length > 0;
    return hasMaterials || hasLabor || hasPeriod || hasAdjustments;
  };

  // 清除旧数据
  const handleCleanupOldData = async () => {
    try {
      const response = await fetch('/api/cleanupOldData', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        // 重新加载数据
        window.location.reload();
      } else {
        toast.error(data.error || '清除失败');
      }
    } catch (error) {
      console.error('清除旧数据失败:', error);
      toast.error('清除失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
    router.push('/');
    toast.success('已退出登录');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-100 dark:from-slate-950 dark:via-emerald-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <Calculator className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                数据展示
              </h1>
              <p className="text-slate-500 dark:text-slate-400">成本数据汇总查看</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleCleanupOldData}
              className="text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清除一周前数据
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>

        {/* 筛选条件区域 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 py-4">
          <CardContent className="pt-2">
            <div className="grid gap-1.5 grid-cols-1 md:grid-cols-2">
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

        {/* 视图切换按钮 */}
        <div className="flex gap-2">
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
            className={view === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            <List className="w-4 h-4 mr-2" />
            成本列表
          </Button>
          <Button
            variant={view === 'analysis' ? 'default' : 'outline'}
            onClick={() => setView('analysis')}
            className={view === 'analysis' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            成本分析
          </Button>
        </div>

        {isLoading ? (
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="mt-3 text-slate-600 dark:text-slate-400">加载中...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {view === 'list' && (
              <>
            {/* 原材料类成本汇总 */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="bg-sky-50 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/30 py-4">
                <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  原材料类成本汇总
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {/* 表头 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="md:col-span-5 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
                  <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">数量</div>
                  <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">单价</div>
                  <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">成本（元）</div>
                </div>
                <div className="space-y-3">
                  {MATERIAL_ITEMS.map((item) => {
                    const quantity = summaryData.materials.quantities[item.name] || 0;
                    const price = summaryData.materials.prices[item.name] || 0;
                    const cost = summaryData.materials.costs[item.name] || 0;
                    const isDirectCost = item.unit === '元';

                    return (
                      <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                        <div className="md:col-span-5 text-xl font-medium text-slate-600 dark:text-slate-400">
                          {item.name}
                        </div>
                        <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                          {isDirectCost ? '-' : quantity.toFixed(2)}
                        </div>
                        <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                          {isDirectCost ? '-' : price}
                        </div>
                        <div className="md:col-span-3 text-xl text-slate-700 dark:text-slate-300 text-right font-semibold">
                          ¥{cost.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 p-4 bg-sky-50 dark:bg-sky-950/20 rounded-lg border border-sky-100 dark:border-sky-900/30">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                    <span className="text-xl font-bold text-sky-700 dark:text-sky-400">
                      ¥{calculateSubtotal(summaryData.materials.costs).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 人工与维护类成本汇总 */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/30 py-4">
                <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {/* 表头 */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="md:col-span-7 text-xl font-semibold text-slate-700 dark:text-slate-300">成本项目</div>
                  <div className="md:col-span-2 text-xl font-semibold text-slate-700 dark:text-slate-300 text-right">金额</div>
                  <div className="md:col-span-3 text-xl font-semibold text-slate-700 dark:text-slate-300 text-center">单位</div>
                </div>
                <div className="space-y-3">
                  {LABOR_MAINTENANCE_ITEMS.map((item) => (
                    <div key={item.name} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center">
                      <div className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                        {item.name}
                      </div>
                      <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                        {(summaryData.laborAndMaintenance[item.name] || 0).toFixed(2)}
                      </div>
                      <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                        {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                    <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
                      ¥{calculateSubtotal(summaryData.laborAndMaintenance).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 期间费用与税费汇总 */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="bg-violet-50 dark:bg-violet-950/30 border-b border-violet-100 dark:border-violet-900/30 py-4">
                <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <div className="p-1.5 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
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
                      <div className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                        {item.name}
                      </div>
                      <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                        {(summaryData.periodExpenses[item.name] || 0).toFixed(2)}
                      </div>
                      <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                        {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-100 dark:border-violet-900/30">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                    <span className="text-xl font-bold text-violet-700 dark:text-violet-400">
                      ¥{calculateSubtotal(summaryData.periodExpenses).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 调整项汇总 */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-4">
                <CardTitle className="text-base text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
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
                      <div className="md:col-span-7 text-xl font-medium text-slate-600 dark:text-slate-400">
                        {item.name}
                      </div>
                      <div className="md:col-span-2 text-xl text-slate-700 dark:text-slate-300 text-right">
                        {(summaryData.adjustments[item.name] || 0).toFixed(2)}
                      </div>
                      <div className="md:col-span-3 text-xl text-slate-500 dark:text-slate-500 text-center">
                        {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-slate-700 dark:text-slate-300">小计</span>
                    <span className="text-xl font-bold text-red-600 dark:text-red-400">
                      ¥{calculateSubtotal(summaryData.adjustments).toFixed(2)}
                    </span>
                  </div>
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
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">原材料成本</span>
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                      ¥{calculateSubtotal(summaryData.materials.costs).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">人工与维护成本</span>
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                      ¥{calculateSubtotal(summaryData.laborAndMaintenance).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">期间费用</span>
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                      ¥{calculateSubtotal(summaryData.periodExpenses).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">调减其他收入</span>
                    <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                      -¥{calculateSubtotal(summaryData.adjustments).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 text-white rounded-xl mt-6 shadow-md">
                    <span className="text-2xl font-bold">总成本合计</span>
                    <span className="text-4xl font-bold">
                      ¥{(calculateSubtotal(summaryData.materials.costs) +
                          calculateSubtotal(summaryData.laborAndMaintenance) +
                          calculateSubtotal(summaryData.periodExpenses) -
                          calculateSubtotal(summaryData.adjustments)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
            )}
          </>
        )}

        {view === 'analysis' && (
          <CostAnalysisView
            totalCost={calculateSubtotal(summaryData.materials.costs) +
              calculateSubtotal(summaryData.laborAndMaintenance) +
              calculateSubtotal(summaryData.periodExpenses) -
              calculateSubtotal(summaryData.adjustments)}
            totalYield={summaryData.totalYield || 0}
            selectedProduct={selectedProduct}
          />
        )}
      </div>
    </div>
  );
}

// 成本分析视图组件
function CostAnalysisView({ totalCost, totalYield, selectedProduct }: { totalCost: number; totalYield: number; selectedProduct: string }) {
  // 32%烧碱的吨成本计算
  // 公式：总成本 * 0.53 / (碱产量/0.32)
  const alkaliCostPerTon = totalYield > 0 ? (totalCost * 0.53) / (totalYield / 0.32) : 0;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
          <CardTitle className="text-xl text-center text-slate-800 dark:text-slate-200">
            32%烧碱成本分析
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">总成本</div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  ¥{totalCost.toFixed(2)}
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">碱产量</div>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  {totalYield.toFixed(2)} 吨
                </div>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-xl shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-blue-100 text-sm mb-1">32%烧碱吨成本</div>
                  <div className="text-4xl font-bold">
                    ¥{alkaliCostPerTon.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-100 text-sm mb-1">计算公式</div>
                  <div className="text-sm opacity-80">
                    总成本 × 0.53 ÷ (碱产量 ÷ 0.32)
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3">计算说明</h3>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <div>• <strong>成本系数：</strong>0.53（32%烧碱在总成本中的占比）</div>
                <div>• <strong>碱产量：</strong>{totalYield.toFixed(2)} 吨</div>
                <div>• <strong>浓度：</strong>32%</div>
                <div>• <strong>计算公式：</strong>¥{totalCost.toFixed(2)} × 0.53 ÷ ({totalYield.toFixed(2)} ÷ 0.32) = ¥{alkaliCostPerTon.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
