# Implementation Plan - Premium Management UI Overhaul (Refined)

The current card-based design for management modules has improved the aesthetic but lacks rigid alignment, leading to a "jumbled" appearance when content lengths vary. This plan introduces **Rigid Grid Alignment** to ensure pixel-perfect vertical consistency across all cards.

## User Review Required
> [!IMPORTANT]
> I am moving from a flexible layout to a more **rigid column-based grid**. This may cause some text to truncate more aggressively on smaller screens, but will significantly improve the professional look on desktop.

## Proposed Changes

### Management Modules [MODIFY]

#### [MODIFY] [CompanyManagement.tsx](file:///Users/sunnitic/Desktop/00_dev_/Pickup/frontend/src/components/CompanyManagement.tsx)
- **Rigid Column Grid**: Replace the top-level `flex-row` with a CSS grid or fixed-width flex containers.
  - **Col 1 (Identity - 300px)**: Icon + Company Name + CEO Name.
  - **Col 2 (Business ID - 180px)**: Label ("사업자등록번호") + Value.
  - **Col 3 (Industry - 150px)**: Label ("업종 분류") + Value.
  - **Col 4 (Stats - 100px)**: Label ("직원 현황") + Value.
  - **Col 5 (Actions - auto)**: Buttons pushed to the right.
- **Vertical Alignment**: Ensure all cells use `items-center` for perfect horizontal leveling.

#### [MODIFY] [CertificateManagement.tsx](file:///Users/sunnitic/Desktop/00_dev_/Pickup/frontend/src/components/CertificateManagement.tsx)
- Apply the same rigid column widths as `CompanyManagement` to maintain a unified visual language.
- Ensure the "Delete" link is clearly positioned in the same action zone.

#### [MODIFY] [TaxAccountantManagement.tsx](file:///Users/sunnitic/Desktop/00_dev_/Pickup/frontend/src/components/TaxAccountantManagement.tsx)
- Update card layout to follow the new 5-column rigid grid.

## Verification Plan

### Manual Verification
- Verify that "Business ID" columns align exactly vertically across all cards.
- Ensure all labels are consistently positioned relative to their values.
- Check responsiveness: ensure layout remains readable on smaller widths.
