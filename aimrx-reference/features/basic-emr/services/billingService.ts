import { createClient } from "@core/supabase/client";
import {
  BillingGroup,
  BillingDiagnosis,
  BillingProcedure,
  CreateBillingGroupData,
  CreateBillingDiagnosisData,
  CreateBillingProcedureData,
  UpdateBillingGroupData,
  UpdateBillingDiagnosisData,
  UpdateBillingProcedureData,
} from "../types/billing.types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Database row types
type DbBillingGroupRow = {
  id: string;
  encounter_id: string;
  procedure_code: string;
  procedure_description: string;
  modifiers?: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

type DbBillingDiagnosisRow = {
  id: string;
  billing_group_id: string;
  icd_code: string;
  description: string;
  is_primary: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
};

type DbBillingProcedureRow = {
  id: string;
  billing_group_id: string;
  cpt_code: string;
  description: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

class BillingService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  // Billing Groups
  async getBillingGroups(
    encounterId: string,
    _userId: string
  ): Promise<EmrServiceResponse<BillingGroup[]>> {
    try {
      // Verify encounter ownership
      // const hasAccess = await this.verifyEncounterOwnership(
      //   encounterId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return { success: false, error: "Unauthorized access to encounter" };
      // }

      const { data: billingGroups, error } = await this.supabase
        .from("billing_groups")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching billing groups:", error);
        return { success: false, error: "Failed to fetch billing groups" };
      }

      // Fetch diagnoses and procedures for each billing group
      const billingGroupsWithDetails = await Promise.all(
        billingGroups.map(async (group) => {
          const [diagnosesResponse, proceduresResponse] = await Promise.all([
            this.getBillingDiagnoses(group.id, _userId),
            this.getBillingProcedures(group.id, _userId),
          ]);

          return {
            ...this.mapDbBillingGroupToType(group),
            diagnoses: diagnosesResponse.success
              ? diagnosesResponse.data || []
              : [],
            procedures: proceduresResponse.success
              ? proceduresResponse.data || []
              : [],
          };
        })
      );

      return { success: true, data: billingGroupsWithDetails };
    } catch (error) {
      console.error("Error in getBillingGroups:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async createBillingGroup(
    userId: string,
    billingGroupData: CreateBillingGroupData
  ): Promise<EmrServiceResponse<BillingGroup>> {
    try {
      // Verify encounter ownership
      // const hasAccess = await this.verifyEncounterOwnership(
      //   billingGroupData.encounterId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return { success: false, error: "Unauthorized access to encounter" };
      // }

      const { data, error } = await this.supabase
        .from("billing_groups")
        .insert({
          encounter_id: billingGroupData.encounterId,
          procedure_code: billingGroupData.procedureCode,
          procedure_description: billingGroupData.procedureDescription,
          modifiers: billingGroupData.modifiers || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating billing group:", error);
        return { success: false, error: "Failed to create billing group" };
      }

      const billingGroup = this.mapDbBillingGroupToType(data);
      return {
        success: true,
        data: { ...billingGroup, diagnoses: [], procedures: [] },
      };
    } catch (error) {
      console.error("Error in createBillingGroup:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async updateBillingGroup(
    billingGroupId: string,
    userId: string,
    updates: UpdateBillingGroupData
  ): Promise<EmrServiceResponse<BillingGroup>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const updateData: Partial<DbBillingGroupRow> = {};
      if (updates.procedureCode !== undefined)
        updateData.procedure_code = updates.procedureCode;
      if (updates.procedureDescription !== undefined)
        updateData.procedure_description = updates.procedureDescription;
      if (updates.modifiers !== undefined)
        updateData.modifiers = updates.modifiers;

      const { data, error } = await this.supabase
        .from("billing_groups")
        .update(updateData)
        .eq("id", billingGroupId)
        .select()
        .single();

      if (error) {
        console.error("Error updating billing group:", error);
        return { success: false, error: "Failed to update billing group" };
      }

      const billingGroup = this.mapDbBillingGroupToType(data);
      return { success: true, data: billingGroup };
    } catch (error) {
      console.error("Error in updateBillingGroup:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async deleteBillingGroup(
    billingGroupId: string,
    _userId: string
  ): Promise<EmrServiceResponse<void>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const { error } = await this.supabase
        .from("billing_groups")
        .delete()
        .eq("id", billingGroupId);

      if (error) {
        console.error("Error deleting billing group:", error);
        return { success: false, error: "Failed to delete billing group" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error in deleteBillingGroup:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  // Billing Diagnoses
  async getBillingDiagnoses(
    billingGroupId: string,
    _userId: string
  ): Promise<EmrServiceResponse<BillingDiagnosis[]>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const { data, error } = await this.supabase
        .from("billing_diagnoses")
        .select("*")
        .eq("billing_group_id", billingGroupId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching billing diagnoses:", error);
        return { success: false, error: "Failed to fetch billing diagnoses" };
      }

      const diagnoses = data.map(this.mapDbBillingDiagnosisToType);
      return { success: true, data: diagnoses };
    } catch (error) {
      console.error("Error in getBillingDiagnoses:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async createBillingDiagnosis(
    userId: string,
    diagnosisData: CreateBillingDiagnosisData
  ): Promise<EmrServiceResponse<BillingDiagnosis>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   diagnosisData.billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const { data, error } = await this.supabase
        .from("billing_diagnoses")
        .insert({
          billing_group_id: diagnosisData.billingGroupId,
          icd_code: diagnosisData.icdCode,
          description: diagnosisData.description,
          is_primary: diagnosisData.isPrimary || false,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating billing diagnosis:", error);
        return { success: false, error: "Failed to create billing diagnosis" };
      }

      const diagnosis = this.mapDbBillingDiagnosisToType(data);
      return { success: true, data: diagnosis };
    } catch (error) {
      console.error("Error in createBillingDiagnosis:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async updateBillingDiagnosis(
    diagnosisId: string,
    _userId: string,
    updates: UpdateBillingDiagnosisData
  ): Promise<EmrServiceResponse<BillingDiagnosis>> {
    try {
      // Verify diagnosis ownership
      // const hasAccess = await this.verifyBillingDiagnosisOwnership(
      //   diagnosisId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing diagnosis",
      //   };
      // }

      const updateData: Partial<DbBillingDiagnosisRow> = {};
      if (updates.icdCode !== undefined) updateData.icd_code = updates.icdCode;
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.isPrimary !== undefined)
        updateData.is_primary = updates.isPrimary;

      const { data, error } = await this.supabase
        .from("billing_diagnoses")
        .update(updateData)
        .eq("id", diagnosisId)
        .select()
        .single();

      if (error) {
        console.error("Error updating billing diagnosis:", error);
        return { success: false, error: "Failed to update billing diagnosis" };
      }

      const diagnosis = this.mapDbBillingDiagnosisToType(data);
      return { success: true, data: diagnosis };
    } catch (error) {
      console.error("Error in updateBillingDiagnosis:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async deleteBillingDiagnosis(
    diagnosisId: string,
    _userId: string
  ): Promise<EmrServiceResponse<void>> {
    try {
      // Verify diagnosis ownership
      // const hasAccess = await this.verifyBillingDiagnosisOwnership(
      //   diagnosisId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing diagnosis",
      //   };
      // }

      const { error } = await this.supabase
        .from("billing_diagnoses")
        .delete()
        .eq("id", diagnosisId);

      if (error) {
        console.error("Error deleting billing diagnosis:", error);
        return { success: false, error: "Failed to delete billing diagnosis" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error in deleteBillingDiagnosis:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  // Billing Procedures
  async getBillingProcedures(
    billingGroupId: string,
    _userId: string
  ): Promise<EmrServiceResponse<BillingProcedure[]>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const { data, error } = await this.supabase
        .from("billing_procedures")
        .select("*")
        .eq("billing_group_id", billingGroupId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching billing procedures:", error);
        return { success: false, error: "Failed to fetch billing procedures" };
      }

      const procedures = data.map(this.mapDbBillingProcedureToType);
      return { success: true, data: procedures };
    } catch (error) {
      console.error("Error in getBillingProcedures:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async createBillingProcedure(
    userId: string,
    procedureData: CreateBillingProcedureData
  ): Promise<EmrServiceResponse<BillingProcedure>> {
    try {
      // Verify billing group ownership
      // const hasAccess = await this.verifyBillingGroupOwnership(
      //   procedureData.billingGroupId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing group",
      //   };
      // }

      const { data, error } = await this.supabase
        .from("billing_procedures")
        .insert({
          billing_group_id: procedureData.billingGroupId,
          cpt_code: procedureData.cptCode,
          description: procedureData.description,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating billing procedure:", error);
        return { success: false, error: "Failed to create billing procedure" };
      }

      const procedure = this.mapDbBillingProcedureToType(data);
      return { success: true, data: procedure };
    } catch (error) {
      console.error("Error in createBillingProcedure:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async updateBillingProcedure(
    procedureId: string,
    userId: string,
    updates: UpdateBillingProcedureData
  ): Promise<EmrServiceResponse<BillingProcedure>> {
    try {
      // Verify procedure ownership
      // const hasAccess = await this.verifyBillingProcedureOwnership(
      //   procedureId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing procedure",
      //   };
      // }

      const updateData: Partial<DbBillingProcedureRow> = {};
      if (updates.cptCode !== undefined) updateData.cpt_code = updates.cptCode;
      if (updates.description !== undefined)
        updateData.description = updates.description;

      const { data, error } = await this.supabase
        .from("billing_procedures")
        .update(updateData)
        .eq("id", procedureId)
        .select()
        .single();

      if (error) {
        console.error("Error updating billing procedure:", error);
        return { success: false, error: "Failed to update billing procedure" };
      }

      const procedure = this.mapDbBillingProcedureToType(data);
      return { success: true, data: procedure };
    } catch (error) {
      console.error("Error in updateBillingProcedure:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  async deleteBillingProcedure(
    procedureId: string,
    // userId: string
  ): Promise<EmrServiceResponse<void>> {
    try {
      // Verify procedure ownership
      // const hasAccess = await this.verifyBillingProcedureOwnership(
      //   procedureId,
      //   userId
      // );
      // if (!hasAccess) {
      //   return {
      //     success: false,
      //     error: "Unauthorized access to billing procedure",
      //   };
      // }

      const { error } = await this.supabase
        .from("billing_procedures")
        .delete()
        .eq("id", procedureId);

      if (error) {
        console.error("Error deleting billing procedure:", error);
        return { success: false, error: "Failed to delete billing procedure" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error in deleteBillingProcedure:", error);
      return { success: false, error: "Internal server error" };
    }
  }

  // Helper methods
  private mapDbBillingGroupToType(
    dbBillingGroup: DbBillingGroupRow
  ): BillingGroup {
    return {
      id: dbBillingGroup.id,
      encounterId: dbBillingGroup.encounter_id,
      procedureCode: dbBillingGroup.procedure_code,
      procedureDescription: dbBillingGroup.procedure_description,
      modifiers: dbBillingGroup.modifiers,
      diagnoses: [],
      procedures: [],
      createdAt: dbBillingGroup.created_at,
      updatedAt: dbBillingGroup.updated_at,
    };
  }

  private mapDbBillingDiagnosisToType(
    dbDiagnosis: DbBillingDiagnosisRow
  ): BillingDiagnosis {
    return {
      id: dbDiagnosis.id,
      billingGroupId: dbDiagnosis.billing_group_id,
      icdCode: dbDiagnosis.icd_code,
      description: dbDiagnosis.description,
      isPrimary: dbDiagnosis.is_primary,
      createdAt: dbDiagnosis.created_at,
      updatedAt: dbDiagnosis.updated_at,
    };
  }

  private mapDbBillingProcedureToType(
    dbProcedure: DbBillingProcedureRow
  ): BillingProcedure {
    return {
      id: dbProcedure.id,
      billingGroupId: dbProcedure.billing_group_id,
      cptCode: dbProcedure.cpt_code,
      description: dbProcedure.description,
      createdAt: dbProcedure.created_at,
      updatedAt: dbProcedure.updated_at,
    };
  }

  // Ownership verification methods
  // private async verifyEncounterOwnership(
  //   encounterId: string,
  //   userId: string
  // ): Promise<boolean> {
  //   try {
  //     const { data, error } = await this.supabase
  //       .from("encounters")
  //       .select("patient_id")
  //       .eq("id", encounterId)
  //       .single();

  //     if (error || !data) {
  //       return false;
  //     }

  //     // Check if user owns the patient
  //     const { data: patientData, error: patientError } = await this.supabase
  //       .from("patients")
  //       .select("id")
  //       .eq("id", data.patient_id)
  //       .eq("user_id", userId)
  //       .single();

  //     return !patientError && !!patientData;
  //   } catch (error) {
  //     console.error("Error verifying encounter ownership:", error);
  //     return false;
  //   }
  // }

  // private async verifyBillingGroupOwnership(
  //   billingGroupId: string,
  //   userId: string
  // ): Promise<boolean> {
  //   try {
  //     const { data, error } = await this.supabase
  //       .from("billing_groups")
  //       .select("encounter_id")
  //       .eq("id", billingGroupId)
  //       .single();

  //     if (error || !data) {
  //       return false;
  //     }

  //     return await this.verifyEncounterOwnership(data.encounter_id, userId);
  //   } catch (error) {
  //     console.error("Error verifying billing group ownership:", error);
  //     return false;
  //   }
  // }

  // private async verifyBillingDiagnosisOwnership(
  //   diagnosisId: string,
  //   userId: string
  // ): Promise<boolean> {
  //   try {
  //     const { data, error } = await this.supabase
  //       .from("billing_diagnoses")
  //       .select("billing_group_id")
  //       .eq("id", diagnosisId)
  //       .single();

  //     if (error || !data) {
  //       return false;
  //     }

  //     return await this.verifyBillingGroupOwnership(
  //       data.billing_group_id,
  //       userId
  //     );
  //   } catch (error) {
  //     console.error("Error verifying billing diagnosis ownership:", error);
  //     return false;
  //   }
  // }

  // private async verifyBillingProcedureOwnership(
  //   procedureId: string,
  //   userId: string
  // ): Promise<boolean> {
  //   try {
  //     const { data, error } = await this.supabase
  //       .from("billing_procedures")
  //       .select("billing_group_id")
  //       .eq("id", procedureId)
  //       .single();

  //     if (error || !data) {
  //       return false;
  //     }

  //     return await this.verifyBillingGroupOwnership(
  //       data.billing_group_id,
  //       userId
  //     );
  //   } catch (error) {
  //     console.error("Error verifying billing procedure ownership:", error);
  //     return false;
  //   }
  // }
}

export const billingService = new BillingService();
