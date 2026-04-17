// API: 销售数据接口
// src/app/api/sales-data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询销售数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const materialName = searchParams.get('materialName');
    const fetchAll = searchParams.get('fetchAll');

    let query = supabaseAdmin
      .from('sales_data')
      .select('*')
      .order('单据日期', { ascending: false });

    if (fetchAll !== 'true') {
      if (startDate) query = query.gte('单据日期', startDate);
      if (endDate) query = query.lte('单据日期', endDate);
      if (materialName) query = query.eq('物料名称', materialName);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('查询销售数据失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 批量创建销售数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salesData } = body;

    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return NextResponse.json({ success: false, error: '无效的数据' }, { status: 400 });
    }

    // 准备插入数据
    const insertData = salesData.map((item: {
      单据日期: string;
      单据编号: string;
      客户: string;
      业务员: string;
      物料名称: string;
      销售计划数量: number;
      含税净价: number;
      价税合计: number;
      出库数量: number;
    }) => ({
      单据日期: item.单据日期,
      单据编号: item.单据编号,
      客户: item.客户,
      业务员: item.业务员,
      物料名称: item.物料名称,
      销售计划数量: item.销售计划数量,
      含税净价: item.含税净价,
      价税合计: item.价税合计,
      出库数量: item.出库数量,
    }));

    const { data, error } = await supabaseAdmin
      .from('sales_data')
      .insert(insertData)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data: { insertedCount: data?.length || 0 } });
  } catch (error) {
    console.error('创建销售数据失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除销售数据
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    let query = supabaseAdmin.from('sales_data').delete();

    if (id) {
      query = query.eq('id', id);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除销售数据失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
