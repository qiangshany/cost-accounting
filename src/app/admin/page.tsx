'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  totalYield: number; // 碱产量
  totalCost: number; // 总成本
  cost32Percent: number; // 32%烧碱对应的总成本
}

export default function AdminPage() {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'analysis'>('list');
  const [isLoading, setIsLoading] = useState(false);
  
  // 共享筛选状态
  const today = new Date();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: today,
    to: today
  });
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
  
  // 成本列表数据状态
  const [costListData, setCostListData] = useState<SummaryData>({
    materials: { quantities: {}, costs: {}, prices: {} },
    laborAndMaintenance: {},
    periodExpenses: {},
    adjustments: {},
    workshops: [],
    totalYield: 0,
    totalCost: 0,
    cost32Percent: 0,
  });
  
  // 成本分析视图使用的成本数据（日期往前推一天）
  const [analysisCostData, setAnalysisCostData] = useState<SummaryData>({
    materials: { quantities: {}, costs: {}, prices: {} },
    laborAndMaintenance: {},
    periodExpenses: {},
    adjustments: {},
    workshops: [],
    totalYield: 0,
    totalCost: 0,
    cost32Percent: 0,
  });
  
  // 销售数据状态（供成本分析视图使用）
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('32%烧碱');
  const [isUploading, setIsUploading] = useState(false);
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
  
  // 加载成本列表数据
  // 规则：
  // 1. 如果结束日期是今天，数据计算从开始日期到当天的前一天
  // 2. 如果结束日期不是今天，根据日期区间的数据进行计算
  const loadCostListData = async () => {
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    setIsLoading(true);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const queryToDate = new Date(dateRange.to);
    queryToDate.setHours(0, 0, 0, 0);
    
    // 如果结束日期包含今天，查询范围改为开始日期到昨天
    let queryFromDate: Date;
    let queryEndDate: Date;
    
    if (queryToDate.getTime() >= today.getTime()) {
      // 结束日期包含今天，使用开始日期到昨天的范围
      queryFromDate = new Date(dateRange.from);
      queryEndDate = new Date(today);
      queryEndDate.setDate(queryEndDate.getDate() - 1);
    } else {
      // 结束日期不包含今天，使用原始日期范围
      queryFromDate = new Date(dateRange.from);
      queryEndDate = new Date(dateRange.to);
    }
    
    // 如果查询结束日期早于开始日期，直接返回空数据
    if (queryEndDate < queryFromDate) {
      setCostListData({
        materials: { quantities: {}, costs: {}, prices: {} },
        laborAndMaintenance: {},
        periodExpenses: {},
        adjustments: {},
        workshops: [],
        totalYield: 0,
        totalCost: 0,
        cost32Percent: 0,
      });
      setIsLoading(false);
      return;
    }
    
    const fromDateStr = format(queryFromDate, 'yyyy-MM-dd');
    const toDateStr = format(queryEndDate, 'yyyy-MM-dd');
    
    try {
      const response = await fetch(
        `/api/admin-cost-list?startDate=${fromDateStr}&endDate=${toDateStr}&product=${selectedMaterial}`
      );

      if (!response.ok) {
        throw new Error('加载数据失败');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setCostListData(data.data);
      } else {
        setCostListData({
          materials: { quantities: {}, costs: {}, prices: {} },
          laborAndMaintenance: {},
          periodExpenses: {},
          adjustments: {},
          workshops: [],
          totalYield: 0,
          totalCost: 0,
          cost32Percent: 0,
        });
      }
    } catch (error) {
      console.error('加载成本列表数据失败:', error);
      setCostListData({
        materials: { quantities: {}, costs: {}, prices: {} },
        laborAndMaintenance: {},
        periodExpenses: {},
        adjustments: {},
        workshops: [],
        totalYield: 0,
        totalCost: 0,
        cost32Percent: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // 加载成本分析的成本数据
  // 规则：使用销售日期的前一天进行计算
  // 例如：销售日期 4.5-4.8，使用成本日期 4.4-4.7
  const loadAnalysisCostData = async () => {
    if (!dateRange.from || !dateRange.to) {
      return;
    }

    setIsLoading(true);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const salesToDate = new Date(dateRange.to);
    salesToDate.setHours(0, 0, 0, 0);
    
    // 成本数据的日期区间是销售日期区间的前一天
    let queryFromDate = new Date(dateRange.from);
    queryFromDate.setDate(queryFromDate.getDate() - 1);
    
    let queryEndDate = new Date(dateRange.to);
    queryEndDate.setDate(queryEndDate.getDate() - 1);
    
    // 如果结束日期包含今天，成本结束日期改为昨天
    if (salesToDate.getTime() >= today.getTime()) {
      queryEndDate = new Date(today);
      queryEndDate.setDate(queryEndDate.getDate() - 1);
    }
    
    // 如果查询结束日期早于开始日期，直接返回空数据
    if (queryEndDate < queryFromDate) {
      setAnalysisCostData({
        materials: { quantities: {}, costs: {}, prices: {} },
        laborAndMaintenance: {},
        periodExpenses: {},
        adjustments: {},
        workshops: [],
        totalYield: 0,
        totalCost: 0,
        cost32Percent: 0,
      });
      setIsLoading(false);
      return;
    }
    
    const fromDateStr = format(queryFromDate, 'yyyy-MM-dd');
    const toDateStr = format(queryEndDate, 'yyyy-MM-dd');
    
    try {
      const response = await fetch(
        `/api/admin-cost-list?startDate=${fromDateStr}&endDate=${toDateStr}&product=${selectedMaterial}`
      );

      if (!response.ok) {
        throw new Error('加载数据失败');
      }

      const data = await response.json();

      if (data.success && data.data) {
        setAnalysisCostData(data.data);
      } else {
        setAnalysisCostData({
          materials: { quantities: {}, costs: {}, prices: {} },
          laborAndMaintenance: {},
          periodExpenses: {},
          adjustments: {},
          workshops: [],
          totalYield: 0,
          totalCost: 0,
          cost32Percent: 0,
        });
      }
    } catch (error) {
      console.error('加载成本分析成本数据失败:', error);
      setAnalysisCostData({
        materials: { quantities: {}, costs: {}, prices: {} },
        laborAndMaintenance: {},
        periodExpenses: {},
        adjustments: {},
        workshops: [],
        totalYield: 0,
        totalCost: 0,
        cost32Percent: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // 加载销售数据
  const loadSalesData = async () => {
    setIsLoading(true);
    
    try {
      const pageSize = 1000;
      let page = 0;
      let allData: SalesData[] = [];
      let hasMore = true;

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
          hasMore = result.hasMore || false;
          page++;
        } else {
          hasMore = false;
        }
      }

      setSalesData(allData);
    } catch (error) {
      console.error('加载销售数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 当日期、产品变化时，重新加载成本列表数据
  useEffect(() => {
    if (view === 'list') {
      loadCostListData();
    }
  }, [dateRange, selectedMaterial, view]);
  
  // 当切换到成本分析视图时，加载销售数据和成本数据
  useEffect(() => {
    if (view === 'analysis') {
      if (salesData.length === 0) {
        loadSalesData();
      }
      // 加载成本分析的成本数据（使用前一天）
      loadAnalysisCostData();
    }
  }, [view, dateRange, selectedMaterial]);

  // 检查登录状态和角色
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');

    if (loggedIn !== 'true' || userRole !== 'admin') {
      router.push('/');
      return;
    }
  }, [router]);
  
  // Excel上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // 验证数据结构
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        throw new Error('Excel文件为空或格式不正确');
      }

      const firstRow = jsonData[0] as Record<string, unknown>;
      const requiredFields = ['单据日期', '客户', '业务员', '物料名称', '主数量', '主含税净价', '价税合计', '出库主数量'];
      const missingFields = requiredFields.filter(field => !(field in firstRow));

      if (missingFields.length > 0) {
        throw new Error(`缺少必要字段: ${missingFields.join(', ')}`);
      }

      // Excel 日期序列号转换为日期字符串
      // Excel 日期从 1900-01-01 开始（序列号 1 = 1900-01-01）
      const excelDateToString = (value: unknown): string => {
        if (!value) return '';
        
        // 如果已经是字符串格式的日期，直接返回
        if (typeof value === 'string') {
          // 检查是否是有效的日期格式
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return value.split('T')[0]; // 返回 YYYY-MM-DD 格式
          }
          return value;
        }
        
        // 如果是数字，视为 Excel 日期序列号
        if (typeof value === 'number') {
          // Excel 日期序列号：序列号 1 = 1900-01-01
          // 但 Excel 有一个 bug，把 1900 年当作闰年，所以需要减 1
          // JavaScript Date 从 1970-01-01 开始，所以转换逻辑不同
          // 直接用 XLSX 库的公式：Excel 日期 = (JavaScript 日期 - 25569) * 86400 * 1000
          // 或者更简单的：Excel 日期序列号 46119 = 2026-04-08
          // 从 1900-01-01 (序列号 1) 到 1970-01-01 (序列号 25569) 是 25568 天
          // 从 Excel 序列号转换为 JavaScript 日期
          const excelEpoch = new Date(1899, 11, 30); // 1899-12-30 是 Excel 日期 0
          const date = new Date(excelEpoch.getTime() + value * 86400000);
          return date.toISOString().split('T')[0];
        }
        
        return String(value);
      };

      const salesDataArr: SalesData[] = jsonData.map((row: Record<string, unknown>) => ({
        单据日期: excelDateToString(row['单据日期']),
        客户: String(row['客户'] || ''),
        业务员: String(row['业务员'] || ''),
        物料名称: String(row['物料名称'] || ''),
        销售计划数量: Number(row['主数量']) || 0,
        含税净价: Number(row['主含税净价']) || 0,
        价税合计: Number(row['价税合计']) || 0,
        出库数量: Number(row['出库主数量']) || 0,
      }));

      // 保存到数据库
      const response = await fetch('/api/sales-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salesData: salesDataArr }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }

      // 重新加载数据
      await loadSalesData();

      const insertedCount = result.data?.insertedCount || 0;
      const failedCount = result.data?.failedCount || 0;
      toast.success(`数据已保存！共 ${insertedCount} 条记录导入成功${failedCount > 0 ? `，${failedCount} 条失败` : ''}`);
    } catch (error) {
      console.error('解析Excel失败:', error);
      toast.error(error instanceof Error ? error.message : '解析Excel文件失败');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 计算小计
  const calculateSubtotal = (obj: Record<string, number>) => {
    return Object.values(obj).reduce((sum, val) => sum + (val || 0), 0);
  };

  // 判断是否有任何数据
  const hasAnyData = () => {
    const hasMaterials = Object.keys(costListData.materials.quantities).length > 0;
    const hasLabor = Object.keys(costListData.laborAndMaintenance).length > 0;
    const hasPeriod = Object.keys(costListData.periodExpenses).length > 0;
    const hasAdjustments = Object.keys(costListData.adjustments).length > 0;
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

  // 物料名称标准化函数
  const normalizeMaterialName = (name: string): string => {
    if (name.includes('32%工业级烧碱') || name.includes('32%食品级烧碱') || name.includes('32%烧碱')) {
      return '32%烧碱';
    }
    return name;
  };

  // 从Excel导入的数据中提取唯一物料（标准化后）
  const uniqueMaterials = useMemo(() => {
    const materials = salesData.map(item => item.物料名称).filter(Boolean);
    const normalizedMaterials = materials.map(normalizeMaterialName);
    const uniqueSet = [...new Set(normalizedMaterials)];
    return uniqueSet.sort();
  }, [salesData]);

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

        {/* 筛选组件 - Excel导入和产品/日期筛选 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Excel导入 */}
              <div className="flex items-center gap-2">
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
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? '导入中...' : '导入Excel'}
                </Button>
              </div>
              
              {/* 日期筛选 - 左边 */}
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-slate-700 dark:text-slate-300">日期</span>
                <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-36 justify-start text-left text-sm">
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
                <span className="text-slate-500 text-sm">至</span>
                <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-36 justify-start text-left text-sm">
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
              
              {/* 产品筛选 - 右边 */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="text-base font-medium text-slate-700 dark:text-slate-300">产品</span>
                <div className="flex flex-wrap gap-2">
                  {uniqueMaterials.length > 0 ? uniqueMaterials.map(material => (
                    <Button
                      key={material}
                      variant={selectedMaterial === material ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMaterial(material)}
                      className={`text-base px-4 py-2 ${selectedMaterial === material
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      {material}
                    </Button>
                  )) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">请先导入Excel数据</span>
                  )}
                </div>
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
                    const quantity = costListData.materials.quantities[item.name] || 0;
                    const price = costListData.materials.prices[item.name] || 0;
                    const cost = costListData.materials.costs[item.name] || 0;
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
                      ¥{calculateSubtotal(costListData.materials.costs).toFixed(2)}
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
                        {(costListData.laborAndMaintenance[item.name] || 0).toFixed(2)}
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
                      ¥{calculateSubtotal(costListData.laborAndMaintenance).toFixed(2)}
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
                        {(costListData.periodExpenses[item.name] || 0).toFixed(2)}
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
                      ¥{calculateSubtotal(costListData.periodExpenses).toFixed(2)}
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
                        {(costListData.adjustments[item.name] || 0).toFixed(2)}
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
                      ¥{calculateSubtotal(costListData.adjustments).toFixed(2)}
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
                      ¥{calculateSubtotal(costListData.materials.costs).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">人工与维护成本</span>
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                      ¥{calculateSubtotal(costListData.laborAndMaintenance).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">期间费用</span>
                    <span className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                      ¥{calculateSubtotal(costListData.periodExpenses).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xl text-slate-600 dark:text-slate-400">调减其他收入</span>
                    <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                      -¥{calculateSubtotal(costListData.adjustments).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 text-white rounded-xl mt-6 shadow-md">
                    <span className="text-2xl font-bold">总成本合计</span>
                    <span className="text-4xl font-bold">
                      ¥{(calculateSubtotal(costListData.materials.costs) +
                          calculateSubtotal(costListData.laborAndMaintenance) +
                          calculateSubtotal(costListData.periodExpenses) -
                          calculateSubtotal(costListData.adjustments)).toFixed(2)}
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
            salesData={salesData}
            dateRange={dateRange}
            selectedMaterial={selectedMaterial}
            costListData={analysisCostData}
          />
        )}
      </div>
    </div>
  );
}

// 成本分析视图组件 Props
interface CostAnalysisViewProps {
  salesData: SalesData[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  selectedMaterial: string;
  costListData?: SummaryData;
}

function CostAnalysisView({ 
  salesData, 
  dateRange, 
  selectedMaterial,
  costListData
}: CostAnalysisViewProps) {
  
  // 物料名称标准化
  const normalizeMaterialName = (name: string): string => {
    if (name.includes('32%工业级烧碱') || name.includes('32%食品级烧碱') || name.includes('32%烧碱')) {
      return '32%烧碱';
    }
    return name;
  };
  
  // 标准化销售数据
  const normalizedSalesData = useMemo(() => {
    return salesData.map(item => ({
      ...item,
      物料名称: normalizeMaterialName(item.物料名称)
    }));
  }, [salesData]);
  
  // 使用标准化后的数据
  const rawData = normalizedSalesData;

  // 计算小计函数
  const calculateSubtotal = (obj: Record<string, number>) => {
    return Object.values(obj).reduce((sum, val) => sum + (val || 0), 0);
  };

  // 悬浮状态
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 颜色配置
  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
  ];

  // 图表数据接口
  interface ChartData {
    name: string;
    value: number;
    percentage: string;
    avgPrice: string;
  }

  // 过滤数据
  const filteredData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];

    // 使用本地日期字符串进行比较，避免时区问题
    const fromDateStr = format(dateRange.from, 'yyyy-MM-dd');
    const toDateStr = format(dateRange.to, 'yyyy-MM-dd');

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

  // 计算单位成本和毛利润
  // 吨成本 = 32%烧碱总成本 × 0.53 / (碱产量 / 0.32)
  const { unitCost, grossProfit } = useMemo(() => {
    if (!costListData || !costListData.cost32Percent || !costListData.totalYield) {
      // 如果没有成本数据，仍然计算毛利（成本为0时毛利=均价）
      return { unitCost: 0, grossProfit: avgPrice };
    }

    // 32%烧碱对应的总成本
    const cost32Percent = costListData.cost32Percent;
    
    // 碱产量
    const totalYield = costListData.totalYield;
    
    // 吨成本（元/吨）= cost32Percent × 0.53 / (碱产量 / 0.32)
    // 即：吨成本 = 总成本 × 0.53 × 0.32 / 碱产量
    const cost = totalYield > 0 ? (cost32Percent * 0.53 * 0.32) / totalYield : 0;
    
    // 毛利润 = 销售均价 - 单位成本
    const profit = avgPrice - cost;
    
    return { unitCost: cost, grossProfit: profit };
  }, [costListData, avgPrice]);

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
      {/* 数据加载提示 */}
      {salesData.length === 0 && (
        <Card className="shadow-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                正在加载销售数据...
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 饼图 */}
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-4">
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
                  ，成本 <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{unitCost.toFixed(2)} 元/吨</span>
                  ，毛利润 <span className={grossProfit >= 0 ? "text-xl font-bold text-green-600 dark:text-green-400" : "text-xl font-bold text-red-600 dark:text-red-400"}>{grossProfit.toFixed(2)} 元/吨</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  高于此均价的客户 {aboveAvgData.count} 家，销售计划数量共计 {aboveAvgData.quantity.toFixed(2)} 吨，占比 {aboveAvgData.quantityRatio}%
                </p>
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
