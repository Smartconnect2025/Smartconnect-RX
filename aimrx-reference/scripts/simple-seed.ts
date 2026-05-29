/**
 * Simple Seed Script - No Dependencies
 *
 * Run with: npx tsx scripts/simple-seed.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables first
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;


const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const MEDICATIONS = [
  { name: 'Semaglutide', dosage: '2.5mg', form: 'Injection' },
  { name: 'Tirzepatide', dosage: '5mg', form: 'Injection' },
  { name: 'Metformin', dosage: '500mg', form: 'Tablet' },
  { name: 'Lisinopril', dosage: '10mg', form: 'Tablet' },
  { name: 'Atorvastatin', dosage: '20mg', form: 'Tablet' },
  { name: 'Levothyroxine', dosage: '50mcg', form: 'Tablet' },
  { name: 'Amlodipine', dosage: '5mg', form: 'Tablet' },
  { name: 'Omeprazole', dosage: '20mg', form: 'Capsule' },
  { name: 'Vitamin B12', dosage: '1000mcg', form: 'Injection' },
  { name: 'Gabapentin', dosage: '300mg', form: 'Capsule' },
];

const STATUSES = ['submitted', 'billing', 'approved', 'processing', 'shipped', 'delivered'];

const SIGS = [
  'Take 1 tablet by mouth once daily',
  'Take 1 tablet by mouth twice daily with meals',
  'Inject subcutaneously once weekly',
  'Take 1 tablet by mouth every morning',
  'Take 1 capsule by mouth at bedtime',
  'Take 1 tablet by mouth twice daily',
];

const generateTrackingNumber = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tracking = '1Z';
  for (let i = 0; i < 16; i++) {
    tracking += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tracking;
};

async function simpleSeed() {
  // Get existing providers
  const { data: providers, error: providersError } = await supabase
    .from('providers')
    .select('user_id, first_name, last_name')
    .limit(5);

  if (providersError) {
    console.error('Error getting providers:', providersError);
    process.exit(1);
  }

  if (!providers || providers.length === 0) {
    console.error('No providers found in database');
    process.exit(1);
  }

  // Get existing patients
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .limit(10);

  if (patientsError) {
    console.error('Error getting patients:', patientsError);
    process.exit(1);
  }

  if (!patients || patients.length === 0) {
    console.error('No patients found in database');
    process.exit(1);
  }

  // Create test prescriptions
  const prescriptions = [];
  const now = Date.now();

  for (let i = 0; i < 15; i++) {
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const medication = MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const sig = SIGS[Math.floor(Math.random() * SIGS.length)];
    const quantity = [30, 60, 90][Math.floor(Math.random() * 3)];
    const refills = [0, 1, 3, 6][Math.floor(Math.random() * 4)];

    const queueId = `RX${now}${String(i).padStart(3, '0')}`;
    const trackingNumber = (status === 'shipped' || status === 'delivered')
      ? generateTrackingNumber()
      : null;

    const submittedAt = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);

    prescriptions.push({
      prescriber_id: provider.user_id,
      patient_id: patient.id,
      medication: medication.name,
      dosage: medication.dosage,
      form: medication.form,
      quantity,
      refills,
      sig,
      status,
      queue_id: queueId,
      tracking_number: trackingNumber,
      submitted_at: submittedAt.toISOString(),
    });
  }

  const { data: created, error: insertError } = await supabase
    .from('prescriptions')
    .insert(prescriptions)
    .select();

  if (insertError) {
    console.error('Error creating prescriptions:', insertError);
    process.exit(1);
  }
}

simpleSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal:', error);
    process.exit(1);
  });
