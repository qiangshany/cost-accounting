// API: 调整项接口
// src/app/api/adjustments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询调整项
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const product = searchParams.get('product');

    let query = supabaseAdmin
      .from('adjustments')
      .select('*');

    if (date) query = query.eq('report_date', date);
    if (product) query = query.eq('product', product);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('查询调整项失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 批量创建/更新调整项
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
      adjustment_name: string;
      product: string;
      amount: number;
      unit: string;
    }) => ({
      report_date: item.report_date,
      adjustment_name: item.adjustment_name,
      product: item.product,
      amount: item.amount,
      unit: item.unit,
    }));

    const { data, error } = await supabaseAdmin
      .from('adjustments')
      .upsert(upsertData, {
        onConflict: 'report_date,adjustment_name,product'
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建/更新调整项失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除调整项
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const product = searchParams.get('product');

    let query = supabaseAdmin.from('adjustments').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (date && product) {
      query = query.eq('report_date', date).eq('product', product);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除调整项失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
