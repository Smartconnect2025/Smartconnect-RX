# AIM Rx — Product Catalog & Prescription Creation Wizard Specification

> Comprehensive specification covering the Provider Product Catalog page and the 4-step Prescription Creation Wizard (single-order and multi-order/cart flows).

---

## Table of Contents

1. [Product Catalog Page](#1-product-catalog-page)
2. [Prescription Wizard — Overview](#2-prescription-wizard--overview)
3. [Step 1 — Select Patient](#3-step-1--select-patient)
4. [Step 2 — Prescription Details (Medication + Cart)](#4-step-2--prescription-details-medication--cart)
5. [Step 3 — Review & Create](#5-step-3--review--create)
6. [Step 4 — Collect Payment](#6-step-4--collect-payment)
7. [Session Storage & Cart System](#7-session-storage--cart-system)
8. [Category Mapping System](#8-category-mapping-system)
9. [Data Model — PharmacyMedication Interface](#9-data-model--pharmacymedication-interface)
10. [API Endpoints Used](#10-api-endpoints-used)
11. [Colors, Sizes & Design Tokens](#11-colors-sizes--design-tokens)
12. [Flow Diagrams](#12-flow-diagrams)

---

## 1. Product Catalog Page

**File:** `app/(features)/provider/catalog/page.tsx` (1147 lines)  
**Route:** `/provider/catalog`  
**Purpose:** Browse all pharmacy medications, compare pricing, filter by category/pharmacy, and initiate prescriptions directly.

### 1.1 Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  HERO BANNER (blue gradient)                             │
│  ┌─────────────────────────┐  ┌───────────┬───────────┐  │
│  │ 🛍️ Product Catalog      │  │ {count}   │ {inStock} │  │
│  │ Browse products...       │  │ Products  │ In Stock  │  │
│  │ [⭐ X% Tier Discount]   │  │ Available │           │  │
│  └─────────────────────────┘  └───────────┴───────────┘  │
├──────────────────────────────────────────────────────────┤
│  SEARCH & FILTER BAR (white card, -mt-6 overlapping)     │
│  [🔍 Search...              ] [Filters] [Sort ▼] [⊞|☰]  │
│  ┌─ Expandable Filter Panel ──────────────────────────┐  │
│  │ Pharmacy: [All] [PharmA] [PharmB]                  │  │
│  │ Active: [Category ✕] [Pharmacy ✕] [Clear all]     │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  CATEGORY CAROUSEL (shown when category="all", no search)│
│  [◀] [ Card ][ Card ][ Card ][ Card ][ Card ] [▶]       │
├──────────────────────────────────────────────────────────┤
│  BREADCRUMB (shown when category selected)               │
│  All Categories > {Selected} ({count} products)          │
├──────────────────────────────────────────────────────────┤
│  PRODUCT GRID or LIST                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │  Card    │ │  Card    │ │  Card    │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
├──────────────────────────────────────────────────────────┤
│  FOOTER: "Showing X of Y products • Z% tier discount"   │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Hero Banner

- **Background:** `bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#3B82F6]`
- **Decorative circles:** 3 semi-transparent white circles at corners/center (`opacity-10`)
- **Left side:** ShoppingBag icon (white, `h-7 w-7`) in `bg-white/20 backdrop-blur-sm rounded-xl` + title `text-3xl sm:text-4xl font-bold text-white` + subtitle `text-blue-100`
- **Tier discount badge:** (conditional) `bg-emerald-500/90 backdrop-blur-sm rounded-full` with Star icon (yellow, filled) + `{discount}% Tier Discount Applied`
- **Right side (desktop):** Two stat columns — total products (white) and in-stock count (emerald-300), separated by `w-px h-12 bg-white/20` divider

### 1.3 Search & Filter Bar

- **Container:** `bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-5`, positioned with `-mt-6 relative z-10`
- **Search input:** `pl-11 h-12 text-base rounded-xl` with Search icon left, X clear button right
- **Filter button:** `h-12 px-4 rounded-xl`, active state `bg-blue-50 border-blue-300 text-blue-700`, shows count badge `bg-blue-600 text-white rounded-full w-5 h-5`
- **Sort select:** `h-12 rounded-xl`, options: `A-Z`, `Price: Low to High`, `Price: High to Low`
- **View toggle (desktop only):** Grid3X3 / List icons in `rounded-xl overflow-hidden` container; active state `bg-blue-50 text-blue-700`

**Expandable Filter Panel** (animated `slide-in-from-top-2 duration-200`):
- **Pharmacy filter:** Pill buttons `px-4 py-2 rounded-full`, active uses pharmacy's `primary_color` as background
- **Active filter chips:** Category chip `bg-blue-50 text-blue-700`, pharmacy chip `bg-purple-50 text-purple-700`, each with X dismiss icon
- **Clear all:** underline link

### 1.4 Category Carousel

**Component:** `CategoryCarousel` (separate internal component)

- **Shown when:** `selectedCategory === "all" && !searchQuery`
- **Heading:** "Browse by Category" with left/right scroll buttons (`ChevronLeft`/`ChevronRight` in `rounded-full bg-white border shadow-sm`)
- **Container:** `flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2` with hidden scrollbar
- **Auto-scroll:** Every 3 seconds scrolls right by 220px, wraps to beginning; pauses on hover/touch
- **Cards:** Fixed `width: 200px`, `rounded-2xl`, each with:
  - Top: Category image (`h-32 object-cover` with `bg-gradient-to-t from-black/70` overlay) or gradient fallback
  - Bottom: Gradient bar with icon + name + count
  - Hover: `scale-[1.02] shadow-lg`; Active press: `scale-[0.98]`
- **Image resolution:** First checks `dbCategoryImages` (from `/api/admin/categories`), then falls back to `CATEGORY_IMAGES` static map (maps to `/catalog/category-*.png` files)

### 1.5 Product Cards — Grid View

Each card: `bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col`

```
┌─────────────────────────────┐
│ [In Stock ✓]    [$XX.XX]    │ ← Badges on image
│        IMAGE (h-40)         │
│    or gradient placeholder  │
│  ───────────gradient────    │
├─────────────────────────────┤
│ Medication Name             │
│ strength • form • vial_size │
│                             │
│ [Category Badge] [Pharmacy] │
│                             │
│ ── Expanded Details ──      │ ← Conditional
│ NDC: XXX  Prep: X days      │
│ [Active Ingredients panel]  │
│ [Dosage Instructions]       │
│                             │
│ [👁 Details ▼] [Prescribe →]│
└─────────────────────────────┘
```

**Image area (h-40):**
- Real image: `object-cover group-hover:scale-105 transition-transform duration-500`
- Placeholder: Gradient from `FORM_PLACEHOLDER_COLORS` + large category icon (white, `opacity-40`)
- Price badge (top-right): `bg-white/95 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm`
- Stock badge (top-left): In stock `bg-green-500`, out of stock `bg-red-500`, both `text-white rounded-full`
- Bottom gradient: `bg-gradient-to-t from-black/50 to-transparent h-16`

**Content area:**
- Name: `font-bold text-base leading-snug group-hover:text-[#1E3A8A] truncate`
- Subtitle: `text-sm text-gray-500` — strength • form • vial_size
- Category badge: Uses `PARENT_CATEGORY_BG` colors (e.g., `bg-emerald-50 border-emerald-200 text-emerald-700`) `rounded-full text-xs font-semibold`
- Pharmacy badge: `rounded-full text-xs font-semibold text-white` with `backgroundColor: pharmacy.primary_color`

**Expanded details** (toggled by Details button, animated `slide-in-from-top-2 duration-200`):
- NDC row, Prep Time row (with Clock icon)
- `MedicationDescription` component (see §1.7)
- Dosage Instructions: `bg-blue-50 rounded-xl p-3 border border-blue-100`

**Action buttons:**
- Details toggle: `bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 flex-1`
- Prescribe: `border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white rounded-xl flex-1`, disabled when out of stock

### 1.6 Product Rows — List View

Each row: `bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md`

```
┌──────────────────────────────────────────────────────────┐
│ [IMG] Name [In Stock]  strength • form    $XX.XX [▼][Rx] │
│       [Category] [Pharmacy]                              │
│ ── Expanded: NDC, Description, Dosage Instructions ──    │
└──────────────────────────────────────────────────────────┘
```

- Left: Image `w-14 h-14 rounded-xl` or placeholder with pharmacy-colored gradient
- Prescribe button: `bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 rounded-xl`
- Expanded area: 3-column grid on `lg` breakpoint

### 1.7 MedicationDescription Component

**Purpose:** Parses medication `detailed_description` text, splitting out "Active Ingredients" into a styled panel.

**Logic:**
1. Split text by `\n`
2. Find line matching `/^active ingredients/i`
3. If found, extract bullet items (pattern: `^[•\-·\*\d+\.]\s*`), parse into name/dosage pairs split by `[—\-:]\s`
4. Remaining text becomes general description

**Rendering:**
- **Active Ingredients panel:** `bg-emerald-50 rounded-xl p-3 border border-emerald-100`
  - Header: FlaskConical icon + `text-xs font-semibold text-emerald-800`
  - Each ingredient: `bg-white/60 rounded-lg px-2.5 py-1.5`, name in `text-emerald-900 font-medium`, dosage in `text-emerald-600 text-xs font-mono bg-emerald-100/80 rounded`
- **Description panel:** `bg-gray-50 rounded-xl p-3 border border-gray-100`

### 1.8 Prescribe Action (Catalog → Wizard)

When "Prescribe" is clicked, `handlePrescribe()`:
1. Builds `prescriptionData` object from the medication (name, strength, form, vial_size, dosage_instructions, pharmacy info, price from `aimrx_site_pricing_cents / 100`)
2. Saves to `sessionStorage.setItem("prescriptionFormData", JSON.stringify(prescriptionData))`
3. Navigates to `/prescriptions/new/step1`

Step1 detects `prescriptionFormData` exists and passes `preserveCatalogSelection: true` to `clearPrescriptionSession()`, so the catalog selection survives the cleanup.

### 1.9 Data Loading

- **Medications:** `GET /api/provider/pharmacy` → `{ success, medications[], tierDiscount }`
- **Category images:** `GET /api/admin/categories` → `{ categories[{ name, image_url }] }` (caught if fails)
- **State:** `selectedCategory` synced to URL query param `?category=X` via `useSearchParams` + `router.push`

### 1.10 Form Placeholder Colors (by medication form)

| Form       | Gradient                      |
|------------|-------------------------------|
| Injection  | `from-sky-400 to-blue-500`    |
| Tablet     | `from-green-400 to-emerald-500` |
| Capsule    | `from-amber-400 to-orange-500` |
| Cream      | `from-pink-400 to-rose-500`   |
| Liquid     | `from-cyan-400 to-teal-500`   |
| Spray      | `from-violet-400 to-purple-500` |

---

## 2. Prescription Wizard — Overview

**Route prefix:** `/prescriptions/new/step{1-4}`  
**Flow:** Step 1 → Step 2 → Step 3 → Step 4  
**Supports:** Single-order (1 medication) AND multi-order (cart with N medications)

### 2.1 Progress Indicator (all steps)

Horizontal stepper with numbered circles and connecting lines:

| Step | Circle Active            | Circle Complete         | Circle Pending          |
|------|--------------------------|-------------------------|-------------------------|
| 1    | `bg-primary text-primary-foreground` | `bg-green-500 text-white ✓` | `bg-gray-200 text-gray-500` |
| 2    | same                     | same                    | same                    |
| 3    | same                     | same                    | same                    |
| 4    | `bg-blue-600 text-white` | same                    | same                    |

Connecting lines: `w-12 h-0.5`, complete `bg-green-500` / active `bg-primary` or `bg-blue-500` / pending `bg-gray-300`

---

## 3. Step 1 — Select Patient

**File:** `app/(features)/prescriptions/new/step1/page.tsx` (424 lines)  
**Route:** `/prescriptions/new/step1`  
**Query params:** `?encounterId=&appointmentId=&patientId=` (optional, from encounter flow)

### 3.1 Encounter Pre-selection

If all 3 query params present (`patientId`, `encounterId`, `appointmentId`):
- Stores `encounterId` and `appointmentId` in sessionStorage
- Immediately redirects to Step 2: `/prescriptions/new/step2?patientId={id}`
- Skips patient selection entirely

### 3.2 Session Cleanup on Mount

```typescript
clearPrescriptionSession({
  preserveEncounterContext: !!(preselectedPatientId && encounterId),
  preserveCatalogSelection: !!sessionStorage.getItem("prescriptionFormData"),
});
```

### 3.3 Patient Table

- **Source:** `useEmrStore` (Zustand store) → `fetchPatients(userId, searchQuery, page, ITEMS_PER_PAGE)`
- **Real-time:** Supabase channel `patients-changes` → auto-refreshes on any change
- **Columns:** Name | Date of Birth | Email | Phone | Actions
- **Header style:** `bg-gray-50`, column headers `text-[#1E3A8A] font-bold`
- **Row striping:** Even rows `bg-white`, odd rows `bg-gray-50`
- **Select button:** `variant="outline"` normally, `variant="default"` when selected; shows "Selected" with ArrowRight icon

### 3.4 Selected Patient Card

Appears below the table when a patient is clicked:

```
┌──────────────────────────────────────────────────────────┐
│ [Blue Card] 👤 Selected Patient                          │
│ {First} {Last}                                    [Change]│
│ {DOB} • {email}                                          │
├──────────────────────────────────────────────────────────┤
│ Prescription Document (optional)                         │
│ [PrescriptionPdfUpload component]                        │
├──────────────────────────────────────────────────────────┤
│                    [Continue to Prescription Details →]   │
└──────────────────────────────────────────────────────────┘
```

- Card: `p-4 bg-blue-50 rounded-lg border border-blue-200`
- Icon: `p-3 bg-blue-100 rounded-full` with User icon
- PDF upload is optional; if provided, stored as dataURL in `sessionStorage("prescriptionPdfData")` + filename in `prescriptionPdfName`
- Continue button: `size="lg"` default variant

### 3.5 Navigation

- **Cancel:** → `/prescriptions`
- **Continue:** → `/prescriptions/new/step2?patientId={id}`
- **Add New Patient:** → `/basic-emr/patients/new`

---

## 4. Step 2 — Prescription Details (Medication + Cart)

**File:** `app/(features)/prescriptions/new/step2/page.tsx` (1700 lines)  
**Route:** `/prescriptions/new/step2?patientId={id}`

### 4.1 Page Header

Displays pharmacy context:
- **Pharmacy admin:** Colored pill badge with pharmacy name
- **Doctor with selection:** Colored pill badge `→ {PharmacyName}`
- **Doctor without selection:** Gray pill `Select medication to choose pharmacy`
- Below title: `✓ Prescription will be sent to {PharmacyName}` in pharmacy color

### 4.2 Form Cards Layout

Three white cards with `border-l-4 border-l-[#1E3A8A]` + `rounded-[4px] shadow-sm`:

```
┌─ Card 1: Medication Information ─────────────────────────┐
│ [Pharmacy Selector] (doctors only, when >1 pharmacy)     │
│ [Medication Search/Dropdown]                             │
│ [Vial Size]                                              │
│ [Selected Medication Info Card] (blue, after selection)   │
│ [Dosage Amount] [Dosage Unit]                            │
│ [Form]                                                   │
│ [Quantity] [Refills]                                     │
│ [Refill Frequency] (shown when refills > 0)              │
└──────────────────────────────────────────────────────────┘

┌─ Card 2: Directions / Sig ───────────────────────────────┐
│ [SIG textarea]                                           │
│ [☐ Dispense as Written (DAW)]                            │
│ [Notes to Pharmacy textarea]                             │
└──────────────────────────────────────────────────────────┘

┌─ Card 3: Price of Medication ────────────────────────────┐
│ [$ Price of Medication]                                  │
│ ─── Shipping and Handling ───                            │
│ [$ Shipping Fee]                                         │
│ ─── Oversight & Monitoring Fees ───                      │
│ [+ Add Fee]                                              │
│ { Fee rows: [$Amount] [Reason dropdown] [Remove] }       │
└──────────────────────────────────────────────────────────┘

┌─ Cart Panel (green border, shown when cart.length > 0) ──┐
│ 🛒 Prescription Cart (N items)                           │
│ {item} [pharmacy badge] strength·form·qty·sig    $XX [🗑]│
│ ─── Subtotals ───                                        │
│ Medications: $XX.XX                                      │
│ Shipping: $XX.XX                                         │
│ Oversight: $XX.XX                                        │
│ Grand Total: $XX.XX                                      │
│                                                          │
│ [+ Add Another Medication] [Review {N} Prescriptions →]  │
└──────────────────────────────────────────────────────────┘

(when cart is empty, bottom buttons are different)
[← Back]    [+ Add to Cart]  [Add & Continue →]
```

### 4.3 Medication Dropdown (Two-Level Navigation)

The dropdown appears below the medication search input:

**State machine:** `viewMode: "categories" | "medications"`

**When medication input is empty (category view):**
```
┌─ Medication Catalog ─────────────────────────────────────┐
│ [Sticky header: "Browse by Category"]                    │
│ ┌─ Weight Loss (5) ──────────────────── [→] ─┐          │
│ ├─ Cognitive & Neuron Health (3) ───── [→] ─┤          │
│ ├─ Peptides (8) ──────────────────── [→] ─┤          │
│ └────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**When a category is selected (medication view):**
```
┌─ [← Back to Categories] ────────────────────────────────┐
│ Weight Loss (5 medications)                              │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Semaglutide  [Pharmacy Badge]          [ℹ expand]  │   │
│ │ 2.5mg · Injection · $XXX.XX                        │   │
│ │ ── Expanded info panel ──                          │   │
│ │ {description, dosage_instructions}                 │   │
│ │              [Select This Medication (blue btn)]   │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**When user types in the input (direct search):**
```
┌─ Search Results for "{query}" ───────────────────────────┐
│ Showing medications that start with your search          │
│ {filtered medication cards}                              │
└──────────────────────────────────────────────────────────┘
```

- Each medication card: `border-l-4` with pharmacy's `primary_color`, `rounded-[4px]` card
- Select button: `bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 w-full h-12`
- Info panel toggle: Info icon (blue), expands description + dosage
- Dropdown max height: `max-h-[600px] overflow-y-auto`

### 4.4 Selected Medication Info Card

After selecting a medication, appears as persistent blue card:
- `bg-blue-50 border-2 border-blue-200 rounded-lg p-4`
- Grid: Medication Name, Category, Strength, Form, Vial Size, Pharmacy
- "Change Medication" link: `text-xs text-blue-600 hover:text-blue-800`
- Description and Dosage Instructions sections with `border-t border-blue-200`

### 4.5 Form Fields

| Field | Type | Input | Validation |
|-------|------|-------|------------|
| Medication | Text/Dropdown | `h-[50px]` | Required |
| Vial Size | Text | `h-[50px]` | Optional |
| Dosage Amount | Number (min=0) | `h-[50px]` | Required, >0 |
| Dosage Unit | Select | `h-[50px]` | Required. Options: mg, mL, mcg, g, units, % |
| Form | Select | `h-[50px]` | Required. Options: Tablet, Capsule, Liquid, Cream, Ointment, Gel, Patch, Injection, Inhaler, Drops, Spray, Suppository |
| Quantity | Number (min=1) | `h-[50px]` | Required, >0 |
| Refills | Number (0-12) | `h-[50px]` | Optional (default 0) |
| Refill Frequency (days) | Number (min=1) | `h-[50px]` | Required when refills > 0 (default 30) |
| SIG | Textarea (3 rows) | standard | Required |
| DAW | Checkbox | standard | Default: false |
| Pharmacy Notes | Textarea (3 rows) | `bg-[#F8FAFC] border-[#1E3A8A] rounded-[4px]` | Optional |
| Patient Price | Number (min=0) | `h-[50px] pl-7` ($) | Optional |
| Shipping Fee | Number (min=0) | `h-[50px] pl-7` ($) | Optional (auto-loaded from provider default) |

### 4.6 Oversight Fee Rows

- **Add button:** `+ Add Fee` outline button
- **Empty state:** Italic text "No oversight fees added..."
- **Each row:** `p-4 bg-gray-50 rounded-lg` with 3-column grid:
  - Fee Amount: `$` input, `h-[50px] pl-7`
  - Reason: `<select>` with 5 options:
    - `dose_titration` — Dose Titration & Adjustment
    - `side_effect_monitoring` — Side Effect & Safety Monitoring
    - `therapeutic_response` — Therapeutic Response Review
    - `adherence_tracking` — Medication Adherence Tracking
    - `contraindication_screening` — Contraindication Screening
  - Remove: `text-red-600 hover:bg-red-50 h-[50px]`

### 4.7 Cart Panel

- **Border:** `border-l-4 border-l-green-600` (green, distinct from form cards' blue)
- **Title:** `text-green-800` with ShoppingCart icon, count and pluralization
- **Each item row:** Flex, medication name + pharmacy color badge (`rounded-full text-white text-xs`) + details line + price + trash icon (`text-red-500 hover:text-red-700`)
- **Subtotals:** Medications, shipping (if >0), oversight (if >0)
- **Grand Total:** `text-lg font-bold text-green-800`
- **Buttons:**
  - `+ Add Another Medication`: `variant="outline" border-green-300 text-green-700 hover:bg-green-50`
  - `Review {N} Prescriptions →`: `bg-blue-600 hover:bg-blue-700 text-white font-bold`

### 4.8 Bottom Actions (when cart is empty)

- `← Back` (outline) → saves form to session, goes to Step 1
- `+ Add to Cart` (outline, `border-green-600 text-green-700`) — validates form, adds to cart, resets form
- `Add & Continue →` (default) — validates, adds to cart, navigates to Step 3

### 4.9 Single-Order vs Multi-Order Differences (Step 2)

| Aspect | Single Order | Multi-Order (Cart) |
|--------|-------------|-------------------|
| Cart panel | Hidden (cart.length=0) | Visible with items |
| Bottom buttons | "Add to Cart" + "Add & Continue" | "Add Another" + "Review N Prescriptions" |
| Shipping/oversight | Entered once | Shared across all items (saved to cart storage) |
| Session data | `prescriptionFormData` only | `prescriptionCart` + `cartShippingFee` + `cartOversightFees` |
| Form after add | Resets for next item | Resets for next item |

---

## 5. Step 3 — Review & Create

**File:** `app/(features)/prescriptions/new/step3/page.tsx` (794 lines)  
**Route:** `/prescriptions/new/step3?patientId={id}`

### 5.1 Guard Checks

- If no `patientId` → "No patient selected" + link to Step 1
- If `patientLoadError` → "Failed to load patient" + link to Step 2
- If `cartItems.length === 0` → redirect to Step 2
- Loading state: Spinner

### 5.2 Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ New Prescription — Step 3 of 4: Review & Create          │
│ [Progress: ✓ — ✓ — 3 — ○]                    [Cancel]   │
├──────────────────────────────────────────────────────────┤
│ ✅ Review Prescriptions          🛒 N medication(s)      │
│ ─────────────────────────────────────────────────────────│
│ PATIENT INFORMATION                                      │
│ ┌─ bg-gray-50 ──────────────────────────────────────────┐│
│ │ Name: {First Last}    DOB: {date}                     ││
│ │ Email: {email}        Phone: {phone}                  ││
│ │ Address: 📍 {street, city, state, zip}                ││
│ │ [Override Address for This Prescription]              ││
│ └───────────────────────────────────────────────────────┘│
│                                                          │
│ PRESCRIPTION DOCUMENT (if PDF uploaded)                   │
│ ┌─ bg-blue-50 ─────────────────────────────────────────┐│
│ │ 📄 {filename}  PDF document attached                 ││
│ └───────────────────────────────────────────────────────┘│
│                                                          │
│ MEDICATIONS (N)                                          │
│ ┌─ bg-blue-50 per item ────────────────────────────────┐│
│ │ {Medication}  [Pharmacy Badge]           $XX.XX      ││
│ │ Strength | Form | Quantity | Refills                 ││
│ │ Directions (SIG): {text}                             ││
│ │ Notes: {text}  DAW: Yes/No  Vial: {size}            ││
│ └───────────────────────────────────────────────────────┘│
│                                                          │
│ ─── dashed border ───                                    │
│                                                          │
│ SHIPPING (if >0): $XX.XX                                 │
│ CLINICAL SERVICES (each oversight fee with reason)       │
│                                                          │
│ ─── dashed border ───                                    │
│ Total Fees: $XX.XX (green-50)                            │
│ Line items breakdown (green-50)                          │
│ FINAL PATIENT COST: $XX.XX (green-100, text-2xl)         │
│                                                          │
│ [← Back to Edit]  [✅ Create N Prescriptions & Continue] │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Address Override

- "Override Address for This Prescription" button toggles inline form
- Fields: Street, City, State, Zip, Country
- "Save Override" saves custom address; yellow badge "Custom address for this prescription"
- "Remove Override" reverts to patient's physical_address
- `has_custom_address` and `custom_address` sent in submission payload

### 5.4 Submission Logic

**For each cart item (sequential loop):**

1. Show overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50` with spinner + progress text
2. Build `submissionPayload` — includes patient info, prescriber info, medication details
3. **First item only** gets: `profit_cents` (total oversight fees), `consultation_reason`, `shipping_fee_cents`
4. **Subsequent items:** `profit_cents: 0`, `consultation_reason: null`, `shipping_fee_cents: 0`
5. `POST /api/prescriptions/submit` → returns `prescription_id`
6. **PDF handling:**
   - If user uploaded PDF in Step 1 → use that for ALL items
   - If no PDF → auto-generate via `generatePrescriptionPdf()` per item (with patient address, provider info, Rx details, signature)
7. Upload PDF: `POST /api/prescriptions/{id}/pdf` as FormData
8. Collect all `prescriptionIds`

**On success:**
- Toast: "Prescription created!" or "N prescriptions created!"
- `clearPrescriptionSession()`
- Navigate to `/prescriptions/new/step4?prescriptionIds={id1},{id2},...`

**On error:**
- Toast with error message, stay on page

### 5.5 Tier Discount

- Loaded via `getProviderTierDiscount(supabase, userId)`
- If `discountPercentage > 0`, shown below Final Patient Cost: `{X}% discount applied ({tierName})`

### 5.6 Demo Account Guard

- `useDemoGuard()` hook — if demo account, blocks submission with demo warning

---

## 6. Step 4 — Collect Payment

**File:** `app/(features)/prescriptions/new/step4/page.tsx` (391 lines)  
**Route:** `/prescriptions/new/step4?prescriptionIds={id1,id2,...}` or `?prescriptionId={id}` (legacy)

### 6.1 URL Parameters

- `prescriptionIds`: Comma-separated list (multi-order)
- `prescriptionId`: Single ID (legacy single-order)
- Both are handled — split by comma or wrap single ID in array

### 6.2 Data Loading

Query: `supabase.from("prescriptions").select("id, medication, patient_price, profit_cents, shipping_fee_cents, payment_status, patient:patients(first_name, last_name, email)").in("id", prescriptionIds)`

Builds `OrderBillingData`:
- `prescriptions[]`: array of `{ id, medication, patientPrice, profitCents, shippingFeeCents }`
- `patientName`, `patientEmail`
- `totalPatientPrice`, `totalProfitCents`, `totalShippingFeeCents`
- `paymentStatus`

### 6.3 Page States

**State 1: Loading** — Pulse skeleton
**State 2: Active (not yet paid):**

```
┌──────────────────────────────────────────────────────────┐
│ New Prescription — Step 4 of 4: Collect Payment          │
│ [Progress: ✓ — ✓ — ✓ — 4]                 [Skip for Now]│
├──────────────────────────────────────────────────────────┤
│ ⚠️ Payment Required Before Pharmacy Submission           │
│ These N prescriptions will NOT be sent to the pharmacy   │
│ until payment is collected.                              │
├──────────────────────────────────────────────────────────┤
│ 🛡 Order Summary                                         │
│ Patient: {name}    Email: {email}                        │
│ ─── (multi-order) ───                                    │
│ {med1}                                           $XX.XX  │
│ {med2}                                           $XX.XX  │
│ Shipping & handling                              $XX.XX  │
│ Oversight & monitoring                           $XX.XX  │
│ ─── (single-order) ───                                   │
│ Medication: {name}                                       │
│ ──────────────────────────                               │
│ Total Cost: $XX.XX (green)                               │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ 📧 Send       │  │ 💳 Charge    │                      │
│  │ Payment Link  │  │ Patient Now  │                      │
│  │ (Recommended) │  │ (Instant)    │                      │
│  │ Email secure  │  │ Enter card   │                      │
│  │ payment link  │  │ details now  │                      │
│  │               │  │              │                      │
│  │ [Select →]    │  │ [Select →]   │                      │
│  └──────────────┘  └──────────────┘                      │
│                                                          │
│ I'll bill the patient later (will remain pending)        │
└──────────────────────────────────────────────────────────┘
```

**State 3: Payment Complete:**
```
┌──────────────────────────────────────────────────────────┐
│ ✅ (green circle)                                        │
│ Payment Collected!                                       │
│ The prescription(s) are being processed...               │
│ Redirecting to your prescriptions...                     │
└──────────────────────────────────────────────────────────┘
```

### 6.4 Payment Method Cards

| Card | Border | Icon BG | Icon | Accent Color | Label |
|------|--------|---------|------|-------------|-------|
| Send Payment Link | `border-blue-200 hover:border-blue-500` | `bg-blue-100` | Mail | Blue | "Recommended" |
| Charge Patient Now | `border-emerald-200 hover:border-emerald-500` | `bg-emerald-100` | CreditCard | Emerald | "Instant processing" |

Both cards: `rounded-xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 focus:ring-2`

### 6.5 BillPatientModal Integration

Opens `BillPatientModal` with:
- `prescriptionId`: First prescription ID
- `prescriptionIds`: All prescription IDs (array)
- `patientName`, `patientEmail`
- `medication`: All medication names joined by ", "
- `medicationCostCents`: Total patient price in cents
- `profitCents`: Total oversight fees
- `shippingFeeCents`: Total shipping
- `paymentStatus`
- `initialPaymentMethod`: "send-link" or "charge-now"
- `onPaymentSuccess`: Sets `billingCompleted=true`, shows success state, redirects after 2 seconds

### 6.6 Skip/Warning Behavior

- "Skip for Now" button and bottom link both call `handleSkipWithWarning()`
- Shows `window.confirm()` warning: prescriptions will NOT be sent to pharmacy until paid
- If confirmed → `/prescriptions?refresh=true`
- **Before-unload handler:** Active until `billingCompleted=true` — prevents accidental tab close

### 6.7 Single vs Multi-Order Differences (Step 4)

| Aspect | Single Order | Multi-Order |
|--------|-------------|-------------|
| Order summary | Shows "Medication: {name}" only | Shows itemized list with subtotals |
| Total calculation | `patientPrice + profitCents/100 + shippingFeeCents/100` | Same formula, summed across all items |
| Toast message | "Payment collected! Prescription will be sent..." | "Payment collected! Prescriptions will be sent..." |
| Warning text | "This prescription will NOT..." | "These N prescriptions will NOT..." |
| Skip link text | "prescription will remain pending" | "prescriptions will remain pending" |

---

## 7. Session Storage & Cart System

**File:** `app/(features)/prescriptions/new/prescriptionSessionUtils.ts` (114 lines)

### 7.1 Session Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `prescriptionFormData` | JSON string | Current form state (single medication being edited) |
| `selectedPatientId` | string | Patient ID selected in Step 1 |
| `encounterId` | string | Encounter context (from EMR) |
| `appointmentId` | string | Appointment context (from EMR) |
| `prescriptionPdfData` | data URL string | Base64-encoded PDF file content |
| `prescriptionPdfName` | string | PDF filename |
| `prescriptionCart` | JSON array | Array of `CartItem` objects |
| `cartShippingFee` | string | Shipping fee amount (e.g., "15.00") |
| `cartOversightFees` | JSON array | Array of `{ fee: string, reason: string }` |

**Legacy keys** (cleaned up): `prescriptionData`, `prescriptionDraft`

### 7.2 CartItem Interface

```typescript
interface CartItem {
  id: string;                    // crypto.randomUUID()
  medication: string;
  strength: string;
  dosageAmount?: string;
  dosageUnit?: string;
  vialSize?: string;
  form: string;
  quantity: string;
  refills: string;
  sig: string;
  dispenseAsWritten: boolean;
  pharmacyNotes: string;
  patientPrice: string;
  selectedPharmacyId: string;
  selectedPharmacyName: string;
  selectedPharmacyColor: string;
  selectedMedicationId: string;
  refillFrequencyDays?: string;
}
```

### 7.3 Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `getCart()` | `(): CartItem[]` | Parse `prescriptionCart` from sessionStorage |
| `addToCart(item)` | `(CartItem): CartItem[]` | Push item, save, return updated cart |
| `removeFromCart(id)` | `(string): CartItem[]` | Filter out by id, save, return |
| `clearCart()` | `(): void` | Remove cart + shipping + oversight keys |
| `getCartShippingFee()` | `(): string` | Get shipping fee (default "0") |
| `setCartShippingFee(fee)` | `(string): void` | Save shipping fee |
| `getCartOversightFees()` | `(): Array<{fee, reason}>` | Get oversight fees array |
| `setCartOversightFees(fees)` | `(Array): void` | Save oversight fees |
| `clearPrescriptionSession(opts?)` | `(options?): void` | Clear all keys; optionally preserve encounter context or catalog selection |

### 7.4 Session Lifecycle

```
Catalog "Prescribe" click
  └─ saves prescriptionFormData → Step 1

Step 1 mount
  └─ clearPrescriptionSession({ preserveCatalogSelection: true })
  └─ Select patient → optionally upload PDF → Continue

Step 2
  └─ Load saved prescriptionFormData (from catalog or back-navigation)
  └─ Load medications from API
  └─ Fill form → validate → Add to Cart (saves to prescriptionCart)
  └─ Repeat for more items
  └─ Save shipping/oversight fees
  └─ Navigate to Step 3

Step 3
  └─ Read cart, shipping, oversight from sessionStorage
  └─ Submit each item → POST /api/prescriptions/submit
  └─ Auto-generate or upload PDF
  └─ clearPrescriptionSession() on success
  └─ Navigate to Step 4 with prescriptionIds in URL

Step 4
  └─ Load prescriptions from DB by IDs
  └─ No sessionStorage used (all data from DB)
  └─ Collect payment → redirect to /prescriptions

Navigation away (any step)
  └─ unmount cleanup: clearPrescriptionSession() if URL leaves /prescriptions/new/
```

---

## 8. Category Mapping System

**File:** `lib/category-mapping.ts` (94 lines)

Maps granular medication categories to 10 parent categories:

| Parent Category | Subcategories |
|----------------|---------------|
| Weight Loss & Metabolism | Weight Loss, weight Loss, Metabolic, Weight Loss (GLP-1), Weight Management |
| Cognitive & Neuron Health | Neuroprotective, Cognitive, Neuron Health, Brain Health, ADHD |
| Cell & Mitochondrial Health | Regenerative, Antioxidant, Cell Health, Mitochondrial, Cellular |
| Anti-Inflammatory & Healing | Antiemetic, Antimicrobial, Immune, Immune Health, Anti-Inflammatory, Wound Care, Healing |
| Fertility & Reproductive Health | Sexual Health, Hormonal, Fertility, Reproductive |
| Longevity & Anti-Aging | Anti-Aging, Longevity, Telomere |
| Performance & Fitness | Growth Hormone, Growth Factor, Performance, Fitness, Muscle, Bodybuilding |
| Nootropics & Stress Management | Sleep & Recovery, Sleep Aid, Nootropics, Stress, Mental Clarity |
| NAD+ & Biohacking | Anti-Aging / NAD+, NAD+, NAD, Biohacking |
| Peptides | Peptides, Peptides & Growth Hormone |

### Utility Functions

- `getMedicationParentCategory(medCategory)` → parent name or original if no match
- `getMedicationCategoriesForParent(parentName)` → subcategory array
- `doesMedicationMatchParentCategory(medCategory, parentName)` → boolean

### Visual Mappings (Catalog Page)

Each parent category has:
- **Icon:** From `lucide-react` (Sparkles, Beaker, Heart, Syringe, Pill)
- **Gradient:** Two-color gradient (e.g., `from-emerald-500 to-teal-600`)
- **Background/badge:** Color scheme (e.g., `bg-emerald-50 border-emerald-200 text-emerald-700`)
- **Image:** Static file path (e.g., `/catalog/category-weight-loss.png`) or DB-stored URL

---

## 9. Data Model — PharmacyMedication Interface

Used in both Catalog and Step 2:

```typescript
interface PharmacyMedication {
  id: string;
  pharmacy_id: string;
  name: string;
  strength: string;
  form: string;
  vial_size?: string;
  retail_price_cents: number;        // Original retail price
  aimrx_site_pricing_cents: number;  // AIM Rx discounted price (used as patient price)
  category?: string;
  dosage_instructions?: string;
  detailed_description?: string;
  image_url?: string;
  ndc?: string;
  in_stock?: boolean;
  preparation_time_days?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;               // Step 2 only
  updated_at?: string;               // Step 2 only
  pharmacy: {
    id: string;
    name: string;
    slug: string;
    primary_color: string;
    tagline: string;
  };
}
```

---

## 10. API Endpoints Used

| Endpoint | Method | Used By | Purpose |
|----------|--------|---------|---------|
| `/api/provider/pharmacy` | GET | Catalog, Step 2 | Load all medications with pharmacy info + tier discount |
| `/api/admin/categories` | GET | Catalog | Load category names + image URLs |
| `/api/prescriptions/submit` | POST | Step 3 | Create prescription record in DB |
| `/api/prescriptions/{id}/pdf` | POST | Step 3 | Upload PDF file for prescription |
| Supabase `patients` table | SELECT | Step 1, Step 3 | Load patient data |
| Supabase `providers` table | SELECT | Step 2, Step 3 | Load provider info (default shipping, signature, address) |
| Supabase `prescriptions` table | SELECT | Step 4 | Load created prescriptions for billing |

---

## 11. Colors, Sizes & Design Tokens

### Primary Colors

| Token | Value | Usage |
|-------|-------|-------|
| Navy Blue | `#1E3A8A` | Card left borders, headings, select buttons, prescribe buttons |
| Blue 600 | `#2563EB` / `bg-blue-600` | Hero gradient mid, submit button, step 4 active circle |
| Blue 500 | `#3B82F6` | Hero gradient end |
| Green 500 | `bg-green-500` | Completed step circles, in-stock badges |
| Green 600 | `border-l-green-600` | Cart panel left border |
| Green 800 | `text-green-800` | Cart title, grand total |
| Emerald | `bg-emerald-500/90` | Tier discount badge, charge-now card |
| Red 500 | `bg-red-500` | Out-of-stock badge |
| Amber | `bg-amber-50 border-amber-300` | Payment warning banner |

### Sizing

| Element | Size |
|---------|------|
| All form inputs | `h-[50px]` |
| Card border radius | `rounded-[4px]` (form cards) |
| Card border radius | `rounded-2xl` (catalog cards), `rounded-xl` (list items, payment cards) |
| Card left border | `border-l-4` |
| Container max width | `max-w-7xl` (Step 1-3, Catalog), `max-w-4xl` (Step 4) |
| Catalog card image | `h-40` (grid), `w-14 h-14` (list) |
| Category carousel card | `width: 200px`, `h-32` image |
| Progress circle | `w-8 h-8 rounded-full` |
| Step 4 payment cards | `p-6 rounded-xl` |
| Submit overlay spinner | `h-12 w-12` |

### Typography

| Element | Style |
|---------|-------|
| Page title | `text-2xl sm:text-3xl font-bold tracking-tight` (wizard), `text-3xl sm:text-4xl` (catalog) |
| Card heading | `text-lg font-semibold text-[#1E3A8A]` |
| Step label (active) | `font-medium` |
| Step label (inactive) | `text-sm text-muted-foreground` |
| Price (catalog grid) | `text-lg font-bold text-gray-900` |
| Final cost (step 3) | `text-2xl font-bold text-green-800` |
| Total cost (step 4) | `font-bold text-lg text-green-700` |

---

## 12. Flow Diagrams

### 12.1 Catalog → Prescription Flow

```
[Product Catalog]
     │
     ├─ Browse categories (carousel)
     ├─ Search by name/category/strength/form
     ├─ Filter by pharmacy
     ├─ Sort by name/price
     │
     └─ Click "Prescribe" on medication
           │
           ├─ Saves medication data to sessionStorage
           │
           └─ → /prescriptions/new/step1
                    │
                    └─ (Step 1 preserves catalog selection)
```

### 12.2 Encounter → Prescription Flow

```
[EMR Encounter Page]
     │
     └─ Click "New Prescription"
           │
           ├─ URL: /prescriptions/new/step1?patientId=X&encounterId=Y&appointmentId=Z
           │
           └─ Step 1 auto-skips to Step 2 (patient pre-selected)
```

### 12.3 Multi-Order Cart Flow

```
Step 2: Fill medication form
     │
     ├─ Click "Add to Cart" → validates → adds CartItem → resets form
     │     │
     │     └─ Cart panel appears/updates (green border)
     │
     ├─ Fill another medication form
     │     │
     │     └─ Click "Add to Cart" again
     │
     └─ Click "Review N Prescriptions"
           │
           └─ Step 3: Shows all items, shared shipping/oversight
                 │
                 └─ Submit: loops through cart items sequentially
                       │
                       ├─ Item 1: full fees (shipping + oversight + consultation)
                       ├─ Item 2: zero fees
                       ├─ Item N: zero fees
                       │
                       └─ Step 4: ?prescriptionIds=id1,id2,...,idN
                             │
                             └─ BillPatientModal with all IDs
```

### 12.4 Single-Order Flow

```
Step 2: Fill medication form
     │
     └─ Click "Add & Continue" → validates → adds to cart → Step 3
           │
           └─ Step 3: Shows 1 item + fees
                 │
                 └─ Submit → 1 POST call + PDF
                       │
                       └─ Step 4: ?prescriptionIds=id1
                             │
                             └─ BillPatientModal with 1 ID
```

---

*Document generated from source code analysis. All file paths, class names, colors, and behaviors reflect the codebase as of the current revision.*
