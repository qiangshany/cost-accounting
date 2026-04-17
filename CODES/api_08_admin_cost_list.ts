// API: 管理员成本列表接口
// src/app/api/admin-cost-list/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const product = searchParams.get('product') || '32%烧碱';

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: '缺少日期参数' }, { status: 400 });
    }

    // 1. 查询日期范围内的产量数据
    const { data: yieldsData, error: yieldsError } = await supabaseAdmin
      .from('production_yields')
      .select('*')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .eq('product', '氯碱');

    if (yieldsError) throw yieldsError;

    // 2. 查询原材料成本
    const { data: materialsData, error: materialsError } = await supabaseAdmin
      .from('material_costs')
      .select('*')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .eq('product', '氯碱');

    if (materialsError) throw materialsError;

    // 3. 查询采购单价（取最新日期的）
    const { data: pricesData, error: pricesError } = await supabaseAdmin
      .from('purchase_prices')
      .select('*')
      .lte('report_date', endDate)
      .order('report_date', { ascending: false });

    if (pricesError) throw pricesError;

    // 获取最新日期的单价
    const latestPrices: Record<string, number> = {};
    if (pricesData && pricesData.length > 0) {
      const latestDate = pricesData[0].report_date;
      pricesData.filter(p => p.report_date === latestDate).forEach(p => {
        latestPrices[p.material_name] = p.price || 0;
      });
    }

    // 4. 查询人工与维护成本
    const { data: laborData, error: laborError } = await supabaseAdmin
      .from('labor_maintenance_costs')
      .select('*')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .eq('product', '氯碱');

    if (laborError) throw laborError;

    // 5. 查询期间费用
    const { data: periodData, error: periodError } = await supabaseAdmin
      .from('period_expenses')
      .select('*')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .eq('product', '氯碱');

    if (periodError) throw periodError;

    // 6. 查询调整项
    const { data: adjustmentsData, error: adjustmentsError } = await supabaseAdmin
      .from('adjustments')
      .select('*')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .eq('product', '氯碱');

    if (adjustmentsError) throw adjustmentsError;

    // 汇总计算
    let totalYield32 = 0; // 32%烧碱总产量
    let totalYield50 = 0; // 50%烧碱总产量

    // 从 metadata 中提取产量
    yieldsData?.forEach(y => {
      if (y.metadata) {
        totalYield32 += y.metadata.yield32Percent || 0;
        totalYield50 += y.metadata.yield50Percent || 0;
      }
      totalYield32 += y.alkali_yield || 0;
    });

    // 汇总原材料数量
    const materialQuantities: Record<string, number> = {};
    const materialCosts: Record<string, number> = {};
    materialsData?.forEach(m => {
      materialQuantities[m.material_name] = (materialQuantities[m.material_name] || 0) + (m.quantity || 0);
      const price = latestPrices[m.material_name] || 0;
      materialCosts[m.material_name] = (materialCosts[m.material_name] || 0) + (m.quantity || 0) * price;
    });

    // 汇总人工与维护成本
    const laborAndMaintenance: Record<string, number> = {};
    laborData?.forEach(l => {
      laborAndMaintenance[l.cost_item_name] = (laborAndMaintenance[l.cost_item_name] || 0) + (l.amount || 0);
    });

    // 汇总期间费用
    const periodExpenses: Record<string, number> = {};
    periodData?.forEach(p => {
      periodExpenses[p.expense_item_name] = (periodExpenses[p.expense_item_name] || 0) + (p.amount || 0);
    });

    // 汇总调整项
    const adjustments: Record<string, number> = {};
    adjustmentsData?.forEach(a => {
      adjustments[a.adjustment_name] = (adjustments[a.adjustment_name] || 0) + (a.amount || 0);
    });

    // 计算总成本
    const totalMaterialCost = Object.values(materialCosts).reduce((sum, val) => sum + val, 0);
    const totalLaborCost = Object.values(laborAndMaintenance).reduce((sum, val) => sum + val, 0);
    const totalPeriodCost = Object.values(periodExpenses).reduce((sum, val) => sum + val, 0);
    const totalAdjustment = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    const totalCost = totalMaterialCost + totalLaborCost + totalPeriodCost - totalAdjustment;

    // 计算浓度烧碱成本分配
    // 总碱产量 = 32%烧碱产量 × 0.32 + 50%烧碱产量 × 0.5
    const totalAlkaliYield = totalYield32 * 0.32 + totalYield50 * 0.5;

    // 根据产品类型计算对应浓度的成本
    let concentrationFactor = 0.32;
    let totalYield = totalYield32;
    let concentrationCost = 0;

    if (product === '50%烧碱') {
      concentrationFactor = 0.5;
      totalYield = totalYield50;
    }

    if (totalAlkaliYield > 0) {
      // 浓度烧碱成本 = 总成本 × 0.53 × (该浓度产量 × 浓度系数 / 总碱产量)
      if (product === '50%烧碱') {
        concentrationCost = totalCost * 0.53 * (totalYield50 * 0.5 / totalAlkaliYield);
      } else {
        concentrationCost = totalCost * 0.53 * (totalYield32 * 0.32 / totalAlkaliYield);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        materials: {
          quantities: materialQuantities,
          costs: materialCosts,
          prices: latestPrices,
        },
        laborAndMaintenance,
        periodExpenses,
        adjustments,
        workshops: [],
        totalYield,
        totalCost,
        concentrationCost,
        concentrationFactor,
      }
    });
  } catch (error) {
    console.error('查询成本列表失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
