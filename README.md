# SalesERP - Field Visit & Sales Tracking Web App

A modern, responsive field sales ERP web application designed for mobile sales teams on the move and sales management. It enables field sales representatives to capture daily client visits with live GPS verification, auto-fetched visiting card OCR data (Camera & PDF support for Front & Back), mandatory office/shop photo capture, contact details, and meeting statuses, while providing management with a comprehensive day-wise and rep-wise dashboard with full search, filters, 11:30 AM follow-up reminders, and Excel/CSV download.

---

## 🌟 Key Features

### 1. Mobile Field Visit Logger (for Sales Reps)
- **Zero App Download**: Accessible via a simple web link on any iPhone or Android phone.
- **Visiting Card Auto-Fetch (Front & Back)**:
  - Supports direct **Camera capture** and **PDF / Photo document upload** for both Front and Back of the card.
  - Client-side AI OCR (Tesseract.js & PDF.js) automatically extracts and auto-fills:
    - **Business / Company Name**
    - **Contact Person Name**
    - **Mobile Number**
    - **Email ID**
    - **Pin Code**
    - **Physical Address**
- **Business Name with Duplicate Prevention**:
  - Automatically prevents duplicate business names whether entered manually or auto-detected via visiting card OCR.
  - Real-time check highlights existing clients, shows who visited them previously and on what date, and strictly blocks duplicate submissions.
- **Dual Address Verification (Option A & Option B)**:
  - **Option A**: Address auto-picked from the visiting card or manually entered.
  - **Option B**: Tamper-proof, auto-detected live GPS coordinates and street address locked from manual salesperson tampering.
- **Mandatory Office / Shop Photo**: Enforces camera access to photograph the client office or storefront before submission.
- **Meeting Status**:
  - `Successful Closed` (with celebration animations)
  - `Follow-up Required` (with follow-up date selector)
- **Automatic 11:30 AM Follow-Up Reminder**:
  - Upon selecting a follow-up date, an automatic reminder is scheduled for **11:30 AM** on that date.
  - 1-click **Set Phone Alarm (.ics Calendar)**: Downloads an iCalendar file with an audible alarm configured for 11:30 AM that syncs into iPhone (Apple Calendar), Android, or Outlook.
  - 1-click **Add to Google Calendar**: Direct web calendar event creation.
- **Detailed Remarks**: Discussion notes, pricing quotes, client requirements, and action items.

### 2. Sales Rep Data Privacy & Role-Based Access Control
- **Representative Data Isolation**:
  - One sales representative **CANNOT** view another sales representative's visits, remarks, client phone numbers, or private notes.
  - The dashboard automatically filters strictly to the logged-in sales representative.
  - Sales representative filter is locked in rep mode with a clear privacy indicator.
- **Header Profile Switcher**:
  - 1-tap switcher allows testing or toggling between different sales representative profiles.
- **PIN-Protected Manager / Admin Mode**:
  - Unlocked via 4-digit PIN (default: `1234`).
  - Allows sales leadership and managers to view all reps, filter across all visits, access Settings, and download company-wide Excel reports.

### 3. Common Business / Company Name Highlighting
- **Cross-Rep Shared Accounts**:
  - Automatically detects when a business/company name has been visited or is handled by multiple sales representatives in the team.
- **Visual Highlighting on Dashboard**:
  - Every visit belonging to a common account receives a prominent glowing purple highlight border (`border-2 border-purple-400 bg-purple-50/20`), an account badge, and a callout showing which other sales reps also visited this client.
- **Quick Filter Toggle**:
  - Filter bar includes `[ ] 🏢 Show Common Accounts Only` to isolate cross-rep client accounts with a single click.
- **Form-Level Awareness**:
  - Entering or scanning a company name that other sales reps handle highlights the account as a Common Account while preventing accidental duplicate records by the same rep.

