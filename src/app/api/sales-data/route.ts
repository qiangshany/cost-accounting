import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const materialName = searchParams.get('materialName');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('sales_data').select('*').order('document_date', { ascending: true });

    if (startDate) {
      query = query.gte('document_date', startDate);
    }

    if (endDate) {
      query = query.lte('document_date', endDate);
    }

    if (materialName) {
      query = query.eq('material_name', materialName);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    // 转换数据格式以匹配前端期望
    const formattedData = (data || []).map((item) => ({
      单据日期: item.document_date,
      客户: item.customer,
      业务员: item.salesman,
      物料名称: item.material_name,
      销售计划数量: parseFloat(item.planned_quantity?.toString() || '0'),
      含税净价: parseFloat(item.tax_included_price?.toString() || '0'),
      价税合计: parseFloat(item.total_tax_price?.toString() || '0'),
      出库数量: parseFloat(item.outbound_quantity?.toString() || '0'),
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.error('查询销售数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salesData } = body;

    // 验证必填字段
    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少销售数据' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 转换数据格式
    const records = salesData.map((item: any) => ({
      document_date: item.单据日期,
      customer: item.客户,
      salesman: item.业务员,
      material_name: item.物料名称,
      planned_quantity: item.销售计划数量,
      tax_included_price: item.含税净价,
      total_tax_price: item.价税合计,
      outbound_quantity: item.出库数量,
    }));

    // 批量插入数据
    const { data, error } = await client.from('sales_data').insert(records).select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: `成功导入 ${data?.length || 0} 条销售数据`,
    });
  } catch (error) {
    console.error('保存销售数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失败',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const materialName = searchParams.get('materialName');

    const client = getSupabaseClient();

    // 构建删除条件
    let query = client.from('sales_data').delete();

    if (startDate) {
      query = query.gte('document_date', startDate);
    }

    if (endDate) {
      query = query.lte('document_date', endDate);
    }

    if (materialName) {
      query = query.eq('material_name', materialName);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '销售数据已成功删除',
    });
  } catch (error) {
    console.error('删除销售数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}
