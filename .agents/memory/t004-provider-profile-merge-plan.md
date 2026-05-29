---
name: T004 provider-profile UI merge plan
description: How to merge AimRx ACH/Assistance/NPI features into SmartConnect provider-profile without losing customizations
---
# Provider-profile merge (AimRx -> SmartConnect aimrx-new)
NEW files (copy directly): features/provider-profile/components/profile/AchSection.tsx, features/provider-profile/components/ProviderAssistanceTab.tsx

Safe to copy WHOLE upstream version (no SmartConnect custom): 
- components/profile/MedicalLicenseSection.tsx (adds NPI verify UI)
- components/professional-info/NPISection.tsx (adds NPI verify UI)
- services/provider-profile-service.ts (adds updateAchInfo calling /api/provider/ach)

HAND-MERGE (preserve SmartConnect custom):
- components/forms/ProfileForm.tsx: take AimRx imports+state (AchSection import; npiStatus/verifyNpiForSubmit; tier fetch; Delegate-View read-only banner + disable submit when isDelegateView). PRESERVE SmartConnect data-testid attrs and custom Physical/Billing Address grid. Place <AchSection/> at end of form.
- components/ProviderTabsNavigation.tsx: insert "Provider Assistance" tab into PROVIDER_TABS array; hide when userRole==delegate.
- hooks/use-provider-profile.ts: add updateAchInfo call inside the profile save mutation.
- components/profile/ContactInfoSection.tsx: AimRx REMOVED defaultShippingFee field. SmartConnect may rely on provider-set shipping fee (protected custom: shipping-options). DECISION: keep SmartConnect's defaultShippingFee unless confirmed global. Lean to PRESERVE.
- components/profile/PersonalInfoSection.tsx, components/profile/types.ts, components/forms/ProfessionalInfoForm.tsx, index.ts: small diffs, merge additively.

Wiring: ProviderAssistanceTab needs route app/(features)/provider/provider-assistance/page.tsx rendering it. ProfileForm passes npiStatus/onNpiStatusChange to MedicalLicenseSection.
