ALTER TYPE "public"."user_role" ADD VALUE 'delegate';
CREATE TABLE "delegations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delegate_user_id" uuid,
	"delegate_first_name" text NOT NULL,
	"delegate_last_name" text NOT NULL,
	"delegate_email" text NOT NULL,
	"delegate_phone" text,
	"delegate_title" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"scope_refills" boolean DEFAULT true NOT NULL,
	"scope_new_rx" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending_admin' NOT NULL,
	"agreement_version" integer NOT NULL,
	"agreement_text_hash" text NOT NULL,
	"agreement_text_snapshot" text NOT NULL,
	"provider_signature_url" text NOT NULL,
	"provider_signed_at" timestamp with time zone NOT NULL,
	"provider_signed_ip" text NOT NULL,
	"delegate_signature_url" text,
	"delegate_signed_at" timestamp with time zone,
	"delegate_signed_ip" text,
	"admin_user_id" uuid,
	"admin_action_at" timestamp with time zone,
	"admin_rejection_reason" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delegations_scope_check" CHECK (scope_refills OR scope_new_rx),
	CONSTRAINT "delegations_status_check" CHECK (status IN ('pending_admin','pending_delegate','active','rejected','revoked')),
	CONSTRAINT "delegations_active_requires_signature" CHECK (status <> 'active' OR (delegate_user_id IS NOT NULL AND delegate_signed_at IS NOT NULL)),
	CONSTRAINT "delegations_pending_delegate_requires_user" CHECK (status <> 'pending_delegate' OR delegate_user_id IS NOT NULL)
);

ALTER TABLE "delegations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "providers" ALTER COLUMN "default_shipping_fee" SET DEFAULT 25;
ALTER TABLE "prescriptions" ADD COLUMN "tracking_url" text;
ALTER TABLE "prescriptions" ADD COLUMN "submitted_by_delegation_id" uuid;
ALTER TABLE "pharmacies" ADD COLUMN "notification_emails" text;
ALTER TABLE "pharmacies" ADD COLUMN "shipping_fee_cents" integer DEFAULT 2500 NOT NULL;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_user_id_users_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "delegations_provider_status_idx" ON "delegations" USING btree ("provider_id","status");
CREATE INDEX "delegations_delegate_user_idx" ON "delegations" USING btree ("delegate_user_id");
CREATE UNIQUE INDEX "delegations_one_active_per_pair_idx" ON "delegations" USING btree ("provider_id","delegate_email") WHERE status IN ('pending_admin','pending_delegate','active');
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_submitted_by_delegation_id_delegations_id_fk" FOREIGN KEY ("submitted_by_delegation_id") REFERENCES "public"."delegations"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "payment_transactions" DROP COLUMN "order_group_id";
CREATE POLICY "delegations_select_policy" ON "delegations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        public.is_admin(auth.uid())
        OR "delegations"."delegate_user_id" = auth.uid()
        OR EXISTS (
          SELECT 1 FROM providers p
          WHERE p.id = "delegations"."provider_id" AND p.user_id = auth.uid()
        )
      );
CREATE POLICY "delegations_insert_policy" ON "delegations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "delegations_update_policy" ON "delegations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "delegations_delete_policy" ON "delegations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin(auth.uid()));