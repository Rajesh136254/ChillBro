# Branch Data Isolation Fixes

I have implemented strict data isolation rules to ensure that resources (specifically Tables) are unique to their respective branches and do not leak into other branches.

## 1. Backend Updates (`server.js`)

### A. Table Creation Validation (`POST /api/tables`)
- **Old Behavior**: Prevented duplicate table numbers across the *entire company*. (e.g., If Table 1 exists in any branch, you could not create Table 1 in another).
- **New Behavior**: Validation is now **scoped to the branch**.
    - You CAN have "Table 1" in Branch A.
    - You CAN have "Table 1" in Branch B.
    - They are treated as distinct independent tables.

### B. Table Fetching (`GET /api/tables`)
- **Old Behavior**: When viewing a branch, might have included global (unassigned) tables.
- **New Behavior**: **Strict Filtering**.
    - When you select "Branch A", you will **ONLY** see tables explicitly assigned to Branch A.
    - Unassigned tables will only appear in "All Branches" view (or if you implement an unassigned view).

## 2. Impact on Frontend
- **Admin Page -> Tables**:
    - Selecting "Branch A" shows only Branch A tables.
    - You can now create "Table 1" in Branch A even if "Table 1" exists elsewhere.
- **Customer Page / QR Scan**:
    - Scanning "Table 1" (Branch A) loads Branch A data.
    - Scanning "Table 1" (Branch B) loads Branch B data.
    - No confusion between identically named tables in different locations.

## Verification Steps
1. Open **Admin -> Tables**.
2. Select **Branch 1** from the dropdown.
3. Create **Table 1**.
4. Switch to **Branch 2**.
5. Verify "Table 1" is NOT visible.
6. Create **Table 1** in Branch 2.
7. Verify successful creation (no "Duplicate" error).
8. Switch to **All Branches**. Verify you see TWO "Table 1" entries (one for each branch).
