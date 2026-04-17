// 成本分析视图组件 - admin页面的子组件
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SalesData {
  单据日期: string;
  单据编号: string;
  客户: string;
  业务员: string;
  物料名称: string;
  销售计划数量: number;
  含税净价: number;
  价税合计: number;
  出库数量: number;
}

interface SummaryData {
  materials: {
    quantities: Record<string, number>;
    costs: Record<string, number>;
    prices: Record<string, number>;
  };
  laborAndMaintenance: Record<string, number>;
  periodExpenses: Record<string, number>;
  adjustments: Record<string, number>;
  workshops: string[];
  totalYield: number;
  totalCost: number;
  concentrationCost: number;
  concentrationFactor: number;
}

interface CostAnalysisViewProps {
  salesData: SalesData[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  selectedMaterial: string;
  costListData?: SummaryData;
}

export default function CostAnalysisView({ 
  salesData, 
  dateRange, 
  selectedMaterial,
  costListData
}: CostAnalysisViewProps) {
  
  const normalizeMaterialName = (name: string): string => {
    if (name.includes('32%工业级烧碱') || name.includes('32%食品级烧碱') || name.includes('32%烧碱')) {
      return '32%烧碱';
    }
    return name;
  };
  
  const normalizedSalesData = useMemo(() => {
    return salesData.map(item => ({
      ...item,
      物料名称: normalizeMaterialName(item.物料名称)
    }));
  }, [salesData]);
  
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
  ];

  interface ChartData {
    name: string;
    value: number;
    percentage: string;
    avgPrice: string;
  }

