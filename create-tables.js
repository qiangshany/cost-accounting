const https = require('https');

const SQL = `
// 创建产量表
CREATE TABLE IF NOT EXISTS production_yields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  product VARCHAR(50) NOT NULL,
  workshop VARCHAR(50) NOT NULL,
  yield_32_percent NUMERIC(20,10),
  yield_50_percent NUMERIC(20,10),
  chlorine_yield NUMERIC(20,10),
  hydrochloric_acid_yield NUMERIC(20,10),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, product, workshop)
);

// 创建原材料成本表
CREATE TABLE IF NOT EXISTS material_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  material_name VARCHAR(100) NOT NULL,
  product VARCHAR(50) NOT NULL,
  workshop VARCHAR(50) NOT NULL,
  quantity NUMERIC(20,10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, material_name, product, workshop)
);

// 创建采购单价表
CREATE TABLE IF NOT EXISTS purchase_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  material_name VARCHAR(100) NOT NULL,
  price NUMERIC(20,10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, material_name)
);

// 创建人工维护成本表
CREATE TABLE IF NOT EXISTS labor_maintenance_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  cost_item_name VARCHAR(100) NOT NULL,
  product VARCHAR(50) NOT NULL,
  workshop VARCHAR(50) NOT NULL,
  amount NUMERIC(20,10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, cost_item_name, product, workshop)
);

// 创建期间费用表
CREATE TABLE IF NOT EXISTS period_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  expense_item_name VARCHAR(100) NOT NULL,
  product VARCHAR(50) NOT NULL,
  amount NUMERIC(20,10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, expense_item_name, product)
);

// 创建调整项表
CREATE TABLE IF NOT EXISTS adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  adjustment_name VARCHAR(100) NOT NULL,
  product VARCHAR(50) NOT NULL,
  amount NUMERIC(20,10) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_date, adjustment_name, product)
);
`;

const postData = JSON.stringify({ query: SQL });

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/jaokxwquadfshzklviri/database/query',
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2t4d3F1YWRmc2h6a2x2aXJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2OTA4NCwiZXhwIjoyMDkxOTQ1MDg0fQ.dn_kw3hxebyC5Ug3foFk9Fn0InDpyzpT3uiBXjzX9h4',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2t4d3F1YWRmc2h6a2x2aXJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2OTA4NCwiZXhwIjoyMDkxOTQ1MDg0fQ.dn_kw3hxebyC5Ug3foFk9Fn0InDpyzpT3uiBXjzX9h4',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body.slice(0, 1000));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();