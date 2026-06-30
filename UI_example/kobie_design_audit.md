# Kobie Design System: Visual Language & Frontend Audit
**A Complete Blueprint for Hackathon Designers and Frontend Developers**

This document contains the complete, reverse-engineered design system, visual guidelines, interaction patterns, and frontend architecture of [Kobie Marketing](https://kobie.com/). Use this as your primary reference to build digital experiences that feel authentically and unmistakably "Kobie."

---

## 1. Brand Personality

### What it is
Kobie’s brand personality combines **Enterprise Scale** with **Human Empathy**. The visual theme balances the security and authority needed to manage high-liability loyalty platforms with the warmth and connection of customer relationships.

### Why Kobie chose it
Enterprise loyalty software is a high-stakes B2B service. Clients need to trust that the platform can scale to handle millions of transactions securely. However, because loyalty is built on customer relationships, the design must also feel approachable and human.

### What psychological effect it creates
*   **Trust and Stability:** Deep dark backgrounds and structured grids reassure enterprise buyers.
*   **Warmth and Partnership:** Vibrant coral accents, rounded container shapes, and real-life imagery help make the brand feel accessible and customer-focused.

### How to recreate it
*   **Contrast Blocks:** Alternate page layouts between deep Midnight Navy (`#051C2C`) backgrounds and clean, spacious white views.
*   **Humanize Technical Content:** Present modern tech features (like AI assistants) in conversational terms, supported by rounded design elements and friendly visual accents.

---

## 2. Color System

### What it is
A high-contrast color scheme that pairs deep navy shades with energetic coral highlights.

| Accent Category | CSS Variable Name | Color Code (HEX) | Role in Layout |
| :--- | :--- | :--- | :--- |
| **Midnight Navy** | `--kobie-midnight` | `#051C2C` | Core background, primary headers, dark panels. |
| **Deep Ocean** | `--kobie-ocean` | `#092538` | Card backgrounds, slider panels, dark borders. |
| **Coral Accent** | `--kobie-coral` | `#FD7F4F` | CTAs, active links, hover borders, main highlights. |
| **Slate Violet** | `--kobie-lavender` | `#5461C9` | Hover states, submenu column highlights. |
| **Pure White** | `--kobie-white` | `#FFFFFF` | Core layout background, text on dark sections. |
| **Muted Slate** | `--kobie-gray` | `#666666` | Paragraph text on light sections. |

### Why Kobie chose it
*   **Midnight Navy:** Replaces stark blacks to create a sophisticated, high-contrast dark theme.
*   **Coral Accent:** Represents the brand's coral heart motif, drawing focus to key layout actions.
*   **Slate Violet:** Introduces a clean accent color to highlight nested hover menus and technical details.

### What psychological effect it creates
*   **Midnight Navy:** Builds a sense of depth and authority.
*   **Coral Accent:** Focuses user attention on primary actions without looking aggressive.
*   **Slate Violet:** Signals modern innovation and technical precision.

### How to recreate it
Import this color token configuration into your CSS variables:
```css
:root {
  --kobie-midnight: #051c2c;
  --kobie-ocean: #092538;
  --kobie-coral: #fd7f4f;
  --kobie-lavender: #5461c9;
  --kobie-white: #ffffff;
  --kobie-gray: #666666;
}
```

---

## 3. Typography System

### What it is
Kobie uses a dual-font typographic system, pairing **Inter** (for headers) with **Roboto** (for body copy).

```
   ┌─────────────────────────────────────────────────────────────┐
   │ HEADINGS: Inter (Extra Bold / Bold)                          │
   │ Clean, geometric, uppercase overlines, close tracking       │
   ├─────────────────────────────────────────────────────────────┤
   │ BODY TEXT: Roboto (Regular / Medium)                        │
   │ Tall vertical forms, highly legible, generous line-heights  │
   └─────────────────────────────────────────────────────────────┘
```

### Why Kobie chose it
*   **Inter (Headers):** Inter's clean, geometric forms look structured and modern, rendering cleanly at large enterprise scales.
*   **Roboto (Body):** Roboto's slight vertical compression makes it highly legible on screens, keeping dense copy comfortable to read.

### What psychological effect it creates
*   **Inter:** Feels clean, precise, and authoritative.
*   **Roboto:** Feels familiar, highly legible, and easy to read.

### How to recreate it
Apply this type scale to your CSS hierarchy:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: 'Inter', sans-serif;
  color: var(--kobie-midnight);
  font-weight: 700;
  line-height: 1.2em;
}

