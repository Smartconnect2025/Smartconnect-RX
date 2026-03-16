import { createAdminClient } from "@core/database/client";

export interface PatientAuthResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: string;
}

/**
 * Service for managing patient authentication
 */
class PatientAuthService {
  /**
   * Reset password for a patient account
   * @param patientEmail - Email of the patient
   * @returns Promise with success status
   */
  async resetPatientPassword(
    patientEmail: string,
  ): Promise<PatientAuthResponse> {
    try {
      const adminClient = createAdminClient();

      // Send password reset email
      const { error } = await adminClient.auth.resetPasswordForEmail(
        patientEmail,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
        },
      );

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: { message: "Password reset email sent successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send password reset email",
      };
    }
  }

  /**
   * Send welcome email with login instructions to a new patient
   * @param patientEmail - Email of the patient
   * @param patientName - Full name of the patient
   * @returns Promise with success status
   */
  async sendWelcomeEmail(
    patientEmail: string,
    patientName: string,
  ): Promise<PatientAuthResponse> {
    try {
      // For now, just trigger a password reset which will allow them to set their password
      // In a production app, you might want to use a dedicated email service
      const result = await this.resetPatientPassword(patientEmail);

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        success: true,
        data: {
          message: `Welcome email sent to ${patientName} at ${patientEmail}. They can use the password reset link to set up their account.`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send welcome email",
      };
    }
  }

  /**
   * Update patient user metadata
   * @param userId - Patient's user ID
   * @param metadata - Metadata to update
   * @returns Promise with success status
   */
  async updatePatientMetadata(
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<PatientAuthResponse> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: metadata,
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: { message: "Patient metadata updated successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update patient metadata",
      };
    }
  }

  /**
   * Disable a patient account
   * @param userId - Patient's user ID
   * @returns Promise with success status
   */
  async disablePatientAccount(userId: string): Promise<PatientAuthResponse> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "876000h", // Ban for 100 years (effectively permanent)
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: { message: "Patient account disabled successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disable patient account",
      };
    }
  }

  /**
   * Enable a patient account
   * @param userId - Patient's user ID
   * @returns Promise with success status
   */
  async enablePatientAccount(userId: string): Promise<PatientAuthResponse> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: { message: "Patient account enabled successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to enable patient account",
      };
    }
  }
}

export const patientAuthService = new PatientAuthService();
