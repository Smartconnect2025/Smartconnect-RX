ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = "user_roles"."user_id");
CREATE POLICY "user_roles_select_admin" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_insert_admin" ON "user_roles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_update_admin" ON "user_roles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_delete_admin" ON "user_roles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));