body, p {
  font-family: 'Roboto', sans-serif;
  color: var(--kobie-gray);
  font-weight: 400;
  line-height: 1.7em;
}

.overline {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kobie-coral);
}
```

---

## 4. Layout System

### What it is
A flexible grid container with wide limits (up to **1500px**), wide gutters, and generous vertical spacing.

### Why Kobie chose it
The wide layout gives large headlines plenty of room to breathe. Using generous vertical spacing between sections creates a clean, premium reading rhythm.

### What psychological effect it creates
Reduces clutter and cognitive overload, making information easy to process.

### How to recreate it
Configure these container and section constraints:
```css
.container {
  width: 90%;
  max-width: var(--container-max-width);
  margin: 0 auto;
}

.section {
  padding: 75px 0; /* Desktop scale */
}

@media (min-width: 1875px) {
  .section {
    padding: 112px 0; /* Widescreen scale */
  }
}
```

---

## 5. Hero Section Analysis

### What it is
An asymmetrical, 2/3 width content alignment that places copy in the left-hand column, leaving the right-hand column open to give the headline breathing room.

```
+───────────────────────────────────────────────────────────+
|                                                           |
|  LOYALTY TECHNOLOGY AND SERVICES                          |
|  <h1>Growing enterprise                                   |
|  value through loyalty</h1>                               |
|                                                           |
|  [Icon] Global      [Icon] Forrester      [Icon] Top      |
|  Brand Partner      Leader                Workplace       |
|                                                           |
+───────────────────────────────────────────────────────────+
```

### Why Kobie chose it
B2B decisions are made quickly. The hero section displays the core value proposition alongside trust indicators (Forrester Leader badges) to immediately validate the brand.

### What psychological effect it creates
Positions Kobie as a premium industry leader from the first viewport.

### How to recreate it
Use a simple two-column flex or grid layout:
```html
<section class="hero">
  <div class="container hero-grid">
    <div class="hero-content">
      <span class="overline">Loyalty Technology and Services</span>
      <h1>Growing enterprise value through loyalty</h1>
      
      <div class="trust-indicators">
        <div class="indicator-item">Global Brand Partner</div>
        <div class="indicator-item">Forrester Leader</div>
        <div class="indicator-item">Top Workplace</div>
      </div>
    </div>
    <div class="hero-graphic-spacer"></div>
  </div>
</section>
```

---

## 6. Component Library

### Primary Buttons
*   **Structure:** Inline block with a `3px` border-radius.
*   **Hover Effect:** The text slides slightly right, a coral arrow icon appears on the right, and the border highlights.
*   **Recreation:**
    ```css
    .btn-primary {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 500;
      padding: 10px 24px;
      border: 2px solid var(--kobie-coral);
      border-radius: 3px;
      transition: all 0.2s ease-in-out;
    }
    .btn-primary:hover {
      padding-right: 32px;
      background-color: var(--kobie-coral);
      color: #ffffff;
    }
    ```

### Solution & Feature Cards
*   **Structure:** Rounded cards (`10px` border-radius) styled with deep ocean blue (`#092538`) backdrops.
*   **Hover Effect:** Card translates vertically up by `3px` with a smooth background color change.
*   **Recreation:**
    ```css
    .card-solution {
      background-color: var(--kobie-ocean);
      border-radius: 10px;
      padding: 30px;
      transition: transform 300ms ease, background-color 300ms ease;
    }
    .card-solution:hover {
      transform: translateY(-3px);
      background-color: var(--kobie-lavender);
    }
    ```

### Image/Video Poster Playback Block
*   **Structure:** A clean video wrapper featuring a play button hover overlay.
*   **Hover Effect:** The play button expands on hover.

---

## 7. Shapes & Visual Language

### What it is
A structured layout combined with rounded design accents.

