export const CATEGORY_MAPPING: Record<string, string[]> = {
  "Weight Loss & Metabolism": [
    "Weight Loss",
    "weight Loss",
    "Metabolic",
    "Weight Loss (GLP-1)",
    "Weight Management",
  ],
  "Cognitive & Neuron Health": [
    "Neuroprotective",
    "Cognitive",
    "Neuron Health",
    "Brain Health",
    "ADHD",
  ],
  "Cell & Mitochondrial Health": [
    "Regenerative",
    "Antioxidant",
    "Cell Health",
    "Mitochondrial",
    "Cellular",
  ],
  "Anti-Inflammatory & Healing": [
    "Antiemetic",
    "Antimicrobial",
    "Immune",
    "Immune Health",
    "Anti-Inflammatory",
    "Wound Care",
    "Healing",
  ],
  "Fertility & Reproductive Health": [
    "Sexual Health",
    "Hormonal",
    "Fertility",
    "Reproductive",
  ],
  "Longevity & Anti-Aging": [
    "Anti-Aging",
    "Longevity",
    "Telomere",
  ],
  "Performance & Fitness": [
    "Growth Hormone",
    "Growth Factor",
    "Performance",
    "Fitness",
    "Muscle",
    "Bodybuilding",
  ],
  "Nootropics & Stress Management": [
    "Sleep & Recovery",
    "Sleep Aid",
    "Nootropics",
    "Stress",
    "Mental Clarity",
  ],
  "NAD+ & Biohacking": [
    "Anti-Aging / NAD+",
    "NAD+",
    "NAD",
    "Biohacking",
  ],
  "Peptides": [
    "Peptides",
    "Peptides & Growth Hormone",
  ],
};

export function getMedicationParentCategory(medCategory: string): string {
  if (!medCategory) return "Uncategorized";
  for (const [parentName, subcategories] of Object.entries(CATEGORY_MAPPING)) {
    if (subcategories.some((sub) => sub.toLowerCase() === medCategory.toLowerCase())) {
      return parentName;
    }
  }
  return medCategory;
}

export function getMedicationCategoriesForParent(parentName: string): string[] {
  return CATEGORY_MAPPING[parentName] || [parentName];
}

export function doesMedicationMatchParentCategory(
  medCategory: string | null | undefined,
  parentCategoryName: string,
): boolean {
  const cat = medCategory || "Uncategorized";
  if (cat.toLowerCase() === parentCategoryName.toLowerCase()) return true;
  const subcategories = CATEGORY_MAPPING[parentCategoryName];
  if (!subcategories) return false;
  return subcategories.some((sub) => sub.toLowerCase() === cat.toLowerCase());
}
