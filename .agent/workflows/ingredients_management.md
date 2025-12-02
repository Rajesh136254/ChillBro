---
description: How to use the Ingredients Management System
---

# Ingredients Management Workflow

This workflow describes how to use the new Ingredients Management system.

## 1. Accessing the Page
- Navigate to the Admin Dashboard.
- Click on the "Ingredients" link in the header or the "Ingredients" card on the Home Page.

## 2. Adding an Ingredient
1. Click the "Add Ingredient" button.
2. Fill in the details:
   - **Name**: Name of the ingredient (e.g., "Tomato").
   - **Quantity**: Current stock level.
   - **Unit**: Unit of measurement (kg, g, l, ml, pcs).
   - **Threshold**: Low stock alert threshold.
3. Click "Save Ingredient".

## 3. Managing Stock
- The table shows all ingredients.
- **Low Stock**: Items below the threshold are highlighted with a "Low Stock" badge.
- **Edit**: Click the edit icon (pencil) to update quantity or details.
- **Delete**: Click the trash icon to remove an ingredient.

## 4. Search
- Use the search bar at the top to filter ingredients by name.

## 5. Backend Integration
- The system uses the following API endpoints:
  - `GET /api/ingredients`: List all ingredients.
  - `POST /api/ingredients`: Create new ingredient.
  - `PUT /api/ingredients/:id`: Update ingredient.
  - `DELETE /api/ingredients/:id`: Delete ingredient.
