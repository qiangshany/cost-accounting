'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileSpreadsheet, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

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

interface ChartData {
  name: string;
  value: number;
  percentage: string;
  avgPrice: string; // 均价：价税合计之和/销售计划数量之和
  outQuantity: number; // 出库数量（实际销量）
  outPercentage: string; // 出库数量占比
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
];

// 物料名称标准化映射
const normalizeMaterialName = (name: string): string => {
  if (!name) return name;
  
  // 32%工业级烧碱 和 食品级烧碱 合并为 32%烧碱
  if (name.includes('32%工业级烧碱') || name.includes('食品级烧碱')) {
    return '32%烧碱';
  }
  
  return name;
};

export default function SalesAnalysis() {
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'value' | 'percentage' | 'avgPrice'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 页面加载时从数据库获取数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/sales-data');
        const result = await response.json();
        if (result.data && Array.isArray(result.data)) {
          setRawData(result.data);

          // 自动计算数据中最晚的日期，作为默认日期（今天）
          const dates = result.data.map((item: SalesData) => item.单据日期).filter(Boolean) as string[];
          const uniqueDates = [...new Set(dates)].sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
          const latestDate = uniqueDates[0];

          console.log('[日期设置] 唯一日期列表:', uniqueDates.slice(0, 5));
          console.log('[日期设置] 最晚日期:', latestDate);

          if (latestDate) {
            // 使用数据中最晚的日期作为默认日期
            const parsedDate = new Date(latestDate);
            console.log('[日期设置] 设置默认日期:', parsedDate.toISOString());
            setDateRange({ from: parsedDate, to: parsedDate });
          } else {
            // 如果没有日期数据，使用系统当前日期
            const today = new Date();
            console.log('[日期设置] 无数据日期，使用系统当前日期:', today.toISOString());
            setDateRange({ from: today, to: today });
          }

          // 默认选择"32%烧碱"，如果不存在则选择第一个物料
          const materials = [...new Set(result.data.map((item: SalesData) => normalizeMaterialName(item.物料名称)))];
          if (materials.includes('32%烧碱')) {
            setSelectedMaterial('32%烧碱');
          } else if (materials.length > 0) {
            setSelectedMaterial(materials[0] as string);
          }
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // 从原始数据中提取唯一日期列表
  const uniqueDates = useMemo(() => {
    const dates = rawData.map(item => item.单据日期).filter(Boolean);
    return [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [rawData]);

  // 从原始数据中提取唯一物料名称列表（已标准化）
  const uniqueMaterials = useMemo(() => {
    const materials = rawData.map(item => item.物料名称).filter(Boolean);
    const normalizedMaterials = [...new Set(materials.map(normalizeMaterialName))];
    return normalizedMaterials.sort();
  }, [rawData]);

  // 过滤日期区间数据
  const filteredData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];

    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);

    return rawData.filter(item => {
      const itemDate = item.单据日期;
      if (!itemDate) return false;

      try {
        const parsedDate = new Date(itemDate);
        if (isNaN(parsedDate.getTime())) return false;

        parsedDate.setHours(0, 0, 0, 0);
        return parsedDate >= fromDate && parsedDate <= toDate;
      } catch {
        return false;
      }
    });
  }, [rawData, dateRange]);

  // 计算表格数据 - 显示所有客户，不合并
  const tableData = useMemo(() => {
    if (!selectedMaterial || filteredData.length === 0) return [];

    // 过滤选定物料的数据（支持标准化后的物料名称匹配）
    const materialData = filteredData.filter(item => 
      normalizeMaterialName(item.物料名称) === selectedMaterial
    );
    
    // 按客户聚合销售计划数量、价税合计和出库数量
    const customerTotals = new Map<string, { quantity: number; totalPrice: number; outQuantity: number }>();
    materialData.forEach(item => {
      const current = customerTotals.get(item.客户) || { quantity: 0, totalPrice: 0, outQuantity: 0 };
      customerTotals.set(item.客户, {
        quantity: current.quantity + (item.销售计划数量 || 0),
        totalPrice: current.totalPrice + (item.价税合计 || 0),
        outQuantity: current.outQuantity + (item.出库数量 || 0)
      });
    });

    const totalQuantity = Array.from(customerTotals.values()).reduce((sum, val) => sum + val.quantity, 0);
    
    // 转换为表格数据，按value降序排列
    return Array.from(customerTotals.entries())
      .filter(([_, val]) => val.quantity > 0)
      .map(([name, val]) => ({
        name,
        value: val.quantity,
        percentage: totalQuantity > 0 ? `${((val.quantity / totalQuantity) * 100).toFixed(2)}%` : '0%',
        avgPrice: val.quantity > 0 ? (val.totalPrice / val.quantity).toFixed(2) : '0.00' // 元/吨
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, selectedMaterial]);

  // 计算饼图数据 - 按客户聚合销售计划数量（前10个客户，其余合并为"其他"）
  const chartData = useMemo(() => {
    if (tableData.length === 0) return [];
    
    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    
    // 如果客户数量超过10个，合并前10名之后的数据为"其他"
    if (tableData.length > 10) {
      const top10 = tableData.slice(0, 10).map(item => ({ ...item }));
      const others = tableData.slice(10);
      
      // 计算"其他"的汇总数据
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

  // 计算均价（所有客户的价税合计之和/销售计划数量之和）
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

  // 表格排序后的数据（使用tableData，显示所有客户）
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

  // 计算左右两侧的标签布局 - 配合饼图逆时针占比降序
  // 饼图从顶部12点开始逆时针，占比从大到小
  // 右侧标签从上到下占比降序，左侧标签从上到下占比升序
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
    // midAngle在-90到90度之间为右侧，否则为左侧
    const left = sectors.filter(s => {
      const normalizedAngle = ((s.midAngle % 360) + 360) % 360;
      return normalizedAngle > 90 && normalizedAngle < 270;
    }).sort((a, b) => {
      // "其他"排在最前面
      if (a.name === '其他') return -1;
      if (b.name === '其他') return 1;
      return a.value - b.value; // 其他按升序排列
    });
    
    const right = sectors.filter(s => {
      const normalizedAngle = ((s.midAngle % 360) + 360) % 360;
      return normalizedAngle <= 90 || normalizedAngle >= 270;
    }).sort((a, b) => b.value - a.value); // 右侧降序（从上到下占比从大到小）
    
    return { leftLabels: left, rightLabels: right, sectorsWithAngle: sectors };
  }, [chartData]);

  // 处理Excel文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 转换为JSON，使用第一行作为标题
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, string>[];
      
      // 映射到标准格式，同时标准化物料名称
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

      // 保存到数据库
      const response = await fetch('/api/sales-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: salesData }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || '保存数据失败');
      }

      setRawData(salesData);

      // 自动计算数据中最晚的日期，作为默认日期（今天）
      const dates = salesData.map(item => item.单据日期).filter(Boolean) as string[];
      const uniqueDates = [...new Set(dates)].sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
      const latestDate = uniqueDates[0];

      console.log('[导入日期] 唯一日期列表:', uniqueDates.slice(0, 5));
      console.log('[导入日期] 最晚日期:', latestDate);

      if (latestDate) {
        // 使用数据中最晚的日期作为默认日期
        const parsedDate = new Date(latestDate);
        console.log('[导入日期] 设置默认日期:', parsedDate.toISOString());
        setDateRange({ from: parsedDate, to: parsedDate });
      } else {
        // 如果没有日期数据，使用系统当前日期
        const today = new Date();
        console.log('[导入日期] 无数据日期，使用系统当前日期:', today.toISOString());
        setDateRange({ from: today, to: today });
      }

      // 默认选择"32%烧碱"，如果不存在则选择第一个物料
      const materials = [...new Set(salesData.map(item => item.物料名称))];
      if (materials.includes('32%烧碱')) {
        setSelectedMaterial('32%烧碱');
      } else if (materials.length > 0) {
        setSelectedMaterial(materials[0]);
      }
      
      alert(`数据已保存！共 ${salesData.length} 条记录`);
    } catch (error) {
      console.error('解析Excel文件失败:', error);
      alert('解析Excel文件失败，请确保文件格式正确');
    } finally {
      setIsUploading(false);
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            销售计划数据分析
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            上传Excel文件，实时分析销售计划数据
          </p>
        </div>

        {/* 文件上传区域 - 紧凑版 */}
        <div className="mb-4 flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                导入Excel
              </>
            )}
          </Button>
          {rawData.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full text-xs font-bold">
                ✓
              </span>
              已加载 {rawData.length} 条数据
            </div>
          )}
        </div>

        {isLoading ? (
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardContent className="py-16">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
                <p className="text-lg">加载数据中...</p>
              </div>
            </CardContent>
          </Card>
        ) : rawData.length === 0 ? (
          <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardContent className="py-16">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">暂无数据</p>
                <p className="text-sm">请先上传Excel文件</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 筛选区域 - 紧凑版 */}
            <div className="sticky top-0 z-50 mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border-0 p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 日期选择器 */}
                <div>
                  <div className="flex gap-2">
                    <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 justify-start text-left font-normal bg-white dark:bg-slate-800 h-9",
                            !dateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, 'yyyy-MM-dd', { locale: zhCN }) : "起始日期"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => {
                            if (date) {
                              const newRange = { ...dateRange, from: date };
                              // 确保结束日期不早于起始日期
                              if (!dateRange.to || dateRange.to < date) {
                                newRange.to = date;
                              }
                              setDateRange(newRange);
                              setIsStartCalendarOpen(false);
                            }
                          }}
                          initialFocus
                          locale={zhCN}
                          className="rounded-md border-0"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 justify-start text-left font-normal bg-white dark:bg-slate-800 h-9",
                            !dateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, 'yyyy-MM-dd', { locale: zhCN }) : "结束日期"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => {
                            if (date) {
                              const newRange = { ...dateRange, to: date };
                              // 确保起始日期不晚于结束日期
                              if (!dateRange.from || dateRange.from > date) {
                                newRange.from = date;
                              }
                              setDateRange(newRange);
                              setIsEndCalendarOpen(false);
                            }
                          }}
                          initialFocus
                          locale={zhCN}
                          className="rounded-md border-0"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {filteredData.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      该区间共 {filteredData.length} 条数据
                    </p>
                  )}
                </div>

                {/* 物料名称选择器 */}
                <div>
                  <div className="flex flex-wrap gap-2">
                    {uniqueMaterials.map(material => (
                      <Button
                        key={material}
                        variant={selectedMaterial === material ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedMaterial(material)}
                        className={cn(
                          "transition-all",
                          selectedMaterial === material
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        {material}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 图表展示区域 */}
            {selectedMaterial && chartData.length > 0 ? (
              <Card className="mb-4 shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardContent className="pt-6">
                  {/* 饼图区域 - 独占一行 */}
                  <div className="relative h-[500px] mb-6">
                    {/* SVG连线层 - 使用折线 */}
                    <svg 
                      className="absolute inset-0 w-full h-full pointer-events-none" 
                      style={{ zIndex: 10 }}
                      viewBox="0 0 900 500"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {(() => {
                        // 默认不显示连线，只有悬浮时才显示
                        if (sectorsWithAngle.length === 0 || hoveredIndex === null) return null;
                        
                        const RADIAN = Math.PI / 180;
                        const cx = 450; // 饼图中心
                        const cy = 250; // 饼图垂直中心
                        const outerRadius = 150;
                        
                        const padding = 50;
                        const availableHeight = 500 - padding * 2;
                        const labelX = 190; // 左侧标签X位置
                        const rightLabelX = 710; // 右侧标签X位置
                        
                        // 找到当前悬浮的客户数据
                        const hoveredItem = [...leftLabels, ...rightLabels].find(item => item.index === hoveredIndex);
                        if (!hoveredItem) return null;
                        
                        // 判断是左侧还是右侧
                        const isLeft = leftLabels.some(item => item.index === hoveredIndex);
                        const labels = isLeft ? leftLabels : rightLabels;
                        const labelIndex = labels.findIndex(item => item.index === hoveredIndex);
                        const labelY = padding + (availableHeight / (labels.length + 1)) * (labelIndex + 1);
                        
                        // 计算边缘点
                        const edgeX = cx + outerRadius * Math.cos(-hoveredItem.midAngle * RADIAN);
                        const edgeY = cy + outerRadius * Math.sin(-hoveredItem.midAngle * RADIAN);
                        
                        // 一条斜线直接连接边缘到标签
                        const targetX = isLeft ? labelX : rightLabelX;
                        
                        return (
                          <path
                            d={`M${edgeX},${edgeY}L${targetX},${labelY}`}
                            fill="none"
                            stroke={COLORS[hoveredIndex % COLORS.length]}
                            strokeWidth={2.5}
                            opacity={1}
                            style={{
                              filter: `drop-shadow(0 0 4px ${COLORS[hoveredIndex % COLORS.length]}40)`
                            }}
                          />
                        );
                      })()}
                    </svg>
                    
                    {/* 左侧标签列 */}
                    <div className="absolute left-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12 z-20">
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
                              "absolute left-2 flex items-center gap-2 text-sm transition-all duration-200 cursor-pointer",
                              isHovered 
                                ? "text-slate-900 dark:text-white font-semibold scale-105" 
                                : "text-slate-700 dark:text-slate-300"
                            )}
                            style={{ 
                              top: labelY,
                              transform: `translateY(-50%) ${isHovered ? 'translateX(4px)' : ''}`,
                              textShadow: isHovered ? '0 0 8px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onMouseEnter={() => setHoveredIndex(item.index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-200"
                              style={{ 
                                backgroundColor: COLORS[item.index % COLORS.length],
                                boxShadow: isHovered ? `0 0 8px ${COLORS[item.index % COLORS.length]}` : 'none',
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
                            fill="#8884d8"
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
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
                                    filter: isHovered ? 'brightness(1.1) drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'none',
                                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                                    transformOrigin: 'center',
                                    transition: 'all 0.2s ease-out',
                                    cursor: 'pointer'
                                  }}
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as ChartData;
                                return (
                                  <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-slate-900 dark:text-white mb-1">{data.name}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">销售计划数量：{data.value.toLocaleString()} 吨</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">均价：{data.avgPrice} 元/吨</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">占比：{data.percentage}</p>
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
                    <div className="absolute right-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12 z-20">
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
                              "absolute right-2 flex items-center gap-2 text-sm transition-all duration-200 cursor-pointer",
                              isHovered 
                                ? "text-slate-900 dark:text-white font-semibold scale-105" 
                                : "text-slate-700 dark:text-slate-300"
                            )}
                            style={{ 
                              top: labelY,
                              transform: `translateY(-50%) ${isHovered ? 'translateX(-4px)' : ''}`,
                              textShadow: isHovered ? '0 0 8px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onMouseEnter={() => setHoveredIndex(item.index)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            <span className="whitespace-nowrap">{item.name}: {item.percentage}</span>
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-200"
                              style={{ 
                                backgroundColor: COLORS[item.index % COLORS.length],
                                boxShadow: isHovered ? `0 0 8px ${COLORS[item.index % COLORS.length]}` : 'none',
                                transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 数据表格 - 单独一行 */}
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        {selectedMaterial}：均价{' '}
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{avgPrice.toFixed(2)} 元/吨</span>
                        ，高于此均价的客户 {aboveAvgData.count} 家，销售计划数量共计 {aboveAvgData.quantity.toFixed(2)} 吨，占比 {aboveAvgData.quantityRatio}%
                      </h3>
                    </div>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            <th className="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300 w-16">序号</th>
                            <th className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-300">客户名称</th>
                            <th 
                              className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none"
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
                            <th 
                              className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none"
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
                            <th
                              className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none"
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
                            const isAboveAvg = itemAvgPrice > avgPrice; // 高于均价
                            
                            return (
                              <tr key={item.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-3 flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: COLORS[item.originalIndex % COLORS.length] }}
                                  />
                                  <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                                  {item.value.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
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
                        <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-medium">
                          <tr>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-center">-</td>
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
                  </div>
                </CardContent>
              </Card>
            ) : (
              selectedMaterial && (
                <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <CardContent className="py-16">
                    <div className="text-center text-slate-500 dark:text-slate-400">
                      <p>当前日期该物料暂无数据</p>
                    </div>
                  </CardContent>
                </Card>
              )
            )}

            {!selectedMaterial && (
              <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardContent className="py-16">
                  <div className="text-center text-slate-500 dark:text-slate-400">
                    <p className="mb-2">请选择物料名称查看销售计划数量占比分析</p>
                    <p className="text-sm">共有 {uniqueMaterials.length} 种物料可选</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
