const { createClient } = require('@supabase/supabase-js');

console.log('[supabase] usando key:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) + '...');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCurrencies() {
  const { data, error } = await supabase.from('currencies').select('*');
  if (error) throw error;
  return data;
}

async function getFallbackRates(base) {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base', base.toUpperCase());
  if (error) throw error;
  return data;
}

module.exports = { supabase, getCurrencies, getFallbackRates };
