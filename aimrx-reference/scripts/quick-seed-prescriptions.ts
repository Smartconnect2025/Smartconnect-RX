/**
 * Quick Seed Prescriptions - Direct Database Insert
 *
 * This script creates test prescriptions with mock data if no providers/patients exist,
 * or uses existing ones if available.
 *
 * Run with: npx tsx scripts/quick-seed-prescriptions.ts
 */

import { createAdminClient } from '../core/database/client';

const supabase = createAdminClient();

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
  'Apply as directed',
  'Take 1 tablet by mouth three times daily',
];

// Generate tracking number for shipped/delivered
const generateTrackingNumber = () => {
  const prefix = '1Z';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tracking = prefix;
  for (let i = 0; i < 16; i++) {
    tracking += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tracking;
};

async function quickSeed() {
  // Step 1: Check for existing providers
  const { data: existingProviders, error: providersError } = await supabase
    .from('providers')
    .select('id, user_id, first_name, last_name')
    .limit(5);

  if (providersError) {
    console.error('Error checking providers:', providersError);
    process.exit(1);
  }

  let providerIds: string[] = [];

  if (!existingProviders || existingProviders.length === 0) {
    // Create a mock auth user for provider
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test.provider.${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      process.exit(1);
    }

    // Create provider record
    const { data: newProvider, error: providerInsertError } = await supabase
      .from('providers')
      .insert({
        user_id: authData.user.id,
        first_name: 'John',
        last_name: 'Smith',
        npi: '1234567890',
        dea: 'AS1234563',
        state_license: 'NY123456',
        license_state: 'NY',
        phone: '+15555551234',
        specialty: 'Family Medicine',
      })
      .select('user_id')
      .single();

    if (providerInsertError) {
      console.error('Error creating provider:', providerInsertError);
      process.exit(1);
    }

    providerIds = [newProvider.user_id];
  } else {
    providerIds = existingProviders.map(p => p.user_id);
  }

  // Step 2: Check for existing patients
  const { data: existingPatients, error: patientsError } = await supabase
    .from('patients')
    .select('id, first_name, last_name')
    .limit(10);

  if (patientsError) {
    console.error('Error checking patients:', patientsError);
    process.exit(1);
  }

  let patientIds: string[] = [];

  if (!existingPatients || existingPatients.length === 0) {
    const mockPatients = [
      { first_name: 'Emily', last_name: 'Johnson', dob: '1985-03-15', sex: 'F' },
      { first_name: 'Michael', last_name: 'Williams', dob: '1978-07-22', sex: 'M' },
      { first_name: 'Sarah', last_name: 'Brown', dob: '1990-11-08', sex: 'F' },
      { first_name: 'David', last_name: 'Davis', dob: '1982-05-30', sex: 'M' },
      { first_name: 'Jennifer', last_name: 'Miller', dob: '1995-09-12', sex: 'F' },
    ];

    const { data: newPatients, error: patientInsertError } = await supabase
      .from('patients')
      .insert(mockPatients.map(p => ({
        ...p,
        email: `${p.first_name.toLowerCase()}.${p.last_name.toLowerCase()}@example.com`,
        phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        stripe_customer_id: null,
      })))
      .select('id');

    if (patientInsertError) {
      console.error('Error creating patients:', patientInsertError);
      process.exit(1);
    }

    patientIds = newPatients!.map(p => p.id);
  } else {
    patientIds = existingPatients.map(p => p.id);
  }

  // Step 3: Create 15 test prescriptions with varied statuses
  const prescriptionsToCreate = [];
  const now = Date.now();

  for (let i = 0; i < 15; i++) {
    const providerId = providerIds[Math.floor(Math.random() * providerIds.length)];
    const patientId = patientIds[Math.floor(Math.random() * patientIds.length)];
    const medication = MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)];
    const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
    const sig = SIGS[Math.floor(Math.random() * SIGS.length)];
    const quantity = [30, 60, 90][Math.floor(Math.random() * 3)];
    const refills = [0, 1, 3, 6][Math.floor(Math.random() * 4)];

    // Generate Queue ID (DigitalRX format)
    const queueId = `RX${now}${String(i).padStart(3, '0')}`;

    // Add tracking number if shipped or delivered
    const trackingNumber = (status === 'shipped' || status === 'delivered')
      ? generateTrackingNumber()
      : null;

    // Random submitted date within last 7 days
    const submittedAt = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000);

    prescriptionsToCreate.push({
      prescriber_id: providerId,
      patient_id: patientId,
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

  // Insert all prescriptions
  const { data: createdPrescriptions, error: insertError } = await supabase
    .from('prescriptions')
    .insert(prescriptionsToCreate)
    .select();

  if (insertError) {
    console.error('Error creating prescriptions:', insertError);
    process.exit(1);
  }
}

quickSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
