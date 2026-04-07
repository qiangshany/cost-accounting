import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST() {
  try {
    const client = getSupabaseClient();

    // 计算一周前的日期
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 删除各表中早于一周前的数据
    const [materialResult, priceResult, laborResult, periodResult, adjustmentResult] = await Promise.all([
      client
        .from('material_costs')
        .delete()
        .lt('report_date', oneWeekAgoStr),
      client
        .from('purchase_prices')
        .delete()
        .lt('report_date', oneWeekAgoStr),
      client
        .from('labor_maintenance_costs')
        .delete()
        .lt('report_date', oneWeekAgoStr),
      client
        .from('period_expenses')
        .delete()
        .lt('report_date', oneWeekAgoStr),
      client
        .from('adjustments')
        .delete()
        .lt('report_date', oneWeekAgoStr),
    ]);

    const errors: string[] = [];
    if (materialResult.error) errors.push(`原材料: ${materialResult.error.message}`);
    if (priceResult.error) errors.push(`采购单价: ${priceResult.error.message}`);
    if (laborResult.error) errors.push(`人工维护: ${laborResult.error.message}`);
    if (periodResult.error) errors.push(`期间费用: ${periodResult.error.message}`);
    if (adjustmentResult.error) errors.push(`调整项: ${adjustmentResult.error.message}`);

    if (errors.length > 0) {
      throw new Error(`部分数据删除失败: ${errors.join(', ')}`);
    }

    return NextResponse.json({
      success: true,
      message: `已成功删除 ${oneWeekAgoStr} 之前的数据`,
    });
  } catch (error) {
    console.error('清除旧数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '清除失败',
      },
      { status: 500 }
    );
  }
}
