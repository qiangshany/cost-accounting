import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 安全解析数值函数
const safeParseNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  // 如果已经是数字类型
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    return 0;
  }
  
  // 如果是字符串
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return num;
    }
    
    const match = trimmed.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    if (match) {
      const parsed = parseFloat(match[0]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    
    return 0;
  }
  
  // 对于对象类型
  if (typeof value === 'object') {
    const strValue = String(value);
    const match = strValue.match(/[-+]?\d*\.?\d+/);
    if (match) {
      const parsed = parseFloat(match[0]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  
  return 0;
};

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
    const fetchAll = searchParams.get('fetchAll') === 'true';

    const client = getSupabaseClient();

    // ========== 获取全部数据（突破1000条限制）==========
    if (fetchAll) {
      console.log('[API] 开始获取全部数据');

      let allData: unknown[] = [];
      let lastId = '';
      const BATCH_SIZE = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = client.from('sales_data').select('*').order('id', { ascending: true }).limit(BATCH_SIZE);

        if (lastId) {
          query = query.gt('id', lastId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[API] 获取数据失败:', error);
          throw new Error('获取数据失败');
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          lastId = data[data.length - 1].id;
          console.log(`[API] 已获取 ${allData.length} 条数据`);

          if (data.length < BATCH_SIZE) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      console.log('[API] 数据获取完成，总条数:', allData.length);

      // 转换数据格式
      const formattedData = (allData as Array<Record<string, unknown>>).map((item) => ({
        单据日期: item.document_date,
        客户: item.customer,
        业务员: item.salesman,
        物料名称: item.material_name,
        销售计划数量: safeParseNumber(item.planned_quantity),
        含税净价: safeParseNumber(item.tax_included_price),
        价税合计: safeParseNumber(item.total_tax_price),
        出库数量: safeParseNumber(item.outbound_quantity),
      }));

      return NextResponse.json({
        success: true,
        data: formattedData,
        total: formattedData.length,
      });
    }

    // ========== 普通分页查询 ==========
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
      销售计划数量: safeParseNumber(item.planned_quantity),
      含税净价: safeParseNumber(item.tax_included_price),
      价税合计: safeParseNumber(item.total_tax_price),
      出库数量: safeParseNumber(item.outbound_quantity),
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

    console.log('[API] 开始保存数据，条数:', salesData.length);

    // ========== 步骤5.1: 清空旧数据 ==========
    const { error: deleteError } = await client.from('sales_data').delete().neq('id', '');

    if (deleteError) {
      console.error('[API] 清空旧数据失败:', deleteError);
      throw new Error('清空旧数据失败');
    }

    console.log('[API] 旧数据已清空');

    // 转换数据格式
    const records = salesData.map((item: ExcelSalesData) => ({
      document_date: item.单据日期,
      customer: item.客户,
      salesman: item.业务员,
      material_name: item.物料名称,
      planned_quantity: safeParseNumber(item.销售计划数量),
      tax_included_price: safeParseNumber(item.含税净价),
      total_tax_price: safeParseNumber(item.价税合计),
      outbound_quantity: safeParseNumber(item.出库数量),
    }));

    // ========== 步骤5.2: 分批插入新数据 ==========
    const BATCH_SIZE = 500; // 每批500条
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    let totalInserted = 0;

    console.log(`[API] 开始分批插入，共 ${totalBatches} 批，每批 ${BATCH_SIZE} 条`);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = start + BATCH_SIZE;
      const batch = records.slice(start, end);

      const { error: insertError } = await client.from('sales_data').insert(batch);

      if (insertError) {
        console.error(`[API] 第 ${i + 1} 批插入失败:`, insertError);
        throw new Error(`批量插入失败: ${insertError.message}`);
      }

      totalInserted += batch.length;
      console.log(`[API] 第 ${i + 1}/${totalBatches} 批插入完成，累计 ${totalInserted} 条`);
    }

    console.log('[API] 所有数据保存成功');

    return NextResponse.json({
      success: true,
      data: { insertedCount: totalInserted, failedCount: 0 },
      message: `成功导入 ${totalInserted} 条销售数据`,
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
