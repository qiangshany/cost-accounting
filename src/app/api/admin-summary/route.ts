import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');

    if (!date || !product) {
      return NextResponse.json(
        { error: '缺少必填参数：日期、产品' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 并行查询所有数据
    const [materialsResponse, purchasePricesResponse, laborResponse, periodResponse, adjustmentsResponse, yieldsResponse] =
      await Promise.all([
        client
          .from('material_costs')
          .select('*')
          .eq('report_date', date)
          .eq('product', product),
        client
          .from('purchase_prices')
          .select('*')
          .eq('report_date', date),
        client
          .from('labor_maintenance_costs')
          .select('*')
          .eq('report_date', date)
          .eq('product', product),
        client
          .from('period_expenses')
          .select('*')
          .eq('report_date', date)
          .eq('product', product),
        client
          .from('adjustments')
          .select('*')
          .eq('report_date', date)
          .eq('product', product),
        client
          .from('production_yields')
          .select('*')
          .eq('report_date', date)
          .eq('product', product),
      ]);

    if (materialsResponse.error) throw new Error(`查询原材料失败: ${materialsResponse.error.message}`);
    if (purchasePricesResponse.error) throw new Error(`查询单价失败: ${purchasePricesResponse.error.message}`);
    if (laborResponse.error) throw new Error(`查询人工维护失败: ${laborResponse.error.message}`);
    if (periodResponse.error) throw new Error(`查询期间费用失败: ${periodResponse.error.message}`);
    if (adjustmentsResponse.error) throw new Error(`查询调整项失败: ${adjustmentsResponse.error.message}`);
    if (yieldsResponse.error) throw new Error(`查询产量失败: ${yieldsResponse.error.message}`);

    // 合并原材料数据（按车间汇总数量）
    const materialSummary: Record<string, number> = {};
    materialsResponse.data?.forEach((item) => {
      materialSummary[item.material_name] = (materialSummary[item.material_name] || 0) + (item.quantity || 0);
    });

    // 构建单价映射
    const priceMap: Record<string, number> = {};
    purchasePricesResponse.data?.forEach((item) => {
      priceMap[item.material_name] = item.price || 0;
    });

    // 计算原材料成本（数量 × 单价，单位为"元"的项目直接使用数量）
    const materialCosts: Record<string, number> = {};
    materialsResponse.data?.forEach((item) => {
      const price = priceMap[item.material_name] || 0;
      let cost = (item.quantity || 0);
      // 如果单位不是"元"，才乘以单价
      if (item.unit !== '元') {
        cost = cost * price;
      }
      materialCosts[item.material_name] = (materialCosts[item.material_name] || 0) + cost;
    });

    // 合并人工与维护成本
    const laborSummary: Record<string, number> = {};
    laborResponse.data?.forEach((item) => {
      const itemName = item.cost_item_name;
      // 所有项目（包括工资及福利）都汇总所有车间的数据
      laborSummary[itemName] = (laborSummary[itemName] || 0) + (item.amount || 0);
    });

    // 合并期间费用
    const periodSummary: Record<string, number> = {};
    periodResponse.data?.forEach((item) => {
      periodSummary[item.expense_item_name] = (periodSummary[item.expense_item_name] || 0) + (item.amount || 0);
    });

    // 合并调整项
    const adjustmentsSummary: Record<string, number> = {};
    adjustmentsResponse.data?.forEach((item) => {
      adjustmentsSummary[item.adjustment_name] = (adjustmentsSummary[item.adjustment_name] || 0) + (item.amount || 0);
    });

    // 合并产量数据（按车间汇总）
    const yieldsSummary: Record<string, number> = {};
    yieldsResponse.data?.forEach((item) => {
      yieldsSummary[item.workshop] = (yieldsSummary[item.workshop] || 0) + (item.alkali_yield || 0);
    });

    // 获取车间列表（从所有数据源中获取）
    const allWorkshops = [
      ...(materialsResponse.data?.map((item) => item.workshop) || []),
      ...(laborResponse.data?.map((item) => item.workshop) || []),
      ...(periodResponse.data?.map((item) => item.workshop) || []),
      ...(adjustmentsResponse.data?.map((item) => item.workshop) || []),
      ...(yieldsResponse.data?.map((item) => item.workshop) || []),
    ];
    const workshops = [...new Set(allWorkshops)];

    // 根据产品类型获取对应的产量
    let totalYield = 0;
    if (product === '氯碱') {
      yieldsResponse.data?.forEach((item) => {
        totalYield += (item.alkali_yield || 0);
      });
    } else if (product === '盐酸') {
      yieldsResponse.data?.forEach((item) => {
        totalYield += (item.hydrochloric_acid_yield || 0);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        materials: {
          quantities: materialSummary, // 数量汇总
          costs: materialCosts, // 成本汇总（数量 × 单价）
          prices: priceMap, // 单价
        },
        laborAndMaintenance: laborSummary,
        periodExpenses: periodSummary,
        adjustments: adjustmentsSummary,
        workshops,
        totalYield, // 总产量
      },
    });
  } catch (error) {
    console.error('查询汇总数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
        data: {
          materials: { quantities: {}, costs: {}, prices: {} },
          laborAndMaintenance: {},
          periodExpenses: {},
          adjustments: {},
          workshops: [],
        },
      },
      { status: 500 }
    );
  }
}