```
       10px Rounded Corners                   Sharp Section Breaks
      ┌────────────────────┐                  ────────────────────
      │                    │
      │        Card        │                  
      │                    │                  ────────────────────
      └────────────────────┘
```

### Why Kobie chose it
The structured section breaks keep the layout organized and professional, while the rounded cards make elements feel approachable and modern.

### What psychological effect it creates
Creates a balance between clean, structured layout design and welcoming, user-friendly details.

### How to recreate it
*   Use a default `10px` border-radius on cards, images, and drop-downs.
*   Use sharp, crisp boundaries for layout rows and main section borders.
*   Add a subtle coral underline (`5px` border-top) on mega menus and highlight cards.

---

## 8. Motion Design

### What it is
Clean micro-interactions and scroll reveals that animate sections as they enter the screen.

### Why Kobie chose it
Subtle scroll reveals make the page feel responsive and alive, encouraging users to scroll through the content.

### What psychological effect it creates
Signals quality, technical polish, and attention to detail.

### How to recreate it
Create a slide-up fade keyframe animation:
```css
@keyframes revealUp {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.reveal-on-scroll {
  animation: revealUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

---

## 9. Navigation UX

### What it is
A sticky header featuring clear layout columns, dropdown menus, and a high-contrast CTA button.

```
+───────────────────────────────────────────────────────────────────────────+
|  [Kobie Logo]    Products  Services  Industries  About  Insights  [Connect] |
+───────────────────────────────────────────────────────────────────────────+
```

### Why Kobie chose it
A sticky header keeps key pages accessible at all times, making it easy for users to navigate the site.

### What psychological effect it creates
Provides immediate control over site navigation.

### How to recreate it
```css
.site-header {
  position: sticky;
  top: 0;
  background-color: var(--kobie-midnight);
  z-index: 1000;
  transition: padding 0.3s ease;
}
.site-header.shrink {
  padding: 10px 0;
}
```

---

## 10. Content Hierarchy

### What it is
A narrative structure that builds trust before introducing features and CTAs:

1.  **Value Proposition:** Clear value statement + trust metrics.
2.  **Product Highlights:** Introducing the Bonnie AI Loyalty Assistant.
3.  **Solutions:** The Alchemy platform and service offerings.
4.  **Social Proof:** Client case studies.
5.  **About & Experience:** Highlighting 35 years of industry leadership.
6.  **Analyst Reviews:** Quotes and testimonials from Forrester.

### Why Kobie chose it
Enterprise sales require validation. Placing trust metrics early on keeps visitors engaged and builds trust.

### What psychological effect it creates
Guides readers through a logical, reassuring story that ends in clear conversion opportunities.

### How to recreate it
Arrange your site sections in this order to guide users down a logical reading path.

---

## 11. Imagery

### What it is
Warm, professional photography that features real human interactions and clean, line-based icons.

### Why Kobie chose it
Showing real-world customer interactions helps explain the brand's focus on customer relationships and loyalty.

### What psychological effect it creates
Humanizes the software, making it feel collaborative and accessible.

### How to recreate it
*   Use photography with natural lighting and warm colors.
*   Add blue-tinted overlays to images on dark sections:
    ```css
    .image-overlay {
      background-image: linear-gradient(180deg, rgba(5,28,44,0.5) 0%, rgba(84,97,201,0.35) 100%);
    }
    ```

---

## 12. Design Tokens

### What it is
A central set of layout variables:

```css
:root {
  --kobie-midnight: #051c2c;
  --kobie-ocean: #092538;
  --kobie-coral: #fd7f4f;
  --kobie-lavender: #5461c9;
  
  --kobie-font-heading: 'Inter', sans-serif;
  --kobie-font-body: 'Roboto', sans-serif;
  
  --kobie-spacing-base: 12px;
  --kobie-spacing-lg: 24px;
  --kobie-spacing-xl: 48px;
  
  --kobie-radius-card: 10px;
  --kobie-radius-button: 3px;
  
  --kobie-transition: 300ms ease;
}
```

### Why Kobie chose it
Using design tokens maintains consistent styling across different developers and codebases.

### What psychological effect it creates
Ensures visual consistency across all pages and features.

### How to recreate it
Define these variables in your root CSS stylesheet.

---

## 13. Frontend Architecture

### What it is
A modular layout build that uses fast transitions, responsive media source sets, and optimized CSS delivery.

### Why Kobie chose it
Clean code structure ensures fast load times and a smooth responsive experience on all screen sizes.

### What psychological effect it creates
A fast, responsive site feels professional and reliable.

### How to recreate it
*   Use responsive image tags (`srcset`).
*   Organize styling files into distinct structural elements (e.g. `layout.css`, `colors.css`, `components.css`).

---

## 14. UI Patterns

### What it is
Consistent visual patterns, such as alternating section colors and multi-column grids.

### Why Kobie chose it
Repeating visual patterns makes the site easy to scan and navigate.

### What psychological effect it creates
Makes content feel organized and easy to digest.

### How to recreate it
*   Alternate section backgrounds: White -> Midnight Navy -> Deep Ocean.
*   Use a consistent grid layout for product cards and details.

---

## 15. UX Decisions

### What it is
Design choices that focus on clear information, easy scanning, and low cognitive load.

### Why Kobie chose it
Keeping design layouts clean and values clear helps guide users to key CTAs.

### What psychological effect it creates
Provides an easy, stress-free browsing experience.

### How to recreate it
*   Keep body copy width limited to `823px` for comfortable reading.
*   Use clean trust metrics rather than complex tables for high-level validation.

---

## 16. Visual Hierarchy

### What it is
Varying typography sizes and color contrasts to guide the user's eye.

### Why Kobie chose it
Good hierarchy helps users scan pages quickly and highlights important information.

### What psychological effect it creates
Directs user focus to the most critical information first.

### How to recreate it
*   Pair large headings with uppercase subheadings to structure your text.
*   Use coral accents (`#FD7F4F`) to highlight key action links.

