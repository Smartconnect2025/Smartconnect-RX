# Database Seed Data Documentation

This directory contains comprehensive seed data for development, testing, and demonstration of the
TFA Healthcare platform. The seed data supports realistic testing of order flows, billing
encounters, EMR integration, and provider workflows.

## Current Seed Data

### Providers (3 healthcare providers)

Current providers with available avatar images from `/public/images/avatars/`:

- **Dr. Sarah Johnson** - Family Medicine (Telehealth & In-person)
  - Avatar: DrSara_avatar.jpg
- **Dr. Michael Chen** - Psychiatry (Telehealth only)
  - Avatar: DrDavid_avatar.jpg
- **Dr. Emily Rodriguez** - Dermatology (Telehealth & In-person)
  - Avatar: DrSara_avatar.jpg

Note: The `user_id` field is nullable and can be linked to auth users separately as needed.

### Product Categories (4 categories)

All categories use `PRODUCT_CARD_CONFIG.DEFAULT_IMAGE` for consistent placeholder images:

- **Weight Loss** - Color: #3B82F6
- **Supplements** - Color: #10B981
- **Digestive** - Color: #8B5CF6
- **Heart Health** - Color: #EF4444

### Products (4 products with varied test scenarios)

All products use `PRODUCT_CARD_CONFIG.DEFAULT_IMAGE` for consistent placeholder images:

- **Vitamin D3 5000 IU** - In Stock (150 units), Best Seller, OTC
- **Omega-3 Fish Oil 1000mg** - In Stock (85 units), OTC
- **Advanced Probiotic Complex** - OUT OF STOCK, OTC
- **Magnesium Glycinate 400mg** - In Stock (75 units), PRESCRIPTION REQUIRED

## Running Seeds

### Run All Seeds

```bash
# From project root
npm run db:seed
# or
tsx core/database/seeds/run.ts
```

### Run Individual Seeds

```bash
# Providers only
tsx core/database/seeds/providers.ts

# Products only (includes categories)
tsx core/database/seeds/products.ts

# Symptoms only
tsx core/database/seeds/symptoms.ts
```

## Adding New Seed Data

### Adding New Providers

1. **Update Provider Data File**

   ```typescript
   // core/database/seeds/data/providers.ts
   export const providersData = [
     // ... existing providers
     {
       name: "Dr. New Provider",
       specialty: "Cardiology",
       avatar_url: "/images/avatars/DrSara_avatar.jpg", // Use available avatars
       service_types: ["Telehealth", "In-person"],
       insurance_plans: ["Blue Cross", "Aetna", "United Healthcare"],
       licensed_states: ["CA", "NY", "TX"],
     },
   ];
   ```

2. **Provider Data Structure**

   ```typescript
   interface Provider {
     name: string; // Provider full name
     specialty: string; // Medical specialty
     avatar_url: string; // Use available images from /public/images/avatars/
     service_types: string[]; // ["Telehealth", "In-person"]
     insurance_plans: string[]; // Accepted insurance providers
     licensed_states: string[]; // State codes ["CA", "NY"]
   }
   ```

3. **Important Notes**
   - The `user_id` field is nullable and not set during seeding
   - Auth users can be linked to providers separately as needed
   - Use available avatar images from `/public/images/avatars/`

### Adding New Products

1. **Update Product Data File**

   ```typescript
   // core/database/seeds/data/products.ts
   import { PRODUCT_CARD_CONFIG } from "@/features/product-catalog";

   export const productsData = [
     // ... existing products
     {
       name: "New Product Name",
       slug: "new-product-slug", // Must be unique
       description: "Detailed product description...",
       image_url: PRODUCT_CARD_CONFIG.DEFAULT_IMAGE,
       category_id: 2, // Reference existing category
       subscription_price: 3999, // Price in cents ($39.99)
       subscription_price_discounted: 3199, // Discounted price in cents
       stock_quantity: 100, // Set to 0 for out-of-stock testing
       low_stock_threshold: 15,
       active_ingredient: "Active ingredient details",
       benefits: "Product benefits and effects",
       safety_info: "Safety information and warnings",
       requires_prescription: false, // Set to true for prescription products
       is_active: true,
       is_best_seller: false,
     },
   ];
   ```

