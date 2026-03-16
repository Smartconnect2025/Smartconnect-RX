/**
 * Admin Seed Prescriptions API
 *
 * Creates test prescriptions for pharmacy admin testing
 * Call this endpoint as an authenticated admin user
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@core/database/client';
import { getUser } from '@core/auth';

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

export async function POST() {
  const { user, userRole } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!userRole || !["admin", "super_admin"].includes(userRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();

    // Get existing providers
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('user_id, first_name, last_name')
      .limit(5);

    if (providersError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch providers',
          details: providersError.message,
          hint: 'Please create a provider account first',
        },
        { status: 400 }
      );
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No providers found',
          hint: 'Please register as a provider first at /auth/register',
        },
        { status: 400 }
      );
    }

    // Get existing patients
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .limit(10);

    if (patientsError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch patients',
          details: patientsError.message,
        },
        { status: 400 }
      );
    }

    if (!patients || patients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No patients found',
          hint: 'Please create a patient first at /basic-emr/patients/new',
        },
        { status: 400 }
      );
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
      const trackingNumber =
        status === 'shipped' || status === 'delivered' ? generateTrackingNumber() : null;

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
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create prescriptions',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    // Calculate status distribution
    const statusCounts = prescriptions.reduce(
      (acc, rx) => {
        acc[rx.status] = (acc[rx.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      created: created?.length || 0,
      providers_found: providers.length,
      patients_found: patients.length,
      status_distribution: statusCounts,
      message: `Created ${created?.length || 0} test prescriptions. Visit /admin/prescriptions to view them.`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
