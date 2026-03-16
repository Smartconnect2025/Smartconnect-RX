import DefaultLayout from "@/components/layout/DefaultLayout";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
