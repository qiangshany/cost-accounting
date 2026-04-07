import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('production_yields').select('*');

    if (date) {
      query = query.eq('report_date', date);
    }

    if (product) {
      query = query.eq('product', product);
    }

    if (workshop) {
      query = query.eq('workshop', workshop);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('查询产量数据错误:', error);
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
    const {
      report_date,
      product,
      workshop,
      alkali_yield,
      chlorine_yield,
      hydrochloric_acid_yield,
    } = body;

    // 验证必填字段
    if (!report_date || !product || !workshop) {
      return NextResponse.json(
        { error: '缺少必填字段：日期、产品、车间' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 使用 upsert 实现幂等性
    const { data, error } = await client
      .from('production_yields')
      .upsert(
        {
          report_date,
          product,
          workshop,
          alkali_yield: alkali_yield || 0,
          chlorine_yield: chlorine_yield || 0,
          hydrochloric_acid_yield: hydrochloric_acid_yield || 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'report_date,workshop,product',
        }
      )
      .select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: '产量数据已成功提交',
    });
  } catch (error) {
    console.error('产量提报错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '提交失败',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');

    if (!date || !product || !workshop) {
      return NextResponse.json(
        { error: '缺少必填参数：日期、产品、车间' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from('production_yields')
      .delete()
      .eq('report_date', date)
      .eq('product', product)
      .eq('workshop', workshop);

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '产量数据已成功删除',
    });
  } catch (error) {
    console.error('删除产量数据错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}
