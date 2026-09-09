# Kredit - Customer Credit & Payment Ledger 

**Kredit** is a modern, lightweight, and offline-first credit records and customer ledger web application designed for small business owners, retail shopkeepers, freelancers, and individuals. It replaces traditional paper credit notebooks ("khata books") with an intuitive digital ledger that tracks credit given, payments collected, real-time customer balances, and an immutable, transparent audit trail.



## Target Audience
- **Retail & Grocery Store Owners**: Track customers taking goods on credit and partial cash/transfer repayments.
- **Wholesalers & Distributors**: Manage outstanding receivables, invoice references, and customer credit limits.
- **Service Providers & Freelancers**: Record billable services extended on credit and client payments.
- **Individuals & Personal Lenders**: Keep accurate records of personal loans, informal credit, and mutual debts with friends or colleagues.



##  The Problem It Solves
1. **Lost & Inaccurate Paper Records**: Paper ledgers get lost, torn, or have calculation errors when computing rolling balances.
2. **Lack of Modification Accountability**: Disputed debts often arise when entries are altered or crossed out without proof or reasons.
3. **Slow Follow-ups & Debt Recovery**: Business owners often forget to follow up or struggle to draft clear payment reminders and account statements for customers.
4. **Complexity of Heavy Accounting Tools**: Complex ERPs (e.g. QuickBooks, SAP) are overkill for simple "How much credit" vs "How much him pay" workflows.



##  Key Features
- **Core Dual-Action Recording**:
  - **"How much credit?"** (`+ Give Credit`): Record items, goods, or cash given on credit with optional promised repayment due dates.
  - **"How much him pay?"** (`+ Receive Payment`): Record partial or full repayments with payment method (Cash, Bank Transfer, POS/Card, Mobile Money, etc.).
- **Live Financial Dashboard**:
  - Total Outstanding Receivables (Total You Will Get).
  - Total Recovered / Collected Payments.
  - Total Credit Extended.
  - Customer Accounts Status (Owes You, Settled, In Advance).
- **Full Editable History & Immutable Audit Trail**:
  - Edit or delete transactions whenever adjustments are needed.
  - Every edit and deletion requires a stated reason and automatically logs previous values vs new values with precise timestamps into an immutable Audit Trail view.
- **Customer Directory with Instant Search & Filters**:
  - Filter customers by status: *All*, *Owes You*, *Settled*, or *In Advance*.
  - Fast search by customer name or phone number.
- **1-Click WhatsApp & SMS Reminder Generator**:
  - Generates pre-formatted, polite debt reminder messages with direct WhatsApp click-to-chat links (`wa.me`) or clipboard copying.
- **Printable Account Statement**:
  - Clean, formatted printable ledger statements ready for printing or exporting as PDF directly from the browser.
- **Offline Persistence & Data Portability**:
  - Data is saved directly in the browser's `LocalStorage` (zero internet or server required).
  - Full JSON backup export and import/restore capability to protect data across devices.
  - Realistic built-in sample demo data for instant testing and onboarding.



##  Technologies & Tools Used
- **HTML5**: Semantic document structure, modal dialogs, accessible form controls, and print containers.
- **Vanilla CSS3**:
  - High-performance, bespoke styling.
  - **Strictly Zero Tailwind CSS** and **Strictly Zero CSS Variables (`--var`)** as specified in the project constraints.
  - Modern dark-slate aesthetic with high-contrast color coding (Red for Credit/Debt, Green for Payments/Settled, Blue for Advance/Primary actions).
  - Responsive breakpoints for mobile, tablet, and desktop viewports, with specialized `@media print` rules.
- **Vanilla JavaScript (ES6+)**:
  - Pure modular architecture without external framework overhead.
  - Precision balance calculation engine with floating-point rounding safeguards.
  - LocalStorage manager with error handling and fallback defaults.
  - Dynamic DOM rendering and event delegation for responsive performance.



## Important Architectural & Design Decisions
1. **Dedicated Audit Trail vs. Silent Edits**:
   - Rather than silently updating transaction values in place, every modification or deletion captures the old snapshot, the new snapshot, a timestamp, and a mandatory user reason. This preserves trust between business owners and staff.
2. **Simplified Two-Button Core UX**:
   - The customer detail view foregrounds two high-contrast, prominent action cards: *"How much credit?"* and *"How much him pay?"*. This matches the mental model of shopkeepers without requiring complex accounting knowledge.
3. **Zero Framework & Zero CSS Variable Architecture**:
   - Designed to run out of the box with zero build step, no Node.js/npm dependencies, and no stylesheet variable indirection, ensuring maximum compatibility across any browser or lightweight webview.
4. **Data Portability First**:
   - Built-in JSON export/import gives users full ownership of their data, enabling easy backup and migration without vendor lock-in.



## Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **No CSS Variables Constraint** | Structured a systematic color and spacing palette applied directly through standard CSS utility classes and selectors, maintaining visual consistency across components without custom properties. |
| **Audit Trail Accuracy on Edits** | Implemented a field-by-field diff detector in `app.js` that compares the pre-edit transaction with the post-edit transaction, capturing exact changes (e.g. `$320.00` &rarr; `$350.00`) and logging them into a persistent audit array. |
| **Accurate Running Balances** | Implemented a chronologically sorted balance calculator that handles credit additions, payment subtractions, and soft-deleted records without corrupting the historical sequence. |
| **Statement Printing Artifacts** | Designed print-specific CSS (`@media print`) that removes web navigation, header bars, and modal backdrops, rendering a clean black-and-white statement card for crisp physical printouts or PDF downloads. |



##  How to Run Locally
1. Clone or download this directory:
   ```bash
   git clone https://github.com/VivaMomentum/Kredit.git
   ```
2. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari).
3. No build tools, web servers, or package installations are required!