---

## 17. Responsive Design

### What it is
A responsive layout grid that adapts across different screen sizes.

```
Desktop (1500px Container)       Tablet (980px Width)         Mobile (<767px Stacked)
 ┌─────────┬─────────┐          ┌─────────┬─────────┐          ┌───────────────────┐
 │ Col 1   │ Col 2   │          │ Col 1   │ Col 2   │          │       Col 1       │
 └─────────┴─────────┘          └─────────┴─────────┘          ├───────────────────┤
                                                               │       Col 2       │
                                                               └───────────────────┘
```

### Why Kobie chose it
Ensures a consistent user experience on desktop, tablet, and mobile displays.

### What psychological effect it creates
Shows professional polish and provides an accessible mobile experience.

### How to recreate it
Use media queries to scale down headings and stack columns:
```css
@media (max-width: 980px) {
  .hero-content h1 { font-size: 35px; }
  .grid-columns { grid-template-columns: 1fr; }
}
```

---

## 18. Accessibility

### What it is
Ensuring high contrast ratios, visible focus outlines, and semantic HTML markup.

### Why Kobie chose it
Good accessibility ensures everyone can use the site and aligns with modern web standards.

### What psychological effect it creates
Builds a professional, inclusive brand experience.

### How to recreate it
*   Ensure all text highlights pass AAA contrast requirements.
*   Add visible focus rings on interactive elements:
    ```css
    a:focus-visible, button:focus-visible {
      outline: 3px solid var(--kobie-coral);
      outline-offset: 3px;
    }
    ```

---

## 19. Recreating the Kobie Feel: The Design Blueprint

Use this blueprint during the hackathon to build a project that matches Kobie's visual language:

### Core Design Rules
*   **Visual Strategy:** Alternate your background colors (White -> Midnight Navy -> Deep Ocean) to separate content sections.
*   **Rounded Cards:** Use a `10px` border-radius on cards, dropdown menus, and content containers.
*   **Vibrant Accents:** Save coral (`#FD7F4F`) for primary action buttons, links, and borders.
*   **Font Selection:** Use **Inter** for bold headers and **Roboto** for legible body text.

### Spacing Guidelines
*   **Section Spacing:** Keep section padding around `75px` to `112px` to give content room to breathe.
*   **Card Spacing:** Use `30px` inner padding for cards and `24px` margins between grid elements.

