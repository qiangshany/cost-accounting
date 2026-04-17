// API: 产量数据接口
// src/app/api/production-yields/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/storage/database/supabase-admin';

// GET: 查询产量数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin
      .from('production_yields')
      .select('*');

    if (date) query = query.eq('report_date', date);
    if (product) query = query.eq('product', product);
    if (workshop) query = query.eq('workshop', workshop);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('查询产量数据失败:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}

// POST: 创建/更新产量数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { report_date, product, workshop, yield32Percent, yield50Percent, chlorine_yield, hydrochloric_acid_yield } = body;

    // 使用 upsert 逻辑
    const { data, error } = await supabaseAdmin
      .from('production_yields')
      .upsert({
        report_date,
        product,
        workshop,
        alkali_yield: yield32Percent || 0,
        chlorine_yield: chlorine_yield || 0,
        hydrochloric_acid_yield: hydrochloric_acid_yield || 0,
        // 添加自定义字段用于存储32%和50%烧碱产量
        metadata: {
          yield32Percent: yield32Percent || 0,
          yield50Percent: yield50Percent || 0,
        }
      }, {
        onConflict: 'report_date,product,workshop'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建/更新产量数据失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// DELETE: 删除产量数据
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    let query = supabaseAdmin.from('production_yields').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (date && product && workshop) {
      query = query.eq('report_date', date).eq('product', product).eq('workshop', workshop);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除产量数据失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
