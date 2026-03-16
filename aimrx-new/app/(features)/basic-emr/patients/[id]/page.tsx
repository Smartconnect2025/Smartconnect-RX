import { PatientChart } from '@/features/basic-emr/components/PatientChart';

interface PatientChartPageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientChartPage({ params }: PatientChartPageProps) {
  const { id } = await params;
  return <PatientChart patientId={id} />;
} 