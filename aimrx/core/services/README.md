# Core Services

This directory contains core service modules that provide reusable functionality across the
application.

## Image Upload Service

The `imageUploadService.ts` provides functionality for uploading images to Supabase Storage with
proper validation and error handling.

### Features

- **File Validation**: Validates file type and size before upload
- **Supabase Storage Integration**: Uploads images to designated Supabase Storage buckets
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **URL Management**: Generates public URLs and extracts file paths from URLs
- **Cleanup**: Provides functionality to delete images from storage

### Usage

```typescript
import { uploadImage, deleteImage, isSupabaseStorageUrl } from "@/core/services/imageUploadService";

// Upload an image
const result = await uploadImage(file, {
  bucket: "products",
  folder: "images",
});

if (result.success) {
  console.log("Image uploaded:", result.url);
} else {
  console.error("Upload failed:", result.error);
}

// Delete an image
const deleteResult = await deleteImage(imageUrl, "products");

// Check if URL is from Supabase Storage
const isStorageUrl = isSupabaseStorageUrl(url);
```

### Configuration

The service supports the following options:

- `bucket`: Supabase Storage bucket name (default: 'products')
- `folder`: Subfolder within the bucket (default: 'images')
- `fileName`: Custom filename (default: auto-generated)
- `maxSizeBytes`: Maximum file size in bytes (default: 5MB)
- `allowedTypes`: Allowed MIME types (default: image/jpeg, image/jpg, image/png, image/webp)

### Storage Buckets

The application uses the following Supabase Storage buckets:

- `products`: For product images
- `resources`: For resource files (PDFs, covers, etc.)

### Database Migration

Run the migration `20250131000004_add_products_storage_bucket.sql` to create the products storage
bucket with proper policies for authenticated users and admin access.
