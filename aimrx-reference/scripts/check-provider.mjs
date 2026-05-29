import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProvider() {
  // Find providers with name containing 'joseph'
  const { data: providers, error } = await supabase
    .from('providers')
    .select('id, first_name, last_name, email, is_active, payment_details, physical_address, billing_address')
    .or('first_name.ilike.%joseph%,last_name.ilike.%joseph%,email.ilike.%joseph%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!providers || providers.length === 0) {
    console.log('No providers found with name Joseph');
    return;
  }

  providers.forEach(provider => {
    console.log('\n=== Provider:', provider.first_name, provider.last_name, '===');
    console.log('Email:', provider.email);
    console.log('is_active:', provider.is_active);
    console.log('Has payment_details:', provider.payment_details ? 'YES' : 'NO');
    if (provider.payment_details) {
      console.log('Payment details keys:', Object.keys(provider.payment_details));
    }
    console.log('Has physical_address:', provider.physical_address ? 'YES' : 'NO');
    if (provider.physical_address) {
      console.log('Physical address:', JSON.stringify(provider.physical_address, null, 2));
    }
    console.log('Has billing_address:', provider.billing_address ? 'YES' : 'NO');
    if (provider.billing_address) {
      console.log('Billing address:', JSON.stringify(provider.billing_address, null, 2));
    }
  });
}

checkProvider();
