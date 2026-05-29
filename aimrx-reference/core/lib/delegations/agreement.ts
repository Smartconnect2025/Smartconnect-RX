import { createHash } from "crypto";

export const CURRENT_AGREEMENT_VERSION = 1;

/**
 * Returns the canonical legal text the provider sees when authorizing an
 * assistant, and the assistant sees when acknowledging on first login.
 *
 * Bump CURRENT_AGREEMENT_VERSION whenever this text changes. Past delegations
 * keep their snapshot — they remain bound to the version they were signed under.
 */
export function buildAgreementText(params: {
  providerName: string;
  providerNpi: string;
  delegateName: string;
  delegateTitle: string;
  scopeRefills: boolean;
  scopeNewRx: boolean;
}): string {
  const scope: string[] = [];
  if (params.scopeRefills) scope.push("submit prescription refills");
  if (params.scopeNewRx) scope.push("submit new prescriptions");
  const scopeText = scope.join(" and ");

  return `PROVIDER ASSISTANCE AUTHORIZATION (v${CURRENT_AGREEMENT_VERSION})

I, ${params.providerName} (NPI ${params.providerNpi}), hereby authorize
${params.delegateName} (${params.delegateTitle}) to ${scopeText}
on my behalf through the AimRx platform.

I understand and agree that:

1. Every prescription submitted by ${params.delegateName} under this
   authorization will be transmitted to the dispensing pharmacy under
   MY name and MY NPI (${params.providerNpi}). I am the legal prescriber
   on every such order.

2. I remain personally and legally responsible for every prescription
   submitted under this authorization, the same as if I had submitted
   it myself.

3. ${params.delegateName} will NOT have or use her own NPI. She acts
   solely as my agent for the purpose of submitting prescriptions.

4. AimRx will record ${params.delegateName}'s name, the time, and the
   IP address on every prescription she submits, alongside my name as
   prescriber, for audit purposes.

5. I may revoke this authorization at any time, with no notice required,
   from the Provider Assistance section of my AimRx profile.

6. Submission of this authorization requires administrator review and
   approval before ${params.delegateName} can begin acting on my behalf.`;
}

export function hashAgreement(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
