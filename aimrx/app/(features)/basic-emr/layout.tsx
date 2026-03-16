import DefaultLayout from "@/components/layout/DefaultLayout";

export default function BasicEmrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
