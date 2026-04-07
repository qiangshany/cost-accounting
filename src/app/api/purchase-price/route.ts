import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const materialName = searchParams.get('materialName');

    if (!date) {
      return NextResponse.json(
        { error: '缺少日期参数' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('purchase_prices').select('*').eq('report_date', date);

    if (materialName) {
      query = query.eq('material_name', materialName);
    }

    const { data, error } = await query.order('material_name', { ascending: true });

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('查询采购单价数据错误:', error);
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
    const { items } = body;

    // items 应该是一个数组，每个元素包含：
    // { report_date, material_name, price, unit }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '缺少数据项' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 批量 upsert
    const { data, error } = await client
      .from('purchase_prices')
      .upsert(
        items.map(item => ({
          report_date: item.report_date,
          material_name: item.material_name,
          price: item.price,
          unit: item.unit,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'report_date,material_name',
        }
      )
      .select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      message: '采购单价数据已成功提交',
    });
  } catch (error) {
    console.error('采购单价提报错误:', error);
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

    if (!date) {
      return NextResponse.json(
        { error: '缺少必填参数：日期' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from('purchase_prices')
      .delete()
      .eq('report_date', date);

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '采购单价数据已成功删除',
    });
  } catch (error) {
    console.error('删除采购单价数据错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}
