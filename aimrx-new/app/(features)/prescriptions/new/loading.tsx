import DefaultLayout from "@/components/layout/DefaultLayout";

export default function PrescriptionNewLoading() {
  return (
    <DefaultLayout>
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E3A8A] border-t-transparent" />
          <p className="text-gray-500 text-sm font-medium">Loading prescriptions...</p>
        </div>
      </div>
    </DefaultLayout>
  );
}