2. **Product Field Reference**
   - **Required Fields**: `name`, `slug`, `category_id`, `subscription_price`
   - **Pricing**: Always in cents (e.g., 2999 = $29.99)
   - **Stock Management**: `stock_quantity` (0 = out of stock), `low_stock_threshold`
   - **Prescription**: `requires_prescription` (boolean)
   - **Categories**: Reference existing category IDs (1-4) or add new categories

### Adding New Categories

1. **Update Categories in Product Data File**

   ```typescript
   // core/database/seeds/data/products.ts
   import { PRODUCT_CARD_CONFIG } from "@/features/product-catalog";

   export const categoriesData = [
     // ... existing categories
     {
       id: 5, // Next available ID
       name: "New Category",
       slug: "new-category", // Must be unique
       description: "Category description",
       color: "#6366F1", // Hex color for branding
       image_url: PRODUCT_CARD_CONFIG.DEFAULT_IMAGE,
       display_order: 5, // Display order in UI
       is_active: true,
     },
   ];
   ```

2. **Category Image Handling**
   - All categories use `PRODUCT_CARD_CONFIG.DEFAULT_IMAGE` for consistent placeholder images
   - The image path is managed by the product catalog configuration

## Testing Scenarios

The current seed data supports testing these key scenarios:

### Order Flow Testing

- **Add to Cart**: Vitamin D3, Omega-3, Magnesium (in stock)
- **Out of Stock**: Probiotic Complex (should show out of stock message)
- **Prescription Required**: Magnesium Glycinate (should trigger prescription workflow)
- **Best Seller**: Vitamin D3 (should display best seller badge)

### Provider Booking Testing

- **Multi-specialty**: Family Medicine, Psychiatry, Dermatology
- **Service Types**: Telehealth only (Dr. Chen), Mixed (Dr. Johnson, Dr. Rodriguez)
- **Multi-state**: Various licensed states for geographic testing
- **Languages**: English, Spanish, Mandarin for diversity testing

### EMR Integration Testing

- **Prescription Products**: Magnesium Glycinate for prescription workflows
- **Provider Specialties**: Different specialties for referral testing
- **Practice Types**: Solo, Group, Telehealth practices

## 🔧 Troubleshooting

### Common Issues

1. **Duplicate Key Errors**
   - Seeds use `upsert` with conflict resolution on unique fields
   - Safe to run multiple times - duplicates will be ignored

2. **Foreign Key Errors**
   - Categories are seeded before products automatically
   - Ensure `category_id` references exist in `categoriesData`

3. **Database Connection Issues**
   - Check your `.env.local` file has correct database credentials
   - Verify database is running and accessible

### Resetting Seed Data

To completely reset seed data:

```sql
-- Clear existing data (be careful in production!)
DELETE FROM products;
DELETE FROM categories;
DELETE FROM providers;

-- Reset auto-increment sequences
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE categories_id_seq RESTART WITH 1;
```

## Data Relationships

```
Categories (1:many) → Products
Providers (1:many) → Appointments (future)
Products (many:many) → Orders (via order_items)
Providers (1:many) → Orders (for prescription approval)
```

## Best Practices

1. **Realistic Data**: Use realistic names, descriptions, and medical information
2. **Edge Cases**: Include out-of-stock, prescription, and high-stock scenarios
3. **Diversity**: Include diverse provider backgrounds and specialties
4. **Pricing**: Use realistic pricing in cents for precision
5. **Safety**: Include appropriate safety information for medical products
6. **Images**:
   - Use `PRODUCT_CARD_CONFIG.DEFAULT_IMAGE` for products and categories
   - Use available avatar images from `/public/images/avatars/` for providers
7. **Database Relations**:
   - Keep `user_id` nullable in providers table
   - Handle auth user linking separately from seeding
   - Maintain proper foreign key relationships

## Updating Existing Data

To modify existing seed data:

1. Update the data in the respective data files
2. For products and categories:
   - Run the seed script again - upsert will update existing records
   - Product images will use `PRODUCT_CARD_CONFIG.DEFAULT_IMAGE`
3. For providers:
   - Delete existing provider records if needed
   - Re-run seed script to create new provider records
   - Note that `user_id` will remain null
   - Handle auth user linking separately if needed

## Future Enhancements

Consider adding seed data for:

- Patient records (with anonymized data)
- Appointment schedules
- Order history
- Lab results
- Prescription history
- Insurance plans
- Medical facilities
