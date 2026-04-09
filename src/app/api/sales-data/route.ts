import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Excel数据类型定义
interface ExcelSalesData {
  单据日期: string;
  客户: string;
  业务员: string;
  物料名称: string;
  销售计划数量: number;
  含税净价: number;
  价税合计: number;
  出库数量: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const materialName = searchParams.get('materialName');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('sales_data').select('*', { count: 'exact' });

    if (startDate) {
      query = query.gte('document_date', startDate);
    }

    if (endDate) {
      query = query.lte('document_date', endDate);
    }

    if (materialName) {
      query = query.eq('material_name', materialName);
    }

    // 添加排序和分页
    query = query
      .order('document_date', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    const { data, error, count } = await query;

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
      total: count || 0,
      page,
      pageSize,
      hasMore: count ? (page + 1) * pageSize < count : false,
    });
  } catch (error) {
    console.error('查询销售数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
        data: [],
        total: 0,
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
    const records = salesData.map((item: ExcelSalesData) => ({
      document_date: item.单据日期,
      customer: item.客户,
      salesman: item.业务员,
      material_name: item.物料名称,
      planned_quantity: Number(item.销售计划数量) || 0,
      tax_included_price: Number(item.含税净价) || 0,
      total_tax_price: Number(item.价税合计) || 0,
      outbound_quantity: Number(item.出库数量) || 0,
    }));

    // 获取要导入的日期范围
    const dates = [...new Set(records.map(r => r.document_date))];
    
    // 先删除该日期范围内的旧数据（避免重复导入）
    if (dates.length > 0) {
      const minDate = dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      await client.from('sales_data')
        .delete()
        .gte('document_date', minDate)
        .lte('document_date', maxDate);
    }

    // 直接插入所有数据
    const { data, error } = await client.from('sales_data').insert(records).select();

    if (error) {
      throw new Error(`插入失败: ${error.message}`);
    }

    const insertedCount = data?.length || 0;

    return NextResponse.json({
      success: true,
      data: { insertedCount, failedCount: 0 },
      message: `成功导入 ${insertedCount} 条销售数据`,
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
    const deleteAll = searchParams.get('deleteAll') === 'true';

    const client = getSupabaseClient();

    // 如果deleteAll为true，删除所有数据
    if (deleteAll) {
      const { error } = await client.from('sales_data').delete().neq('id', '');

      if (error) {
        throw new Error(`数据库操作失败: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        message: '所有销售数据已成功删除',
      });
    }

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
