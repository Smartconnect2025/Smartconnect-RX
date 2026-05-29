/**
 * One-time script to create medication-images Supabase Storage bucket
 * Run this once to set up the bucket for medication image uploads
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase credentials not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createMedicationBucket() {
  try {
    // Check if bucket already exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.id === 'medication-images');

    if (bucketExists) {
      return;
    }

    // Create the bucket
    const { error } = await supabase.storage.createBucket('medication-images', {
      public: true,
      fileSizeLimit: 3145728, // 3MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    });

    if (error) {
      console.error('Error creating bucket:', error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

createMedicationBucket();
