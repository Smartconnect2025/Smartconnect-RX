/**
 * Product seed data for development, testing, and demonstration
 *
 * This data supports realistic testing of:
 * - Product catalog browsing and search
 * - Shopping cart functionality
 * - Checkout and order flows
 * - Inventory management (including out-of-stock scenarios)
 * - EMR integration for prescription products
 */

export const productsData = [
  {
    name: "Magnesium Glycinate 400mg (Prescription)",
    slug: "magnesium-glycinate-400mg-prescription",
    description:
      "High-absorption magnesium glycinate supplement for patients with documented magnesium deficiency. This chelated form of magnesium is gentle on the stomach and highly bioavailable. Prescribed for muscle cramps, sleep support, and cardiovascular health in patients with confirmed deficiency.",
    image_url:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop&crop=center",
    category_id: 2, // Supplements category
    subscription_price: 5400, // $54.00 in cents
    subscription_price_discounted: 5000, // $50.00 discounted price in cents
    stock_quantity: 75,
    low_stock_threshold: 20,
    active_ingredient: "Magnesium (as Magnesium Glycinate) 400mg per capsule",
    benefits:
      "Supports muscle function, sleep quality, bone health, and cardiovascular function. May help reduce muscle cramps and support healthy blood pressure levels.",
    safety_info:
      "PRESCRIPTION REQUIRED. Take as directed by your healthcare provider. May cause loose stools in sensitive individuals. Reduce dosage if digestive upset occurs. Do not exceed prescribed dosage. Inform your provider of all medications as magnesium may interact with certain drugs including antibiotics and diuretics.",
    requires_prescription: true,
    is_active: true,
    is_best_seller: false,
    stripe_product_id: "prod_T1rTyqXFPjKSt4",
    stripe_price_ids:
      '{"monthly": "price_1S5nkU1LjKQFJxec1B4yNMMR", "monthly_discounted": "price_1S5nkV1LjKQFJxecp96SMGEM"}',
  },

  {
    name: "Vitamin D3 5000 IU",
    slug: "vitamin-d3-5000-iu",
    description:
      "High-potency vitamin D3 supplement for bone health and immune support. Our Vitamin D3 is sourced from lanolin and provides 5000 IU (125 mcg) of cholecalciferol per softgel. This essential vitamin supports calcium absorption, bone mineralization, and immune system function.",
    image_url:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop&crop=center",
    category_id: 2, // Supplements category
    subscription_price: 2999, // $29.99 in cents
    subscription_price_discounted: 2399, // $23.99 discounted price in cents
    stock_quantity: 150,
    low_stock_threshold: 25,
    active_ingredient: "Cholecalciferol (Vitamin D3) 5000 IU per softgel",
    benefits:
      "Supports bone health, immune function, calcium absorption, muscle strength, and cardiovascular health. May help improve mood and energy levels.",
    safety_info:
      "Take with food to enhance absorption. Consult your healthcare provider before use if you are pregnant, nursing, taking medications, or have a medical condition. Do not exceed recommended dosage as excessive vitamin D can be harmful.",
    requires_prescription: false,
    is_active: true,
    is_best_seller: true,
    stripe_product_id: "prod_T1rTID2bQxMTD9",
    stripe_price_ids:
      '{"monthly": "price_1S5nkV1LjKQFJxecLChP3duH", "monthly_discounted": "price_1S5nkV1LjKQFJxecHr5el7uI"}',
  },

  {
    name: "Omega-3 Fish Oil 1000mg",
    slug: "omega-3-fish-oil-1000mg",
    description:
      "Premium quality omega-3 fish oil supplement providing essential EPA and DHA fatty acids for heart and brain health. Our fish oil is molecularly distilled to remove heavy metals and contaminants, ensuring purity and potency. Each softgel contains 1000mg of fish oil with 300mg EPA and 200mg DHA.",
    image_url:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop&crop=center",
    category_id: 4, // Heart Health category
    subscription_price: 3499, // $34.99 in cents
    subscription_price_discounted: 2799, // $27.99 discounted price in cents
    stock_quantity: 85,
    low_stock_threshold: 20,
    active_ingredient:
      "Fish Oil Concentrate 1000mg (EPA 300mg, DHA 200mg) per softgel",
    benefits:
      "Supports cardiovascular health, brain function, joint health, and may help reduce inflammation. Promotes healthy cholesterol levels and cognitive performance.",
    safety_info:
      "Take with meals to reduce fishy aftertaste. Consult your healthcare provider if you have fish allergies, are taking blood-thinning medications, or are pregnant/nursing. May interact with anticoagulant medications.",
    requires_prescription: false,
    is_active: true,
    is_best_seller: false,
    stripe_product_id: "prod_T1rTTWGKZT5SMI",
    stripe_price_ids:
      '{"monthly": "price_1S5nkU1LjKQFJxecwL413qjo", "monthly_discounted": "price_1S5nkV1LjKQFJxecuihj6nWd"}',
  },
];