### Do's and Don'ts
*   **DO** use deep navy (`#051C2C`) instead of pure black for dark text.
*   **DO** translate cards slightly upward on hover to make elements feel interactive.
*   **DON'T** use highly rounded button styles. Keep button shapes clean and geometric.
*   **DON'T** clutter layouts with too many colors. Stick to the core navy, white, and coral palette.

### Common Mistakes to Avoid
*   **Mistake:** Using standard corporate blue. 
    *   *Result:* The design will look like a generic tech site rather than Kobie.
*   **Mistake:** Rounding button borders completely. 
    *   *Result:* The UI will lose its structured, enterprise feel.
*   **Mistake:** Not using enough whitespace. 
    *   *Result:* Dense text sections will look cluttered and difficult to read.

---

## 20. Code Boilerplate (Copy-Paste Foundations)

### 1. CSS Stylesheet (`kobie-theme.css`)
```css
/* ==========================================================================
   KOBIE BRAND DESIGN SYSTEM - STYLESHEET
   ========================================================================== */

/* Design Tokens */
:root {
  --kobie-midnight: #051c2c;
  --kobie-ocean: #092538;
  --kobie-coral: #fd7f4f;
  --kobie-lavender: #5461c9;
  --kobie-white: #ffffff;
  --kobie-gray: #666666;
  --kobie-border-light: rgba(255, 255, 255, 0.15);

  --font-heading: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Roboto', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

  --radius-card: 10px;
  --radius-button: 3px;
  --transition-normal: 300ms cubic-bezier(0.25, 0.8, 0.25, 1);
  --transition-fast: 200ms ease;
  
  --container-max-width: 1500px;
  --content-max-width: 823px;
}

/* Base resets & typography */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--kobie-white);
  color: var(--kobie-midnight);
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  color: var(--kobie-midnight);
  font-weight: 700;
  line-height: 1.25;
  margin-bottom: 0.5em;
}

p {
  color: var(--kobie-gray);
  margin-bottom: 1em;
}

/* Layout Utilities */
.container {
  width: 90%;
  max-width: var(--container-max-width);
  margin: 0 auto;
  position: relative;
}

.section {
  padding: 80px 0;
}

.section-dark {
  background-color: var(--kobie-midnight);
  color: var(--kobie-white);
}

.section-dark h1,
.section-dark h2,
.section-dark h3,
.section-dark h4 {
  color: var(--kobie-white);
}

.section-dark p {
  color: rgba(255, 255, 255, 0.8);
}

.section-ocean {
  background-color: var(--kobie-ocean);
  color: var(--kobie-white);
}

.section-ocean h1,
.section-ocean h2,
.section-ocean h3 {
  color: var(--kobie-white);
}

.section-ocean p {
  color: rgba(255, 255, 255, 0.8);
}

/* Typography Utilities */
.overline {
  display: block;
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--kobie-coral);
  margin-bottom: 12px;
}

/* Flex / Grid layouts */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}

@media (min-width: 768px) {
  .grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Component Styles */

/* Primary Button */
.btn-kobie {
  display: inline-block;
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: 700;
  color: var(--kobie-white);
  background-color: transparent;
  padding: 12px 30px;
  border: 2px solid var(--kobie-coral);
  border-radius: var(--radius-button);
  text-decoration: none;
  cursor: pointer;
  transition: var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.btn-kobie:hover {
  background-color: var(--kobie-coral);
  color: var(--kobie-white);
}

.btn-kobie::after {
  content: " →";
  opacity: 0;
  transition: var(--transition-fast);
}

.btn-kobie:hover::after {
  opacity: 1;
}

/* Card Component */
.card-kobie {
  background-color: var(--kobie-ocean);
  border-radius: var(--radius-card);
  padding: 30px;
  border: 1px solid var(--kobie-border-light);
  transition: var(--transition-normal);
}

.card-kobie h3 {
  font-size: 20px;
  color: var(--kobie-white);
  margin-bottom: 15px;
}

.card-kobie p {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0;
}

.card-kobie:hover {
  transform: translateY(-5px);
  background-color: var(--kobie-lavender);
  box-shadow: 0 10px 25px rgba(5, 28, 44, 0.35);
}

/* Trust Indicators */
.trust-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 40px;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 14px;
  color: var(--kobie-white);
  border-right: 1px solid var(--kobie-border-light);
  padding-right: 20px;
}

.trust-item:last-child {
  border-right: none;
}
```

