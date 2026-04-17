// API: 人工与维护成本接口
// src/app/api/labor-maintenance-costs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询人工与维护成本
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin
      .from('labor_maintenance_costs')
      .select('*');

    if (date) query = query.eq('report_date', date);
    if (product) query = query.eq('product', product);
    if (workshop) query = query.eq('workshop', workshop);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('查询人工与维护成本失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 批量创建/更新人工与维护成本
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
      cost_item_name: string;
      product: string;
      workshop: string;
      amount: number;
      unit: string;
    }) => ({
      report_date: item.report_date,
      cost_item_name: item.cost_item_name,
      product: item.product,
      workshop: item.workshop,
      amount: item.amount,
      unit: item.unit,
    }));

    const { data, error } = await supabaseAdmin
      .from('labor_maintenance_costs')
      .upsert(upsertData, {
        onConflict: 'report_date,cost_item_name,workshop,product'
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建/更新人工与维护成本失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除人工与维护成本
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin.from('labor_maintenance_costs').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (date && product && workshop) {
      query = query.eq('report_date', date).eq('product', product).eq('workshop', workshop);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除人工与维护成本失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
