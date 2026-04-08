import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取成本列表数据（支持日期区间和产品筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const product = searchParams.get('product') || '32%液碱';

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: '请提供起始日期和结束日期'
      }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 判断是单日还是区间
    const isSingleDay = startDate === endDate;

    // 1. 获取日期区间的所有日期
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 2. 获取原材料数据
    // 原材料成本 = 数量 × 单价
    // 单日：使用当日采购单价
    // 区间：该区间内总金额 / 总数量

    // 获取原材料数据（数量来自material_costs，单价来自purchase_prices）
    const materialQuantities: Record<string, number> = {};
    const materialCosts: Record<string, number> = {};
    const materialPrices: Record<string, number> = {};
    
    // 获取产量数据（用于计算单价）
    const yieldResponse = await client
      .from('production_yields')
      .select('*')
      .eq('product', product)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (yieldResponse.data && yieldResponse.data.length > 0) {
      // 按日期获取原材料数量
      for (const date of dates) {
        const quantityResponse = await client
          .from('material_costs')
          .select('*')
          .eq('product', product)
          .eq('report_date', date);

        if (quantityResponse.data) {
          for (const item of quantityResponse.data) {
            const name = item.material_name;
            const qty = parseFloat(item.quantity) || 0;
            
            if (!materialQuantities[name]) {
              materialQuantities[name] = 0;
            }
            materialQuantities[name] += qty;
          }
        }

        // 获取采购单价
        const priceResponse = await client
          .from('purchase_prices')
          .select('*')
          .eq('report_date', date);

        if (priceResponse.data) {
          for (const priceItem of priceResponse.data) {
            const name = priceItem.material_name;
            const price = parseFloat(priceItem.price) || 0;
            
            // 单日：直接使用当日单价
            // 区间：累加金额用于后续计算均价
            if (isSingleDay) {
              materialPrices[name] = price;
            }
          }
        }
      }

      // 计算原材料成本
      for (const name of Object.keys(materialQuantities)) {
        const quantity = materialQuantities[name];
        
        if (isSingleDay) {
          // 单日：使用当日采购单价
          const price = materialPrices[name] || 0;
          materialCosts[name] = quantity * price;
        } else {
          // 区间：获取所有日期的采购单价，计算区间总金额
          let totalAmount = 0;
          
          for (const date of dates) {
            const priceResponse = await client
              .from('purchase_prices')
              .select('price')
              .eq('report_date', date)
              .eq('material_name', name)
              .single();

            if (priceResponse.data) {
              totalAmount += (parseFloat(priceResponse.data.price) || 0);
            }
          }
          
          // 区间均价 = 总金额 / 天数
          const avgPrice = dates.length > 0 ? totalAmount / dates.length : 0;
          materialPrices[name] = parseFloat(avgPrice.toFixed(4));
          materialCosts[name] = quantity * avgPrice;
        }
      }
    }

    // 3. 获取人工与维护成本
    const laborAndMaintenance: Record<string, number> = {};
    
    const laborResponse = await client
      .from('labor_maintenance_costs')
      .select('*')
      .eq('product', product)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (laborResponse.data) {
      for (const item of laborResponse.data) {
        const name = item.cost_item_name;
        const amount = parseFloat(item.amount) || 0;
        
        if (!laborAndMaintenance[name]) {
          laborAndMaintenance[name] = 0;
        }
        laborAndMaintenance[name] += amount;
      }
    }

    // 4. 获取期间费用
    const periodExpenses: Record<string, number> = {};
    
    const periodResponse = await client
      .from('period_expenses')
      .select('*')
      .eq('product', product)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (periodResponse.data) {
      for (const item of periodResponse.data) {
        const name = item.expense_item_name;
        const amount = parseFloat(item.amount) || 0;
        
        if (!periodExpenses[name]) {
          periodExpenses[name] = 0;
        }
        periodExpenses[name] += amount;
      }
    }

    // 5. 获取调整项
    const adjustments: Record<string, number> = {};
    
    const adjustmentResponse = await client
      .from('adjustments')
      .select('*')
      .eq('product', product)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (adjustmentResponse.data) {
      for (const item of adjustmentResponse.data) {
        const name = item.adjustment_name;
        const amount = parseFloat(item.amount) || 0;
        
        if (!adjustments[name]) {
          adjustments[name] = 0;
        }
        adjustments[name] += amount;
      }
    }

    // 6. 获取车间列表
    const workshopSet = new Set<string>();
    
    const workshopResponse = await client
      .from('labor_maintenance_costs')
      .select('workshop')
      .eq('product', product)
      .gte('report_date', startDate)
      .lte('report_date', endDate);

    if (workshopResponse.data) {
      for (const item of workshopResponse.data) {
        workshopSet.add(item.workshop);
      }
    }

    // 7. 计算总产量
    let totalYield = 0;
    
    if (yieldResponse.data) {
      for (const item of yieldResponse.data) {
        if (product === '32%液碱') {
          totalYield += parseFloat(item.alkali_yield) || 0;
        } else if (product === '31%盐酸') {
          totalYield += parseFloat(item.hydrochloric_acid_yield) || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        materials: {
          quantities: materialQuantities,
          costs: materialCosts,
          prices: materialPrices
        },
        laborAndMaintenance,
        periodExpenses,
        adjustments,
        workshops: Array.from(workshopSet),
        totalYield
      }
    });
  } catch (error) {
    console.error('获取成本列表数据失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取数据失败'
    }, { status: 500 });
  }
}