### 2. Scaffold Template (`index.html`)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kobie Hackathon Scaffold Page</title>
  <link rel="stylesheet" href="kobie-theme.css">
</head>
<body>

  <!-- Sticky Navigation Header -->
  <header class="section-dark" style="padding: 20px 0; border-bottom: 1px solid var(--kobie-border-light); position: sticky; top: 0; z-index: 100;">
    <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
      <!-- Kobie Recreated brand mark structure -->
      <div style="font-family: var(--font-heading); font-weight: 900; font-size: 24px; color: var(--kobie-white);">
        Kobie <span style="color: var(--kobie-coral);">♥</span>
      </div>
      <nav style="display: flex; gap: 30px; align-items: center;">
        <a href="#products" style="color: var(--kobie-white); text-decoration: none; font-weight: 700; font-family: var(--font-heading);">Products</a>
        <a href="#services" style="color: var(--kobie-white); text-decoration: none; font-weight: 700; font-family: var(--font-heading);">Services</a>
        <a href="#contact" class="btn-kobie" style="padding: 8px 20px;">Connect With Us</a>
      </nav>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="section section-dark" style="padding: 120px 0 80px 0;">
    <div class="container grid-2">
      <div>
        <span class="overline">Loyalty Technology and Services</span>
        <h1 style="font-size: 55px; margin-bottom: 20px;">Growing enterprise value through loyalty</h1>
        <p style="font-size: 18px; margin-bottom: 30px;">
          Deliver end-to-end personalization and scale, powered by high-fidelity data and leading AI technology.
        </p>
        <a href="#contact" class="btn-kobie">Explore Our Solutions</a>
        
        <div class="trust-indicators">
          <div class="trust-item">
            <span>🌍</span> Global Brand Partner
          </div>
          <div class="trust-item">
            <span>🏆</span> Forrester Leader
          </div>
          <div class="trust-item">
            <span>❤️</span> Top Workplace
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: center; align-items: center; background: radial-gradient(circle, var(--kobie-ocean) 0%, transparent 70%); min-height: 300px;">
        <!-- Left empty to simulate Kobie's asymmetrical negative space layout -->
      </div>
    </div>
  </section>

  <!-- Solutions Grid -->
  <section id="products" class="section">
    <div class="container">
      <div style="max-width: var(--content-max-width); margin-bottom: 50px;">
        <span class="overline">Technology & Services</span>
        <h2 style="font-size: 40px;">Our Composable Solutions</h2>
        <p style="font-size: 16px;">
          Configure your program and orchestrate experiences with full control. Use our complete end-to-end cloud platform, or integrate key pieces directly into your existing martech stack.
        </p>
      </div>

      <div class="grid-3">
        <!-- Card 1 -->
        <div class="card-kobie">
          <span class="overline" style="font-size: 11px;">Data Engine</span>
          <h3>Loyalty Data Engine</h3>
          <p>Power your customer engagement strategy with Panoramic Customer Profiles that integrate behavioral, emotional, and zero-party data.</p>
        </div>
        <!-- Card 2 -->
        <div class="card-kobie">
          <span class="overline" style="font-size: 11px;">Management</span>
          <h3>Loyalty Management</h3>
          <p>Configure programs and orchestrate customer journeys with Bonnie, your AI Loyalty Assistant, and built-in forecasting tools.</p>
        </div>
        <!-- Card 3 -->
        <div class="card-kobie">
          <span class="overline" style="font-size: 11px;">Personalization</span>
          <h3>Personalization Hub</h3>
          <p>Activate real-time context clues and dynamic actions to boost customer lifetime value and drive repeat behavior.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer Section -->
  <footer class="section section-dark" style="border-top: 1px solid var(--kobie-border-light);">
    <div class="container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
      <p style="margin: 0; color: rgba(255,255,255,0.6);">&copy; 2026 Kobie Marketing. Recreated for Hackathon Reference.</p>
      <a href="#top" style="color: var(--kobie-coral); text-decoration: none; font-weight: 700;">Back to Top</a>
    </div>
  </footer>

</body>
</html>
```
