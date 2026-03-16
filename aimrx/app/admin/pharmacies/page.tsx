import { redirect } from "next/navigation";

export default function PharmaciesPage() {
  // Redirect to pharmacy management page
  redirect("/admin/pharmacy-management");
}
