# App Color System (Design Tokens)

This document outlines the core color palette extracted from the provided design system. These colors should be used as CSS variables or theme tokens (e.g., in styled-components, Tailwind base config, or global CSS) to ensure consistency across the application.

## 1. Shades
*Colors used for backgrounds, text, dividers, etc.*

| Name | Hex Code  | Opacity/Info |
| :--- | :---      | :---         |
| Shade 01 | `#FFFFFF` | 100% |
| Shade 02 | `#222222` | 100% |
| Shade 02 - 5% | `#222222` | 5% |
| Shade 02 - 30% | `#222222` | 30% |

## 2. Neutrals
*Colors used for backgrounds, text, dividers, etc.*

| Name | Hex Code  |
| :--- | :---      |
| Neutral 01 | `#F7F7F7` |
| Neutral 02 | `#EBEBEB` |
| Neutral 03 | `#DDDDDD` |
| Neutral 04 | `#D3D3D3` |
| Neutral 05 | `#C2C2C2` |
| Neutral 06 | `#B0B0B0` |
| Neutral 07 | `#717171` |
| Neutral 08 | `#5E5E5E` |

## 3. Primary
*Colors used for logos and icons.*

| Name | Hex Code  |
| :--- | :---      |
| Primary 01 | `#F6475F` |
| Primary 02 | `#FF385C` |

## 4. Gradients
*Colors used for different primary button states.*

| Name | Hex Code / Note |
| :--- | :--- |
| Gradient 01 | (Gradient based on Primary colors) |
| Gradient 02 | (Gradient based on Primary colors) |
| Gradient 03 | (Gradient based on Primary colors) |

## 5. Error
*Colored used for background and text of errors.*

| Name | Hex Code  |
| :--- | :---      |
| Error 01 | `#FEF8F6` |
| Error 02 | `#C13515` |

## 6. Accents
*Colors used for icons, discounts, links.*

| Name | Hex Code  | Usage |
| :--- | :---      | :---  |
| Accent 01 | `#F6D7DF` | Secondary Accent |
| Accent 02 | `#D03660` | Secondary Accent |
| Discount  | `#008A05` | Discount indicators |
| Link      | `#004CC4` | Text links |

## 7. Button Variants & States
*Color mappings for different button types across their interactive states. These are mapped to the core palette tokens based on visual appearance.*

### Primary Button
| State | Background | Text/Icon | Outline/Border |
| :--- | :--- | :--- | :--- |
| **Default** | Primary 02 (`#FF385C`) / Gradients | Shade 01 (`#FFFFFF`) | None |
| **Hover** | Slightly darker pink (Derived) | Shade 01 (`#FFFFFF`) | None |
| **Pressed** | Primary 01 (`#F6475F`) | Shade 01 (`#FFFFFF`) | None |
| **Focus** | Primary 02 (`#FF385C`) / Gradients | Shade 01 (`#FFFFFF`) | Shade 02 (`#222222`) offset |
| **Loading** | Neutral 04 (`#D3D3D3`) | Shade 01 (`#FFFFFF`) | None |
| **Disabled** | Neutral 02 (`#EBEBEB`) | Shade 01 (`#FFFFFF`) | None |

### Secondary Button (Dark)
| State | Background | Text/Icon | Outline/Border |
| :--- | :--- | :--- | :--- |
| **Default** | Shade 02 (`#222222`) | Shade 01 (`#FFFFFF`) | None |
| **Hover** | Dark Grey (Derived) | Shade 01 (`#FFFFFF`) | None |
| **Pressed** | Lighter Dark Grey (Derived) | Shade 01 (`#FFFFFF`) | None |
| **Focus** | Shade 02 (`#222222`) | Shade 01 (`#FFFFFF`) | Shade 02 (`#222222`) offset |
| **Loading** | Shade 02 (`#222222`) | Shade 01 (`#FFFFFF`) | None |
| **Disabled** | Neutral 02 (`#EBEBEB`) | Shade 01 (`#FFFFFF`) | None |

### Tertiary Button
| State | Background | Text/Icon | Outline/Border |
| :--- | :--- | :--- | :--- |
| **Default** | Shade 01 (`#FFFFFF`) | Shade 02 (`#222222`) | Neutral 05 (`#C2C2C2`) |
| **Hover** | Neutral 01 (`#F7F7F7`) | Shade 02 (`#222222`) | Neutral 05 (`#C2C2C2`) |
| **Pressed** | Neutral 02 (`#EBEBEB`) | Shade 02 (`#222222`) | Neutral 05 (`#C2C2C2`) |
| **Focus** | Shade 01 (`#FFFFFF`) | Shade 02 (`#222222`) | Shade 02 (`#222222`) |
| **Loading** | Shade 01 (`#FFFFFF`) | Neutral 05 (`#C2C2C2`) | Neutral 04 (`#D3D3D3`) |
| **Disabled** | Neutral 02 (`#EBEBEB`) | Shade 01 (`#FFFFFF`) | Neutral 04 (`#D3D3D3`) |

### Text / Link Buttons (Small)
| Type | Default (Text Color) | Action/Hover | Outline/Border |
| :--- | :--- | :--- | :--- |
| **Standard Link** | Link (`#004CC4`) | Underline / Opacity change | None |
| **Standard Action** | Shade 02 (`#222222`) | Underline / Opacity change | None |
| **Tertiary Action** | Shade 02 (`#222222`) | Background shift (Neutral 01) | Neutral 05 (`#C2C2C2`) |
| **Disabled** | Neutral 05 (`#C2C2C2`) | None | None |
