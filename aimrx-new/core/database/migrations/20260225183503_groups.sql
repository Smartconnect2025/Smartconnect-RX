CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform_manager" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" ADD COLUMN "group_id" uuid;
ALTER TABLE "providers" ADD CONSTRAINT "providers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;
CREATE POLICY "groups_select_policy" ON "groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()) OR public.is_provider());
CREATE POLICY "groups_insert_policy" ON "groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "groups_update_policy" ON "groups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "groups_delete_policy" ON "groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));