// API: 原材料成本接口
// src/app/api/material-costs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询原材料成本
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin
      .from('material_costs')
      .select('*');

    if (date) query = query.eq('report_date', date);
    if (product) query = query.eq('product', product);
    if (workshop) query = query.eq('workshop', workshop);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('查询原材料成本失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 批量创建/更新原材料成本
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
      product: string;
      workshop: string;
      quantity: number;
      unit: string;
    }) => ({
      report_date: item.report_date,
      material_name: item.material_name,
      product: item.product,
      workshop: item.workshop,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const { data, error } = await supabaseAdmin
      .from('material_costs')
      .upsert(upsertData, {
        onConflict: 'report_date,material_name,workshop,product'
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建/更新原材料成本失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除原材料成本
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin.from('material_costs').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (date && product && workshop) {
      query = query.eq('report_date', date).eq('product', product).eq('workshop', workshop);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除原材料成本失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
