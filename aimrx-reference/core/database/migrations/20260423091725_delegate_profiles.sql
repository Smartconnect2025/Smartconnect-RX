CREATE TABLE "delegate_profiles" (
	"delegate_user_id" uuid PRIMARY KEY NOT NULL,
	"physical_address" jsonb,
	"billing_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "delegate_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delegate_profiles" ADD CONSTRAINT "delegate_profiles_delegate_user_id_users_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE POLICY "delegate_profiles_select_policy" ON "delegate_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("delegate_profiles"."delegate_user_id" = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "delegate_profiles_insert_policy" ON "delegate_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("delegate_profiles"."delegate_user_id" = auth.uid());
CREATE POLICY "delegate_profiles_update_policy" ON "delegate_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("delegate_profiles"."delegate_user_id" = auth.uid()) WITH CHECK ("delegate_profiles"."delegate_user_id" = auth.uid());
CREATE POLICY "delegate_profiles_delete_policy" ON "delegate_profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));
