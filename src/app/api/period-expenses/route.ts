import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const product = searchParams.get('product');
    const expenseItemName = searchParams.get('expenseItemName');

    const client = getSupabaseClient();

    // 构建查询条件
    let query = client.from('period_expenses').select('*');

    if (date) {
      query = query.eq('report_date', date);
    }

    if (product) {
      query = query.eq('product', product);
    }

    if (expenseItemName) {
      query = query.eq('expense_item_name', expenseItemName);
    }

    const { data, error } = await query.order('expense_item_name', { ascending: true });

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('查询期间费用数据错误:', error);
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
    // { report_date, expense_item_name, product, amount, unit }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '缺少数据项' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 批量 upsert
    const { data, error } = await client
      .from('period_expenses')
      .upsert(
        items.map(item => ({
          report_date: item.report_date,
          expense_item_name: item.expense_item_name,
          product: item.product,
          amount: item.amount,
          unit: item.unit,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'report_date,expense_item_name,product',
        }
      )
      .select();

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      message: '期间费用数据已成功提交',
    });
  } catch (error) {
    console.error('期间费用提报错误:', error);
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

    if (!date || !product) {
      return NextResponse.json(
        { error: '缺少必填参数：日期、产品' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    const { error } = await client
      .from('period_expenses')
      .delete()
      .eq('report_date', date)
      .eq('product', product);

    if (error) {
      throw new Error(`数据库操作失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '期间费用数据已成功删除',
    });
  } catch (error) {
    console.error('删除期间费用数据错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '删除失败',
      },
      { status: 500 }
    );
  }
}
