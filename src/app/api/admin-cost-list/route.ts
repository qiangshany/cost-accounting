import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取成本列表数据（支持日期区间和产品筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let product = searchParams.get('product') || '32%液碱';

    // 产品名称映射：前端选择的物料名称映射到数据库中的产品名称
    // 32%烧碱、32%液碱、氯碱 统一映射到数据库中的 "氯碱"
    const productMapping: Record<string, string> = {
      '32%烧碱': '氯碱',
      '32%液碱': '氯碱',
      '氯碱': '氯碱',
      '31%盐酸': '氯碱', // 盐酸也是氯碱产品
      '31%食品级烧碱': '氯碱',
      '32%食品级烧碱': '氯碱',
      '32%工业级烧碱': '氯碱',
    };
    
    // 映射产品名称
    product = productMapping[product] || '氯碱';

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

    // 单位为元的成本项目（这些项目数量本身就是金额，不需要单价计算）
    const DIRECT_COST_ITEMS = ['化水药品费用', '锅炉清焦剂等', '脱硫、铲硝及输煤费'];

    // 2. 获取原材料数据
    // 规则：
    // - 根据原材料数量数据来判断哪些日期有数据
    // - 单日：使用当日采购单价
    // - 区间：
    //   - 单位为元的项目：直接相加有数据日期的数量
    //   - 其他物料：数量相加，成本 = Σ(有数据日期的数量 × 单价)，单价 = 总成本 / 总数量（加权均价）

    // 获取原材料数据（数量来自material_costs，单价来自purchase_prices）
    const materialQuantities: Record<string, number> = {};
    const materialCosts: Record<string, number> = {};
    const materialPrices: Record<string, number> = {};

    // 按日期获取原材料数据，构建有数据的日期集合
    const validDates: string[] = [];
    const datesWithMaterial = new Set<string>();
    
    for (const date of dates) {
      const quantityResponse = await client
        .from('material_costs')
        .select('material_name, quantity')
        .eq('product', product)
        .eq('report_date', date);

      if (quantityResponse.data && quantityResponse.data.length > 0) {
        datesWithMaterial.add(date);
        validDates.push(date);
        
        // 累加数量
        for (const item of quantityResponse.data) {
          const name = item.material_name;
          const qty = parseFloat(item.quantity) || 0;
          
          if (!materialQuantities[name]) {
            materialQuantities[name] = 0;
          }
          materialQuantities[name] += qty;
        }
      }
    }

    // 只有有原材料数据的日期才进行计算
    if (validDates.length > 0) {
      // 计算原材料成本和加权均价
      for (const name of Object.keys(materialQuantities)) {
        const quantity = materialQuantities[name];
        
        // 单位为元的项目：数量本身就是金额，成本 = 数量相加
        if (DIRECT_COST_ITEMS.includes(name)) {
          materialCosts[name] = quantity; // 数量就是金额
          materialPrices[name] = 1; // 单价显示为1元（因为数量就是金额）
        } else {
          // 非直接成本项目：计算加权均价
          let totalCost = 0; // 总成本 = Σ(有数据日期的数量 × 单价)
          
          for (const date of validDates) {
            // 获取该日期的单价
            const priceResponse = await client
              .from('purchase_prices')
              .select('price')
              .eq('report_date', date)
              .eq('material_name', name)
              .single();
            
            const dayPrice = priceResponse.data ? parseFloat(priceResponse.data.price) || 0 : 0;
            
            // 获取该日期的数量
            const quantityResponse = await client
              .from('material_costs')
              .select('quantity')
              .eq('product', product)
              .eq('report_date', date)
              .eq('material_name', name)
              .single();
            
            const dayQuantity = quantityResponse.data ? parseFloat(quantityResponse.data.quantity) || 0 : 0;
            
            // 累加该日期的成本
            totalCost += dayQuantity * dayPrice;
          }
          
          materialCosts[name] = totalCost;
          // 加权均价 = 总成本 / 总数量
          materialPrices[name] = quantity > 0 ? parseFloat((totalCost / quantity).toFixed(4)) : 0;
        }
      }
    }

    // 3. 获取人工与维护成本（只获取有产量日期的数据）
    const laborAndMaintenance: Record<string, number> = {};
    
    for (const date of validDates) {
      const laborResponse = await client
        .from('labor_maintenance_costs')
        .select('*')
        .eq('product', product)
        .eq('report_date', date);

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
    }

    // 4. 获取期间费用（只获取有产量日期的数据）
    const periodExpenses: Record<string, number> = {};
    
    for (const date of validDates) {
      const periodResponse = await client
        .from('period_expenses')
        .select('*')
        .eq('product', product)
        .eq('report_date', date);

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
    }

    // 5. 获取调整项（只获取有产量日期的数据）
    const adjustments: Record<string, number> = {};
    
    for (const date of validDates) {
      const adjustmentResponse = await client
        .from('adjustments')
        .select('*')
        .eq('product', product)
        .eq('report_date', date);

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
    }

    // 6. 获取车间列表（只获取有原材料数据日期的数据）
    const workshopSet = new Set<string>();
    
    for (const date of validDates) {
      const workshopResponse = await client
        .from('labor_maintenance_costs')
        .select('workshop')
        .eq('product', product)
        .eq('report_date', date);

      if (workshopResponse.data) {
        for (const item of workshopResponse.data) {
          workshopSet.add(item.workshop);
        }
      }
    }

    // 7. 获取产量数据并计算总产量（碱产量）
    let totalYield = 0;
    
    // 从production_yields表获取产量（虽然不用于判断日期是否有效，但用于显示总产量）
    for (const date of validDates) {
      const yieldResponse = await client
        .from('production_yields')
        .select('*')
        .eq('product', product)
        .eq('report_date', date);

      if (yieldResponse.data) {
        for (const item of yieldResponse.data) {
          // 氯碱/32%烧碱产品使用碱产量
          if (product === '氯碱') {
            totalYield += parseFloat(item.alkali_yield) || 0;
          }
        }
      }
    }

    // 8. 计算32%烧碱对应的总成本
    // 32%烧碱总成本 = (原材料成本 + 人工与维护成本 + 期间费用 - 调整项) × 0.53
    const materialCost = Object.values(materialCosts).reduce((sum, val) => sum + val, 0);
    const laborCost = Object.values(laborAndMaintenance).reduce((sum, val) => sum + val, 0);
    const periodCost = Object.values(periodExpenses).reduce((sum, val) => sum + val, 0);
    const adjustmentCost = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    const totalCost = materialCost + laborCost + periodCost - adjustmentCost;
    const cost32Percent = totalCost * 0.53;

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
        totalYield,
        totalCost,
        cost32Percent
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
