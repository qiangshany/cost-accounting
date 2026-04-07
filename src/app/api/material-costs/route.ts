import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const workshop = searchParams.get('workshop');
    const materialName = searchParams.get('materialName');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('material_costs').select('*');

    if (date) {
      query = query.eq('report_date', date);
    }

    if (product) {
      query = query.eq('product', product);
    }

    if (workshop) {
      query = query.eq('workshop', workshop);
    }

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
    console.error('查询原材料成本数据错误:', error);
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
    // { report_date, material_name, product, workshop, quantity, unit }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '缺少数据项' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 批量 upsert
    const { data, error } = await client
      .from('material_costs')
      .upsert(
        items.map(item => ({
          report_date: item.report_date,
          material_name: item.material_name,
          product: item.product,
          workshop: item.workshop,
          quantity: item.quantity,
          unit: item.unit,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'report_date,material_name,workshop,product',
        }
      )
      .select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      message: '原材料成本数据已成功提交',
    });
  } catch (error) {
    console.error('原材料成本提报错误:', error);
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
      .from('material_costs')
      .delete()
      .eq('report_date', date)
      .eq('product', product)
      .eq('workshop', workshop);

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '原材料成本数据已成功删除',
    });
  } catch (error) {
    console.error('删除原材料成本数据错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}