### 4. Personal Data Download & In-App MIS Reports
- **Personal Visit Data Download**:
  - Each sales representative can download **their own data** in Excel (`.xlsx`) or CSV format containing only their visits.
  - Filename dynamically generated as `My_Sales_Visits_[RepName]_[Date].xlsx`.
- **Management Information System (MIS) Report**:
  - Direct 1-tap access on Desktop navigation, Mobile bottom bar, and Dashboard (`📊 My MIS Report`).
  - **Period Selectors**: All Time, This Month, Past 7 Days, or Today.
  - **Executive Performance Scorecard**:
    - Total Client Visits Completed
    - Deals Successfully Closed (Won)
    - Follow-up Pipeline in Progress
    - Conversion Efficiency Rate % (`Closed / Total * 100`)
    - Common Accounts Count
  - **Visual Deal Pipeline Progress Bar**:
    - Graphical breakdown of Closed Won % vs Follow-up Pipeline %.
  - **Common Accounts Overlap Table**:
    - Complete summary of shared corporate clients and cross-rep overlap.
  - **Tabular Visit Activity Ledger**:
    - Formatted table of all visits in the selected period with Option A & Option B (tamper-proof GPS) addresses and 11:30 AM follow-up dates.
  - **1-Click Download MIS (.xlsx)**:
    - Generates a multi-sheet formatted Excel workbook with SheetJS:
      1. `MIS Performance Scorecard`
      2. `Visit Activity Ledger`
      3. `Common Accounts Overlap`
  - **Print / Save as PDF**:
    - Optimized print layout for sending directly to printers or exporting to PDF.

### 5. Admin & Manager Software (Visits Dashboard)
- **Today's Follow-up Reminders (11:30 AM) Alert Banner**:
  - Automatically highlights all clients scheduled for follow-up today at 11:30 AM.
  - 1-tap **Call** (`tel:`), **WhatsApp** (`wa.me`), and **Alarm Sync** buttons.
- **Sales Person-wise Tracking**: Filter visits by any specific sales team member.
- **Day-wise & Date Filtering**: Filter by Today, Yesterday, Past 7 Days, or a specific calendar date.
- **Status Filter**: Instantly isolate closed deals vs. deals requiring follow-up.
- **Comprehensive Excel (.xlsx) & CSV Download**:
  - 1-click export formatted with SheetJS containing all sales people, visit dates, business names, addresses (Option A & Option B), GPS coordinates, Google Maps links, contact details, email, pin code, remarks, and photo URLs.
- **Interactive Lightbox**: Fullscreen inspection of visiting cards (front & back images or PDFs) and office storefront photos.

### 5. Multi-Tier Role Hierarchy & Granular Access Control
- **1. Sales Representative (`👤 Sales Rep`)**:
  - **No Access to Settings**: The Settings tab is hidden from navigation (desktop header and mobile bottom bar) and direct access is strictly blocked.
  - **Private Mode**: Can only see their own visits, remarks, and statistics.
  - **Personal Downloads**: Can download an Excel / CSV file containing only their visits.
  - **Personal MIS**: Can view and export personal performance scorecards and activity ledgers.
- **2. Senior Sales Representative (`⭐ Sr. Sales Rep`)**:
  - **Access to All Functions**:
    - Record new visits for self or team.
    - Full Dashboard visibility across **all sales representatives** in the company.
    - Complete access to all filters (by any rep, date, status, common accounts).
    - Company-wide Excel (`.xlsx`) and CSV downloads.
    - Company-wide MIS performance reports with multi-sheet export.
    - **Access to Settings Tab**: Unlocked directly without requiring a manager PIN.
  - **Settings Restrictions (Add/Delete Sales Reps Only)**:
    - Dedicated **Role / Designation Column** in the Sales Team Directory table (`⭐ Sr. Sales Rep` vs `👤 Sales Rep`).
    - **Can Add Sales Reps**: Can create new field Sales Representatives.
    - **Can Delete Sales Reps**: Can remove regular Sales Reps. Cannot delete another Sr. Sales Rep (protected status).
    - **Database Security**: Supabase cloud credentials and connection configuration are locked to Admin mode to prevent unauthorized database changes.
