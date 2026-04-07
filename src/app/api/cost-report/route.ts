import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('cost_reports').select('*');

    if (date) {
      query = query.eq('report_date', date);
    }

    if (product) {
      query = query.eq('product', product);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      reports: data || [],
    });
  } catch (error) {
    console.error('查询成本数据错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
        reports: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      product,
      report_date,
      workshop,
      materials,
      labor_and_maintenance,
      period_expenses,
      adjustments,
      alkali_yield,
      chlorine_yield,
      hydrochloric_acid_yield,
    } = body;

    // 验证必填字段
    if (!product || !report_date || !workshop) {
      return NextResponse.json(
        { error: '缺少必填字段：产品、日期、车间' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 使用 upsert 实现幂等性（产品+日期+车间为唯一键）
    const { data, error } = await client
      .from('cost_reports')
      .upsert(
        {
          product,
          report_date,
          workshop,
          materials: materials || {},
          labor_and_maintenance: labor_and_maintenance || {},
          period_expenses: period_expenses || {},
          adjustments: adjustments || {},
          alkali_yield: alkali_yield || 0,
          chlorine_yield: chlorine_yield || 0,
          hydrochloric_acid_yield: hydrochloric_acid_yield || 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'product,report_date,workshop',
        }
      )
      .select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data?.[0],
      message: '成本数据已成功提交',
    });
  } catch (error) {
    console.error('成本提报错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '提交失败',
      },
      { status: 500 }
    );
  }
}
