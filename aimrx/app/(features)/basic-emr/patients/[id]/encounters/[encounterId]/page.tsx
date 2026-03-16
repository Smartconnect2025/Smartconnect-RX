import { EncounterView } from "@/features/basic-emr";

interface EncounterPageProps {
  params: Promise<{
    id: string;
    encounterId: string;
  }>;
}

export default async function EncounterPage({ params }: EncounterPageProps) {
  const { id, encounterId } = await params;
  
  return <EncounterView patientId={id} encounterId={encounterId} />;
} 