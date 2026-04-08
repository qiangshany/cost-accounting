'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Calculator, LogOut, TrendingUp, Calendar as CalendarIcon, Factory, Trash2, List, BarChart3, Upload, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

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
      
      // 将日期减去一天，加载前一天的数据
      const queryDate = new Date(selectedDate);
      queryDate.setDate(queryDate.getDate() - 1);
      const queryDateStr = queryDate.toISOString().split('T')[0];
      
      try {
        const response = await fetch(
          `/api/admin-summary?date=${queryDateStr}&product=${selectedProduct}`
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
                {selectedDate && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    查看前一天的成本数据（{selectedDate} 查看 {(() => {
                      const prevDate = new Date(selectedDate);
                      prevDate.setDate(prevDate.getDate() - 1);
                      return prevDate.toISOString().split('T')[0];
                    })()}）
                  </p>
                )}
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
          <CostAnalysisView />
        )}
      </div>
    </div>
  );
}

// 成本分析视图组件
function CostAnalysisView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 销售数据接口
  interface SalesData {
    单据日期: string;
    客户: string;
    业务员: string;
    物料名称: string;
    销售计划数量: number;
    含税净价: number;
    价税合计: number;
    出库数量: number;
  }

  // 状态管理
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 颜色配置
  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
  ];

  // 从数据库加载销售数据
  useEffect(() => {
    const loadAllSalesData = async () => {
      setIsLoading(true);
      setLoadingProgress({ loaded: 0, total: 0 });

      try {
        const pageSize = 1000;
        let page = 0;
        let allData: SalesData[] = [];
        let hasMore = true;
        let totalCount = 0;

        // 分页加载所有数据
        while (hasMore) {
          const params = new URLSearchParams();
          params.append('page', page.toString());
          params.append('pageSize', pageSize.toString());

          const response = await fetch(`/api/sales-data?${params.toString()}`);

          if (!response.ok) {
            throw new Error('加载数据失败');
          }

          const result = await response.json();

          if (result.success && result.data) {
            allData = [...allData, ...result.data];
            totalCount = result.total || 0;
            setLoadingProgress({ loaded: allData.length, total: totalCount });
            hasMore = result.hasMore || false;
            page++;
          } else {
            hasMore = false;
          }
        }

        // 一次性设置所有数据
        setRawData(allData);
      } catch (error) {
        console.error('加载销售数据失败:', error);
      } finally {
        setIsLoading(false);
        setLoadingProgress({ loaded: 0, total: 0 });
      }
    };

    // 首次加载所有数据
    loadAllSalesData();
  }, []); // 仅在组件加载时执行一次

  // 图表数据接口
  interface ChartData {
    name: string;
    value: number;
    percentage: string;
    avgPrice: string;
  }

  // 物料名称标准化
  const normalizeMaterialName = (name: string): string => {
    if (name.includes('32%工业级烧碱') || name.includes('32%食品级烧碱')) {
      return '32%烧碱';
    }
    return name;
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. 读取Excel文件
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 2. 转换为JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, string>[];

      // 3. 映射数据格式
      const salesData: SalesData[] = jsonData.map(row => ({
        单据日期: row['单据日期'] || '',
        客户: row['客户'] || '',
        业务员: row['业务员'] || '',
        物料名称: normalizeMaterialName(row['物料名称'] || ''),
        销售计划数量: parseFloat(String(row['销售计划数量']).replace(/,/g, '')) || 0,
        含税净价: parseFloat(String(row['含税净价']).replace(/,/g, '')) || 0,
        价税合计: parseFloat(String(row['价税合计']).replace(/,/g, '')) || 0,
        出库数量: parseFloat(String(row['出库数量']).replace(/,/g, '')) || 0
      })).filter(item => item.单据日期 && item.物料名称);

      // 4. 删除旧数据
      const deleteResponse = await fetch('/api/sales-data?deleteAll=true', {
        method: 'DELETE',
      });

      const deleteResult = await deleteResponse.json();
      if (!deleteResult.success) {
        throw new Error(`删除旧数据失败: ${deleteResult.error || '删除失败'}`);
      }

      // 5. 保存到数据库（分批上传）
      const MAX_BATCH_SIZE = 1000;
      let totalSaved = 0;

      if (salesData.length <= MAX_BATCH_SIZE) {
        // 单批次上传
        const response = await fetch('/api/sales-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ salesData }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '保存失败');
        }

        totalSaved = salesData.length;
      } else {
        // 分批上传
        const batches = Math.ceil(salesData.length / MAX_BATCH_SIZE);

        for (let i = 0; i < batches; i++) {
          const start = i * MAX_BATCH_SIZE;
          const end = Math.min(start + MAX_BATCH_SIZE, salesData.length);
          const batch = salesData.slice(start, end);

          const response = await fetch('/api/sales-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ salesData: batch }),
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(`第 ${i + 1} 批保存失败: ${result.error || '保存失败'}`);
          }

          totalSaved += result.data?.length || 0;
        }
      }

      // 6. 重新加载数据
      const loadAllData = async () => {
        const pageSize = 1000;
        let page = 0;
        let allData: SalesData[] = [];
        let hasMore = true;

        while (hasMore) {
          const params = new URLSearchParams();
          params.append('page', page.toString());
          params.append('pageSize', pageSize.toString());

          const response = await fetch(`/api/sales-data?${params.toString()}`);
          const result = await response.json();

          if (result.success && result.data) {
            allData = [...allData, ...result.data];
            hasMore = result.hasMore || false;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData;
      };

      const allNewData = await loadAllData();
      setRawData(allNewData);

      // 7. 自动设置默认日期（使用最晚日期）
      const dates = salesData.map(item => item.单据日期).filter(Boolean);
      const latestDate = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      if (latestDate) {
        setDateRange({ from: new Date(latestDate), to: new Date(latestDate) });
      }

      toast.success(`数据已保存！共 ${totalSaved} 条记录（旧数据已清除）`);
    } catch (error) {
      console.error('解析Excel失败:', error);
      toast.error(error instanceof Error ? error.message : '解析Excel文件失败');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 提取唯一物料
  const uniqueMaterials = useMemo(() => {
    const materials = rawData.map(item => item.物料名称).filter(Boolean);
    return [...new Set(materials)].sort();
  }, [rawData]);

  // 过滤数据
  const filteredData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];

    // 使用ISO日期字符串进行比较，避免时区问题
    const fromDateStr = new Date(dateRange.from).toISOString().split('T')[0];
    const toDateStr = new Date(dateRange.to).toISOString().split('T')[0];

    return rawData.filter(item => {
      const itemDate = item.单据日期;
      if (!itemDate) return false;

      // itemDate可能是 "2026-04-08" 格式
      return itemDate >= fromDateStr && itemDate <= toDateStr;
    });
  }, [rawData, dateRange, selectedMaterial]);

  // 根据选择的物料再次过滤
  const finalFilteredData = useMemo(() => {
    if (!selectedMaterial) return filteredData;
    return filteredData.filter(item => item.物料名称 === selectedMaterial);
  }, [filteredData, selectedMaterial]);

  // 计算表格数据（按客户聚合）
  const tableData = useMemo(() => {
    if (!selectedMaterial || filteredData.length === 0) return [];

    // 1. 过滤选定物料
    const materialData = filteredData.filter(item => 
      item.物料名称 === selectedMaterial
    );
    
    // 2. 按客户聚合
    const customerTotals = new Map<string, { quantity: number; totalPrice: number }>();
    materialData.forEach(item => {
      const current = customerTotals.get(item.客户) || { quantity: 0, totalPrice: 0 };
      customerTotals.set(item.客户, {
        quantity: current.quantity + (item.销售计划数量 || 0),
        totalPrice: current.totalPrice + (item.价税合计 || 0)
      });
    });

    const totalQuantity = Array.from(customerTotals.values()).reduce((sum, val) => sum + val.quantity, 0);
    
    // 3. 转换为表格数据
    return Array.from(customerTotals.entries())
      .filter(([_, val]) => val.quantity > 0)
      .map(([name, val]) => ({
        name,
        value: val.quantity,
        percentage: totalQuantity > 0 ? `${((val.quantity / totalQuantity) * 100).toFixed(2)}%` : '0%',
        avgPrice: val.quantity > 0 ? (val.totalPrice / val.quantity).toFixed(2) : '0.00'
      }))
      .sort((a, b) => b.value - a.value); // 降序排列
  }, [filteredData, selectedMaterial]);

  // 饼图数据（前10客户，其余合并为"其他"）
  const chartData = useMemo(() => {
    if (tableData.length === 0) return [];
    
    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    
    // 如果客户数超过10，合并剩余客户为"其他"
    if (tableData.length > 10) {
      const top10 = tableData.slice(0, 10).map(item => ({ ...item }));
      const others = tableData.slice(10);
      
      const otherValue = others.reduce((sum, item) => sum + item.value, 0);
      const otherTotalPrice = others.reduce((sum, item) => sum + (item.value * parseFloat(item.avgPrice)), 0);
      
      top10.push({
        name: '其他',
        value: otherValue,
        percentage: totalQuantity > 0 ? `${((otherValue / totalQuantity) * 100).toFixed(2)}%` : '0%',
        avgPrice: otherValue > 0 ? (otherTotalPrice / otherValue).toFixed(2) : '0.00'
      });
      
      return top10;
    }

    return tableData;
  }, [tableData]);

  // 计算每个扇区的中心角度和左右分配
  const { leftLabels, rightLabels, sectorsWithAngle } = useMemo(() => {
    if (chartData.length === 0) return { leftLabels: [], rightLabels: [], sectorsWithAngle: [] };
    
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const RADIAN = Math.PI / 180;
    
    // 计算每个扇区的中心角度
    let currentAngle = 90; // 从顶部开始
    const sectors = chartData.map((item, index) => {
      const angle = (item.value / total) * 360;
      const midAngle = currentAngle - angle / 2;
      currentAngle -= angle;
      return { ...item, index, midAngle };
    });
    
    // 根据角度分配到左右两侧
    // midAngle在90°~270°之间为左侧，否则为右侧
    const left = sectors.filter(s => {
      const normalizedAngle = ((s.midAngle % 360) + 360) % 360;
      return normalizedAngle > 90 && normalizedAngle < 270;
    }).sort((a, b) => {
      // "其他"排在最前
      if (a.name === '其他') return -1;
      if (b.name === '其他') return 1;
      return a.value - b.value; // 升序排列
    });
    
    const right = sectors.filter(s => {
      const normalizedAngle = ((s.midAngle % 360) + 360) % 360;
      return normalizedAngle <= 90 || normalizedAngle >= 270;
    }).sort((a, b) => b.value - a.value); // 降序排列
    
    return { leftLabels: left, rightLabels: right, sectorsWithAngle: sectors };
  }, [chartData]);

  // 排序状态
  const [sortKey, setSortKey] = useState<'value' | 'percentage' | 'avgPrice'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 计算整体均价
  const avgPrice = useMemo(() => {
    if (tableData.length === 0) return 0;

    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    if (totalQuantity === 0) return 0;

    // 重新计算价税合计总和
    const totalPrice = tableData.reduce((sum, item) => {
      return sum + (item.value * parseFloat(item.avgPrice));
    }, 0);

    return totalPrice / totalQuantity;
  }, [tableData]);

  // 计算高于均价的客户数据
  const aboveAvgData = useMemo(() => {
    if (tableData.length === 0) {
      return { count: 0, quantity: 0, quantityRatio: '0.00' };
    }

    const aboveAvgCustomers = tableData.filter(item => parseFloat(item.avgPrice) > avgPrice);
    const count = aboveAvgCustomers.length;

    // 计算高于均价客户的销售计划数量和占比
    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    const aboveAvgQuantity = aboveAvgCustomers.reduce((sum, item) => sum + item.value, 0);
    const quantityRatio = totalQuantity > 0 ? ((aboveAvgQuantity / totalQuantity) * 100).toFixed(2) : '0.00';

    return { count, quantity: aboveAvgQuantity, quantityRatio };
  }, [tableData, avgPrice]);

  // 排序后的数据
  const sortedTableData = useMemo(() => {
    const dataWithIndex = tableData.map((item, index) => ({ ...item, originalIndex: index }));
    
    return dataWithIndex.sort((a, b) => {
      let aVal: number, bVal: number;
      
      if (sortKey === 'value') {
        aVal = a.value;
        bVal = b.value;
      } else if (sortKey === 'percentage') {
        aVal = parseFloat(a.percentage);
        bVal = parseFloat(b.percentage);
      } else {
        aVal = parseFloat(a.avgPrice);
        bVal = parseFloat(b.avgPrice);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [tableData, sortKey, sortOrder]);

  // 排序处理函数
  const handleSort = (key: 'value' | 'percentage' | 'avgPrice') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* 加载进度提示 */}
      {isLoading && (
        <Card className="shadow-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  正在加载数据...
                </span>
              </div>
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {loadingProgress.loaded} / {loadingProgress.total}
              </span>
            </div>
            {loadingProgress.total > 0 && (
              <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(loadingProgress.loaded / loadingProgress.total) * 100}%`
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 第一部分：Excel导入和筛选框 */}
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
          <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
            销售数据导入与筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Excel导入 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? '导入中...' : '导入Excel'}
              </Button>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                支持格式：.xlsx, .xls
              </p>
            </div>

            {/* 日期区间筛选 */}
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                日期区间筛选
              </Label>
              <div className="flex gap-2">
                {/* 起始日期 */}
                <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, 'yyyy-MM-dd', { locale: zhCN }) : "起始日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => {
                        if (date) {
                          const newRange = { ...dateRange, from: date };
                          if (!dateRange.to || dateRange.to < date) {
                            newRange.to = date;
                          }
                          setDateRange(newRange);
                          setIsStartCalendarOpen(false);
                        }
                      }}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>

                {/* 结束日期 */}
                <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, 'yyyy-MM-dd', { locale: zhCN }) : "结束日期"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => {
                        if (date) {
                          const newRange = { ...dateRange, to: date };
                          if (!dateRange.from || dateRange.from > date) {
                            newRange.from = date;
                          }
                          setDateRange(newRange);
                          setIsEndCalendarOpen(false);
                        }
                      }}
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 物料筛选 */}
            <div>
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                物料筛选
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!selectedMaterial ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMaterial('')}
                  className={!selectedMaterial 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                  }
                >
                  全部
                </Button>
                {uniqueMaterials.map(material => (
                  <Button
                    key={material}
                    variant={selectedMaterial === material ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMaterial(material)}
                    className={selectedMaterial === material 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }
                  >
                    {material}
                  </Button>
                ))}
              </div>
            </div>

            {/* 数据统计 */}
            {rawData.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">总记录数</div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{rawData.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">筛选后记录</div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{finalFilteredData.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">总出库数量</div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      {finalFilteredData.reduce((sum, item) => sum + item.出库数量, 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">价税合计</div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      ¥{finalFilteredData.reduce((sum, item) => sum + item.价税合计, 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 第二部分：饼图 */}
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
          <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
            销售分析图表
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-slate-500 dark:text-slate-400">
                {!selectedMaterial ? '请选择物料后查看图表' : '暂无数据'}
              </p>
            </div>
          ) : (
            <div className="relative h-[500px]">
              {/* SVG连线层 */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 900 500">
                {(() => {
                  if (sectorsWithAngle.length === 0 || hoveredIndex === null) return null;
                  
                  const RADIAN = Math.PI / 180;
                  const cx = 450; // 饼图中心
                  const cy = 250; // 饼图垂直中心
                  const outerRadius = 150;
                  
                  const padding = 50;
                  const labelX = 190; // 左侧标签X位置
                  const rightLabelX = 710; // 右侧标签X位置
                  
                  // 找到当前悬浮的客户数据
                  const hoveredItem = [...leftLabels, ...rightLabels].find(item => item.index === hoveredIndex);
                  if (!hoveredItem) return null;
                  
                  // 判断是左侧还是右侧
                  const isLeft = leftLabels.some(item => item.index === hoveredIndex);
                  const labels = isLeft ? leftLabels : rightLabels;
                  const labelIndex = labels.findIndex(item => item.index === hoveredIndex);
                  const labelY = padding + (500 / (labels.length + 1)) * (labelIndex + 1);
                  
                  // 计算边缘点
                  const edgeX = cx + outerRadius * Math.cos(-hoveredItem.midAngle * RADIAN);
                  const edgeY = cy + outerRadius * Math.sin(-hoveredItem.midAngle * RADIAN);
                  
                  const targetX = isLeft ? labelX : rightLabelX;
                  
                  return (
                    <path
                      d={`M${edgeX},${edgeY}L${targetX},${labelY}`}
                      fill="none"
                      stroke={COLORS[hoveredIndex % COLORS.length]}
                      strokeWidth={2.5}
                      style={{ filter: `drop-shadow(0 0 4px ${COLORS[hoveredIndex % COLORS.length]}40)` }}
                    />
                  );
                })()}
              </svg>
              
              {/* 左侧标签列 */}
              <div className="absolute left-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12">
                {leftLabels.map((item, i) => {
                  const total = leftLabels.length;
                  const padding = 50;
                  const availableHeight = 500 - padding * 2;
                  const labelY = padding + (availableHeight / (total + 1)) * (i + 1);
                  const isHovered = hoveredIndex === item.index;
                  
                  return (
                    <div 
                      key={item.name} 
                      className={cn(
                        "absolute left-2 flex items-center gap-2 text-sm cursor-pointer transition-all",
                        isHovered ? "font-semibold scale-105" : ""
                      )}
                      style={{ top: labelY, transform: 'translateY(-50%)' }}
                      onMouseEnter={() => setHoveredIndex(item.index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <span
                        className="w-3 h-3 rounded-full transition-transform"
                        style={{ 
                          backgroundColor: COLORS[item.index % COLORS.length],
                          transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                        }}
                      />
                      <span className="whitespace-nowrap">{item.name}: {item.percentage}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* 中间饼图 */}
              <div className="absolute left-[200px] right-[200px] top-0 bottom-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={150}
                      dataKey="value"
                      startAngle={90}  // 从顶部12点开始
                      endAngle={-270}  // 逆时针绘制
                      onMouseEnter={(_, index) => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {chartData.map((_, index) => {
                        const isHovered = hoveredIndex === index;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]}
                            stroke={isHovered ? COLORS[index % COLORS.length] : "white"}
                            strokeWidth={isHovered ? 3 : 2}
                            style={{
                              filter: isHovered ? 'brightness(1.1)' : 'none',
                              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                              transformOrigin: 'center',
                              transition: 'all 0.2s ease-out',
                              cursor: 'pointer',
                              opacity: hoveredIndex === null ? 1 : (isHovered ? 1 : 0.3)
                            }}
                          />
                        );
                      })}
                    </Pie>
                    
                    {/* 自定义Tooltip */}
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as ChartData;
                          return (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
                              <p className="font-semibold mb-1 text-slate-800 dark:text-slate-200">{data.name}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">数量：{data.value.toLocaleString()} 吨</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">均价：{data.avgPrice} 元/吨</p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">占比：{data.percentage}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* 右侧标签列 */}
              <div className="absolute right-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12">
                {rightLabels.map((item, i) => {
                  const total = rightLabels.length;
                  const padding = 50;
                  const availableHeight = 500 - padding * 2;
                  const labelY = padding + (availableHeight / (total + 1)) * (i + 1);
                  const isHovered = hoveredIndex === item.index;
                  
                  return (
                    <div 
                      key={item.name} 
                      className={cn(
                        "absolute right-2 flex items-center gap-2 text-sm cursor-pointer transition-all",
                        isHovered ? "font-semibold scale-105" : ""
                      )}
                      style={{ top: labelY, transform: 'translateY(-50%)' }}
                      onMouseEnter={() => setHoveredIndex(item.index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <span className="whitespace-nowrap">{item.name}: {item.percentage}</span>
                      <span
                        className="w-3 h-3 rounded-full transition-transform"
                        style={{ 
                          backgroundColor: COLORS[item.index % COLORS.length],
                          transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 第三部分：表格 */}
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700 py-4">
          <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
            客户销售分析表
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {tableData.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              {!selectedMaterial ? '请选择物料后查看分析表' : '暂无数据'}
            </div>
          ) : (
            <>
              {/* 统计文字 */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {selectedMaterial}：均价{' '}
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{avgPrice.toFixed(2)} 元/吨</span>
                  ，高于此均价的客户 {aboveAvgData.count} 家，
                  销售计划数量共计 {aboveAvgData.quantity.toFixed(2)} 吨，
                  占比 {aboveAvgData.quantityRatio}%
                </h3>
              </div>

              {/* 表格 */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-center font-medium w-16 text-slate-700 dark:text-slate-300">序号</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">客户名称</th>
                      
                      {/* 可排序列：销售计划数量 */}
                      <th 
                        className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('value')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>销售计划数量(吨)</span>
                          {sortKey === 'value' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 opacity-50" />
                          )}
                        </div>
                      </th>
                      
                      {/* 可排序列：占比 */}
                      <th 
                        className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('percentage')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>销售计划数量占比</span>
                          {sortKey === 'percentage' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 opacity-50" />
                          )}
                        </div>
                      </th>
                      
                      {/* 可排序列：客户单价 */}
                      <th
                        className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        onClick={() => handleSort('avgPrice')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>客户单价(元/吨)</span>
                          {sortKey === 'avgPrice' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 opacity-50" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sortedTableData.map((item, index) => {
                      const itemAvgPrice = parseFloat(item.avgPrice);
                      const isAboveAvg = itemAvgPrice > avgPrice;
                      
                      return (
                        <tr key={item.name} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[item.originalIndex % COLORS.length] }}
                            />
                            <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                            {item.value.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                            {item.percentage}
                          </td>
                          <td 
                            className={cn(
                              "px-4 py-3 text-right font-medium",
                              isAboveAvg
                                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            )}
                          >
                            {item.avgPrice}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  
                  {/* 表尾合计 */}
                  <tfoot className="bg-slate-50 dark:bg-slate-800 font-medium">
                    <tr>
                      <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">-</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">合计</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                        {tableData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">100%</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{avgPrice.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
