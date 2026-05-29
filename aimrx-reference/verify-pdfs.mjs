import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// First list buckets to find correct one
const { data: buckets } = await sb.storage.listBuckets();
console.log('buckets:', buckets?.map(b=>b.name).join(','));
const paths = [
  ['Brian Adams',     'prescriptions/72a27963-f556-486c-97de-1baf09fb3c8f/1e68eddb-2d6e-4361-aa11-a0ac1fb2e3b4/1777398404259.pdf'],
  ['Annia Chrisakis', 'prescriptions/d4b365f5-aa75-4df9-a942-977fc80ff0db/48ce0dc6-7df4-40b8-87d1-41d11d7dc76a/1777474996408.pdf'],
  ['Paul Zerilli',    'prescriptions/2526ba0d-6a9d-492e-b40a-3b9189db1c5b/191281b2-ef94-4b94-bcd7-1fd46d24a407/1777173411874.pdf'],
];
for (const bucket of (buckets||[]).map(b=>b.name)) {
  for (const [name, p] of paths) {
    const { data, error } = await sb.storage.from(bucket).download(p);
    if (error) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    console.log(`bucket=${bucket} ${name.padEnd(18)} bytes=${buf.length} is_pdf=${buf.slice(0,4).toString()==='%PDF'}`);
  }
}
