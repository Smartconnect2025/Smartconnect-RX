-- Atomic state transition for delegation approval.
--
-- Locks the delegation row (FOR UPDATE), then re-validates BOTH the
-- delegation status AND the authorizing provider's is_active / user_id /
-- npi_number inside a single transaction. This closes the TOCTOU window
-- between the application-level checks in the approve route and the final
-- status flip — a concurrent provider deactivation, unlink, or NPI removal
-- cannot slip through.
--
-- Returns jsonb { ok: boolean, reason?: text }
--   reason ∈ { not_found | wrong_status | provider_missing |
--              provider_inactive | provider_unlinked | provider_no_npi }
--
-- On success: delegation.status = 'pending_delegate',
--             delegate_user_id  = p_delegate_user_id,
--             admin_user_id     = p_admin_user_id,
--             admin_action_at   = now(),
--             updated_at        = now().
--
-- SECURITY DEFINER so the route's service-role caller (and admin sessions)
-- can execute it consistently regardless of RLS posture.

CREATE OR REPLACE FUNCTION public.approve_delegation_atomic(
  p_delegation_id   uuid,
  p_admin_user_id   uuid,
  p_delegate_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status      text;
  v_provider_id uuid;
  v_is_active   boolean;
  v_user_id     uuid;
  v_npi         text;
BEGIN
  -- 1. Row-lock the delegation
  SELECT d.status, d.provider_id
    INTO v_status, v_provider_id
    FROM public.delegations d
   WHERE d.id = p_delegation_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_status <> 'pending_admin' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_status');
  END IF;

  -- 2. Lock + re-validate the authorizing provider in the same txn
  SELECT p.is_active, p.user_id, p.npi_number
    INTO v_is_active, v_user_id, v_npi
    FROM public.providers p
   WHERE p.id = v_provider_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_missing');
  END IF;

  IF v_is_active IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_inactive');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_unlinked');
  END IF;

  IF v_npi IS NULL OR length(btrim(v_npi)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'provider_no_npi');
  END IF;

  -- 3. Atomic state flip
  UPDATE public.delegations
     SET status            = 'pending_delegate',
         delegate_user_id  = p_delegate_user_id,
         admin_user_id     = p_admin_user_id,
         admin_action_at   = now(),
         updated_at        = now()
   WHERE id = p_delegation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Lock down execute privileges. This function is SECURITY DEFINER and
-- performs no internal authorization, so it must NEVER be exposed to the
-- authenticated role (any logged-in user could otherwise approve any
-- delegation by ID, bypassing the admin-only route policy).
--
-- The approve route invokes this RPC through the service-role client
-- (createAdminClient), which bypasses these grants entirely. Restricting
-- EXECUTE to service_role closes the direct-RPC privilege escalation path
-- while leaving the legitimate route unaffected.
REVOKE ALL ON FUNCTION public.approve_delegation_atomic(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_delegation_atomic(uuid, uuid, uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_delegation_atomic(uuid, uuid, uuid) TO service_role;