- **3. Manager / Admin Mode (`👑 Admin Mode`)**:
  - Unlocked via PIN (default: `1234`).
  - Full system control, including adding/deleting Sr. Sales Reps and modifying Supabase cloud database keys.

### 6. Settings & Sales Team Management
- **Role / Type Column**: Clear visual distinction between `⭐ Sr. Sales Rep` and `👤 Sales Rep`.
- **Add Team Members**: Role selector allows assigning `Sales Rep` or `Sr. Sales Rep`.
- **Safe Deletion**: Deletion permissions enforced in real-time according to role.
- **Supabase Cloud Sync**:
  - Input your Supabase Project URL and Anon Public Key.
  - Live connection tester and schema health check.
  - Ready-to-copy SQL schema script.
- **Offline / Demo Mode**: Works immediately in any browser even without setting up Supabase first!

---

## 🚀 How to Deploy to GitHub & Get the Mobile Web Link

Since this app is built with standard HTML5, CSS, and modern JavaScript (with CDNs for Tailwind CSS, Lucide icons, Supabase, SheetJS, PDF.js, and Tesseract.js), it requires **zero build steps** and can be deployed directly to **GitHub Pages** for free!

### Step 1: Initialize Git and Push to GitHub
In terminal:
```bash
git init
git add .
git commit -m "Initial commit: Sales ERP field visit software"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sales-erp.git
git push -u origin main
```

### Step 2: Enable GitHub Pages
1. Go to your repository on [GitHub](https://github.com).
2. Click **Settings** (gear icon) -> **Pages** (in the left sidebar).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and folder `/ (root)`.
4. Click **Save**.
5. Within 1-2 minutes, GitHub will display your live public HTTPS link:
   ```
   https://YOUR_USERNAME.github.io/sales-erp/
   ```
6. **Share this link with your sales team!** They can bookmark it or tap **"Add to Home Screen"** on their iPhone or Android to use it like a native app.

---

## 🗄️ Supabase Database & Storage Setup (Takes 2 Minutes)

1. Create a free account at [supabase.com](https://supabase.com) and click **"New Project"**.
2. Once the project is created, click on **SQL Editor** on the left menu.
3. Open the file `supabase/schema.sql` in this repository, copy all the SQL code, and paste it into the Supabase SQL editor.
4. Click **Run**. This will automatically create:
   - `sales_reps` table (for team member directory)
   - `client_visits` table (with columns for `business_name`, `address_option_a`, `address_option_b`, `contact_person_email`, `pincode`, `visiting_card_front_url`, `visiting_card_back_url`, and `office_photo_url`)
   - `visit-photos` storage bucket
   - Public Row Level Security (RLS) policies.
5. In your Supabase dashboard, go to **Project Settings** -> **API**.
6. Copy:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public`
7. Open your deployed web app, go to the **Settings** tab, scroll to **Supabase Cloud Sync**, paste your URL and Anon Key, and click **Save & Test Connection**.

---

## 📁 File Structure

```
sales-erp/
├── index.html                   # Main single-page application shell
├── js/
│   ├── app.js                   # Unified bundle with OCR, GPS, PDF.js, SheetJS & Alarm logic
│   ├── config.js                # Default Supabase configuration
│   ├── supabaseClient.js        # Supabase client wrapper & local storage fallback
│   ├── ocrService.js            # Tesseract OCR & text parsing engine
│   ├── locationService.js       # Geolocation & reverse geocoding
│   ├── teamService.js           # Sales team member management
│   └── visitService.js          # Visit CRUD operations
├── css/
│   └── styles.css               # Custom styles & animations
└── supabase/
    └── schema.sql               # Database tables, RLS policies, storage bucket & migrations
```
