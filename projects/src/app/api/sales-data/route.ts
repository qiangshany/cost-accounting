import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET: 获取所有销售数据
export async function GET() {
  try {
    const client = getSupabaseClient();

    // 分批获取所有数据，移除默认的1000条限制
    const BATCH_SIZE = 1000;
    let allData: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error, count } = await client
        .from('sales_data')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        console.error('查询销售数据失败:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += BATCH_SIZE;
        hasMore = data.length === BATCH_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[API] 查询结果: 总记录数=${allData.length}`);

    // 转换字段名以匹配前端格式
    const salesData = allData.map(item => ({
      单据日期: item.order_date,
      客户: item.customer,
      业务员: item.salesman || '',
      物料名称: item.material_name,
      销售计划数量: parseFloat(item.plan_quantity) || 0,
      含税净价: parseFloat(item.tax_price) || 0,
      价税合计: parseFloat(item.tax_total) || 0,
      出库数量: parseFloat(item.out_quantity) || 0,
    }));
    
    return NextResponse.json({ data: salesData });
  } catch (err) {
    console.error('获取销售数据异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// POST: 批量保存销售数据
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const body = await request.json();
    const { data: salesDataArray } = body;
    
    if (!Array.isArray(salesDataArray) || salesDataArray.length === 0) {
      return NextResponse.json({ error: '数据格式错误' }, { status: 400 });
    }
    
    // 先清空现有数据
    const { error: deleteError } = await client
      .from('sales_data')
      .delete()
      .neq('id', 0); // 删除所有数据
    
    if (deleteError) {
      console.error('清空数据失败:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    
    // 转换数据格式以匹配数据库字段
    const dbRecords = salesDataArray.map(item => ({
      order_date: item.单据日期,
      customer: item.客户,
      salesman: item.业务员 || null,
      material_name: item.物料名称,
      plan_quantity: String(item.销售计划数量 || 0),
      tax_price: String(item.含税净价 || 0),
      tax_total: String(item.价税合计 || 0),
      out_quantity: String(item.出库数量 || 0),
    }));
    
    // 批量插入
    const { error: insertError } = await client
      .from('sales_data')
      .insert(dbRecords);
    
    if (insertError) {
      console.error('保存销售数据失败:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, count: dbRecords.length });
  } catch (err) {
    console.error('保存销售数据异常:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
