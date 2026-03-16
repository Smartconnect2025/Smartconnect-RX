CREATE TABLE "platform_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "platform_managers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ADD COLUMN "platform_manager_id" uuid;
ALTER TABLE "groups" ADD CONSTRAINT "groups_platform_manager_id_platform_managers_id_fk" FOREIGN KEY ("platform_manager_id") REFERENCES "public"."platform_managers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "groups" DROP COLUMN "platform_manager";
CREATE POLICY "platform_managers_select_policy" ON "platform_managers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()) OR public.is_provider());
CREATE POLICY "platform_managers_insert_policy" ON "platform_managers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "platform_managers_update_policy" ON "platform_managers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "platform_managers_delete_policy" ON "platform_managers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));