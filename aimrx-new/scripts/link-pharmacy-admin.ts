import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function linkPharmacyAdmin() {
  try {
    // Get Greenwich pharmacy ID
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id, name, slug")
      .eq("slug", "grinethch")
      .single();

    if (pharmacyError || !pharmacy) {
      console.error("Error finding Greenwich pharmacy:", pharmacyError);
      return;
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from("pharmacy_admins")
      .select("*")
      .eq("user_id", "0afc1206-84f6-4ece-b462-38e0cc8c9b67")
      .eq("pharmacy_id", pharmacy.id)
      .single();

    if (existingLink) {
      return;
    }

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from("pharmacy_admins")
      .insert({
        user_id: "0afc1206-84f6-4ece-b462-38e0cc8c9b67",
        pharmacy_id: pharmacy.id,
      })
      .select()
      .single();

    if (linkError) {
      console.error("Error creating link:", linkError);
      return;
    }

    // Verify medications for this pharmacy
    const { data: medications, error: medsError } = await supabase
      .from("pharmacy_medications")
      .select("id, name, pharmacy_id")
      .eq("pharmacy_id", pharmacy.id);

    if (medsError) {
      console.error("Error checking medications:", medsError);
      return;
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

linkPharmacyAdmin();
