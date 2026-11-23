import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { LeadForm } from "@/components/leads/lead-form";

export const metadata = { title: "Add lead" };

export default function NewLeadPage() {
  return (
    <>
      <PageHeader icon={<UserPlus />} title="Add lead" description="Duplicates are checked by LinkedIn URL, email, and name + company before saving." />
      <Card><CardContent className="pt-5"><LeadForm /></CardContent></Card>
    </>
  );
}
