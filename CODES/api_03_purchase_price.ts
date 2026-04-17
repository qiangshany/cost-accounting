// API: 采购单价接口
// src/app/api/purchase-price/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询采购单价
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    let query = supabaseAdmin
      .from('purchase_prices')
      .select('*');

    if (date) query = query.eq('report_date', date);

    // 按日期降序排列，取最新日期的数据
    query = query.order('report_date', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // 如果指定了日期，返回该日期的数据；否则返回最新日期的数据
    if (date) {
      const filteredData = data?.filter(item => item.report_date === date) || [];
      return NextResponse.json({ success: true, data: filteredData });
    }

    // 如果没有指定日期，返回最新日期的数据
    if (data && data.length > 0) {
      const latestDate = data[0].report_date;
      const latestData = data.filter(item => item.report_date === latestDate);
      return NextResponse.json({ success: true, data: latestData });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error('查询采购单价失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 批量创建/更新采购单价
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: '无效的数据' }, { status: 400 });
    }

    // 准备 upsert 数据
    const upsertData = items.map((item: {
      report_date: string;
      material_name: string;
      price: number;
      unit: string;
    }) => ({
      report_date: item.report_date,
      material_name: item.material_name,
      price: item.price,
      unit: item.unit,
    }));

    const { data, error } = await supabaseAdmin
      .from('purchase_prices')
      .upsert(upsertData, {
        onConflict: 'report_date,material_name'
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建/更新采购单价失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除采购单价
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const materialName = searchParams.get('material_name');

    let query = supabaseAdmin.from('purchase_prices').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (date && materialName) {
      query = query.eq('report_date', date).eq('material_name', materialName);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除采购单价失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