  const filteredData = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];
    const fromDateStr = format(dateRange.from, 'yyyy-MM-dd');
    const toDateStr = format(dateRange.to, 'yyyy-MM-dd');
    return normalizedSalesData.filter(item => {
      const itemDate = item.单据日期;
      if (!itemDate) return false;
      return itemDate >= fromDateStr && itemDate <= toDateStr;
    });
  }, [normalizedSalesData, dateRange]);

  const tableData = useMemo(() => {
    if (!selectedMaterial || filteredData.length === 0) return [];
    const materialData = filteredData.filter(item => 
      normalizeMaterialName(item.物料名称) === selectedMaterial
    );
    const customerTotals = new Map<string, { quantity: number; totalPrice: number }>();
    materialData.forEach(item => {
      const current = customerTotals.get(item.客户) || { quantity: 0, totalPrice: 0 };
      customerTotals.set(item.客户, {
        quantity: current.quantity + (item.销售计划数量 || 0),
        totalPrice: current.totalPrice + (item.价税合计 || 0)
      });
    });
    const totalQuantity = Array.from(customerTotals.values()).reduce((sum, val) => sum + val.quantity, 0);
    return Array.from(customerTotals.entries())
      .filter(([_, val]) => val.quantity > 0)
      .map(([name, val]) => ({
        name,
        value: val.quantity,
        percentage: totalQuantity > 0 ? `${((val.quantity / totalQuantity) * 100).toFixed(2)}%` : '0%',
        avgPrice: val.quantity > 0 ? (val.totalPrice / val.quantity).toFixed(2) : '0.00'
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData, selectedMaterial]);

  const chartData = useMemo(() => {
    if (tableData.length === 0) return [];
    if (tableData.length > 10) {
      const top10 = tableData.slice(0, 10).map(item => ({ ...item }));
      const others = tableData.slice(10);
      const otherValue = others.reduce((sum, item) => sum + item.value, 0);
      const otherTotalPrice = others.reduce((sum, item) => sum + (item.value * parseFloat(item.avgPrice)), 0);
      top10.push({
        name: '其他',
        value: otherValue,
        percentage: otherValue > 0 ? `${((otherValue / tableData.reduce((s, i) => s + i.value, 0)) * 100).toFixed(2)}%` : '0%',
        avgPrice: otherValue > 0 ? (otherTotalPrice / otherValue).toFixed(2) : '0.00'
      });
      return top10;
    }
    return tableData;
  }, [tableData]);

  const [sortKey, setSortKey] = useState<'value' | 'percentage' | 'avgPrice'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const avgPrice = useMemo(() => {
    if (tableData.length === 0) return 0;
    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    if (totalQuantity === 0) return 0;
    const totalPrice = tableData.reduce((sum, item) => sum + (item.value * parseFloat(item.avgPrice)), 0);
    return totalPrice / totalQuantity;
  }, [tableData]);

  const { unitCost, grossProfit } = useMemo(() => {
    if (!costListData || !costListData.concentrationCost || !costListData.totalYield) {
      return { unitCost: 0, grossProfit: avgPrice };
    }
    const concentrationCost = costListData.concentrationCost;
    const totalYield = costListData.totalYield;
    const cost = totalYield > 0 ? concentrationCost / totalYield : 0;
    const profit = avgPrice - cost;
    return { unitCost: cost, grossProfit: profit };
  }, [costListData, avgPrice]);

  const aboveAvgData = useMemo(() => {
    if (tableData.length === 0) return { count: 0, quantity: 0, quantityRatio: '0.00' };
    const aboveAvgCustomers = tableData.filter(item => parseFloat(item.avgPrice) > avgPrice);
    const count = aboveAvgCustomers.length;
    const totalQuantity = tableData.reduce((sum, item) => sum + item.value, 0);
    const aboveAvgQuantity = aboveAvgCustomers.reduce((sum, item) => sum + item.value, 0);
    const quantityRatio = totalQuantity > 0 ? ((aboveAvgQuantity / totalQuantity) * 100).toFixed(2) : '0.00';
    return { count, quantity: aboveAvgQuantity, quantityRatio };
  }, [tableData, avgPrice]);

  const sortedTableData = useMemo(() => {
    const dataWithIndex = tableData.map((item, index) => ({ ...item, originalIndex: index }));
    return dataWithIndex.sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === 'value') { aVal = a.value; bVal = b.value; }
      else if (sortKey === 'percentage') { aVal = parseFloat(a.percentage); bVal = parseFloat(b.percentage); }
      else { aVal = parseFloat(a.avgPrice); bVal = parseFloat(b.avgPrice); }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [tableData, sortKey, sortOrder]);

  const handleSort = (key: 'value' | 'percentage' | 'avgPrice') => {
    if (sortKey === key) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  return (
    <div className="space-y-6">
      {salesData.length === 0 && (
        <Card className="shadow-lg border-blue-200 bg-blue-50">
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-blue-700">正在加载销售数据...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 饼图 */}
      <Card className="shadow-lg border-slate-200 bg-white">
        <CardContent className="pt-6">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg">
              <p className="text-slate-500">{!selectedMaterial ? '请选择物料后查看图表' : '暂无数据'}</p>
            </div>
          ) : (
            <div className="relative h-[500px]">
              <div className="absolute left-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12">
                {chartData.slice(0, Math.ceil(chartData.length / 2)).map((item, i) => (
                  <div key={item.name} 
                    className="absolute left-2 flex items-center gap-2 text-sm cursor-pointer"
                    style={{ top: `calc(50px + ${(i + 1) * (400 / (Math.ceil(chartData.length / 2) + 1))}px)`, transform: 'translateY(-50%)' }}
                    onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="whitespace-nowrap truncate max-w-[150px]">{item.name}: {item.percentage}</span>
                  </div>
                ))}
              </div>
              <div className="absolute left-[200px] right-[200px] top-0 bottom-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" outerRadius={150} dataKey="value"
                      onMouseEnter={(_, index) => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}
                          style={{ opacity: hoveredIndex === null ? 1 : (hoveredIndex === index ? 1 : 0.3) }} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-[200px] flex flex-col justify-center py-12">
                {chartData.slice(Math.ceil(chartData.length / 2)).map((item, i) => (
                  <div key={item.name} 
                    className="absolute right-2 flex items-center gap-2 text-sm cursor-pointer"
                    style={{ top: `calc(50px + ${(i + 1) * (400 / (Math.floor(chartData.length / 2) + 1))}px)`, transform: 'translateY(-50%)' }}
                    onMouseEnter={() => setHoveredIndex(i + Math.ceil(chartData.length / 2))} onMouseLeave={() => setHoveredIndex(null)}>
                    <span className="whitespace-nowrap truncate max-w-[150px]">{item.name}: {item.percentage}</span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(i + Math.ceil(chartData.length / 2)) % COLORS.length] }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 统计表格 */}
      <Card className="shadow-lg border-slate-200 bg-white">
        <CardContent className="pt-6">
          {tableData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {!selectedMaterial ? '请选择物料后查看分析表' : '暂无数据'}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  {selectedMaterial}：均价 <span className="text-xl font-bold text-blue-600">{avgPrice.toFixed(2)} 元/吨</span>
                  ，成本 <span className="text-xl font-bold text-orange-600">{unitCost.toFixed(2)} 元/吨</span>
                  ，毛利润 <span className={grossProfit >= 0 ? "text-xl font-bold text-green-600" : "text-xl font-bold text-red-600"}>{grossProfit.toFixed(2)} 元/吨</span>
                </h3>
                <p className="text-lg font-semibold text-slate-800 mt-1">
                  高于此均价的客户 <span className="text-blue-600">{aboveAvgData.count}</span> 家，销售计划数量共计 <span className="text-blue-600">{aboveAvgData.quantity.toFixed(2)}</span> 吨，占比 <span className="text-blue-600">{aboveAvgData.quantityRatio}%</span>
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-center font-medium w-16 text-slate-700">序号</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-700">客户名称</th>
                      <th className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 text-slate-700" onClick={() => handleSort('value')}>
                        <div className="flex items-center justify-end gap-1">
                          销售计划数量(吨)
                          {sortKey === 'value' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 text-slate-700" onClick={() => handleSort('percentage')}>
                        <div className="flex items-center justify-end gap-1">
                          占比
                          {sortKey === 'percentage' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right font-medium cursor-pointer hover:bg-slate-200 text-slate-700" onClick={() => handleSort('avgPrice')}>
                        <div className="flex items-center justify-end gap-1">
                          单价(元/吨)
                          {sortKey === 'avgPrice' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedTableData.map((item, index) => {
                      const isAboveAvg = parseFloat(item.avgPrice) > avgPrice;
                      return (
                        <tr key={item.name} className={cn("hover:bg-slate-50", isAboveAvg ? "bg-green-50" : "")}>
                          <td className="px-4 py-3 text-center text-slate-600">{index + 1}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{item.value.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{item.percentage}</td>
                          <td className={cn("px-4 py-3 text-right font-semibold", isAboveAvg ? "text-green-600" : "text-slate-800")}>{item.avgPrice}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
