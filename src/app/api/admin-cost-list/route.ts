import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 浓度系数配置
const CONCENTRATION_CONFIG: Record<string, { factor: number; displayName: string }> = {
  '32%烧碱': { factor: 0.32, displayName: '氯碱' },
  '32%液碱': { factor: 0.32, displayName: '氯碱' },
  '32%食品级烧碱': { factor: 0.32, displayName: '氯碱' },
  '32%工业级烧碱': { factor: 0.32, displayName: '氯碱' },
  '50%烧碱': { factor: 0.50, displayName: '氯碱' },
  '50%液碱': { factor: 0.50, displayName: '氯碱' },
  '氯碱': { factor: 0.32, displayName: '氯碱' },
  '31%盐酸': { factor: 0.32, displayName: '氯碱' },
};

// 解析JSON格式数字的辅助函数
// 数据库中数字被存储为 {系数 指数 其他} 格式，如 {240135662000000 -10 false finite true}
// 实际值 = 系数 × 10^指数
function parseJsonNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // 尝试直接解析为数字
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
    
    // 尝试解析JSON格式 {系数 指数 ...}
    const match = value.match(/^{(\S+)\s+(-?\d+)/);
    if (match) {
      const coefficient = parseFloat(match[1]);
      const exponent = parseInt(match[2], 10);
      return coefficient * Math.pow(10, exponent);
    }
  }
  return 0;
}

// 获取成本列表数据（支持日期区间和产品筛选）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productParam = searchParams.get('product') || '32%烧碱'; // 保存原始参数用于判断
    let product = productParam;

    // 获取浓度系数和数据库产品名称映射
    const config = CONCENTRATION_CONFIG[product] || { factor: 0.32, displayName: '氯碱' };
    const concentrationFactor = config.factor;
    const dbProductName = config.displayName;
    
    // 将产品参数映射为数据库中的产品名称
    product = dbProductName;
    
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
          const qty = parseJsonNumber(item.quantity);
          
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
            
            const dayPrice = priceResponse.data ? parseJsonNumber(priceResponse.data.price) : 0;
            
            // 获取该日期的数量
            const quantityResponse = await client
              .from('material_costs')
              .select('quantity')
              .eq('product', product)
              .eq('report_date', date)
              .eq('material_name', name)
              .single();
            
            const dayQuantity = quantityResponse.data ? parseJsonNumber(quantityResponse.data.quantity) : 0;
            
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
          const amount = parseJsonNumber(item.amount);
          
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
          const amount = parseJsonNumber(item.amount);
          
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
          const amount = parseJsonNumber(item.amount);
          
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

    // 7. 获取32%和50%烧碱的产量
    let yield32Percent = 0; // 32%烧碱产量
    let yield50Percent = 0; // 50%烧碱产量
    
    for (const date of validDates) {
      const yieldResponse = await client
        .from('production_yields')
        .select('yield_32_percent, yield_50_percent')
        .eq('product', dbProductName)
        .eq('report_date', date);

      if (yieldResponse.data) {
        for (const item of yieldResponse.data) {
          yield32Percent += parseJsonNumber(item.yield_32_percent);
          yield50Percent += parseJsonNumber(item.yield_50_percent);
        }
      }
    }
    
    // 计算总碱产量（纯碱数量）
    // 总碱产量 = 32%烧碱产量 × 0.32 + 50%烧碱产量 × 0.5
    const totalAlkaliQuantity = yield32Percent * 0.32 + yield50Percent * 0.5;
    
    // 计算分配系数
    // 32%烧碱的纯碱占比 = 32%烧碱产量 × 0.32 / 总碱产量
    // 50%烧碱的纯碱占比 = 50%烧碱产量 × 0.5 / 总碱产量
    let yield32PercentAllocation = 0;
    let yield50PercentAllocation = 0;
    if (totalAlkaliQuantity > 0) {
      yield32PercentAllocation = (yield32Percent * 0.32) / totalAlkaliQuantity;
      yield50PercentAllocation = (yield50Percent * 0.5) / totalAlkaliQuantity;
    }

    // 8. 计算总成本
    // 总成本 = 原材料成本 + 人工与维护成本 + 期间费用 - 调整项
    const materialCost = Object.values(materialCosts).reduce((sum, val) => sum + val, 0);
    const laborCost = Object.values(laborAndMaintenance).reduce((sum, val) => sum + val, 0);
    const periodCost = Object.values(periodExpenses).reduce((sum, val) => sum + val, 0);
    const adjustmentCost = Object.values(adjustments).reduce((sum, val) => sum + val, 0);
    const totalCost = materialCost + laborCost + periodCost - adjustmentCost;
    
    // 碱成本 = 总成本 × 0.53
    const concentrationCost = totalCost * 0.53;
    
    // 根据产品类型返回对应的浓度烧碱成本
    // 32%烧碱成本 = 总成本 × 0.53 × 分配系数
    // 50%烧碱成本 = 总成本 × 0.53 × 分配系数
    const is50Percent = productParam === '50%烧碱' || productParam.includes('50%');
    const effectiveConcentrationCost = is50Percent
      ? concentrationCost * yield50PercentAllocation
      : concentrationCost * yield32PercentAllocation;
    
    // 根据产品类型返回对应的产量（用于吨成本计算）
    // 吨成本 = 浓度烧碱成本 / 对应浓度产量
    const effectiveYield = is50Percent
      ? yield50Percent
      : yield32Percent;
    
    // 浓度系数（用于显示）
    const effectiveConcentrationFactor = is50Percent ? 0.50 : 0.32;

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
        // 产量数据
        yield32Percent,
        yield50Percent,
        totalAlkaliQuantity,
        // 成本数据
        totalYield: effectiveYield, // 用于吨成本计算的对应浓度产量
        totalCost,
        concentrationCost: effectiveConcentrationCost, // 根据产品分配的浓度烧碱成本
        concentrationFactor: effectiveConcentrationFactor
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
