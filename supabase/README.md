# Supabase Setup Guide for Sales ERP

Follow these steps to connect your Sales ERP with your free Supabase project:

## 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **"New project"**.
3. Choose an organization, enter a name (e.g., `sales-erp`), set a database password, and select your preferred region.
4. Click **"Create new project"** (takes ~1-2 minutes to provision).

## 2. Run the SQL Schema
1. In your Supabase dashboard, click on **"SQL Editor"** (icon with `>_` on the left sidebar).
2. Click **"New query"**.
3. Open the file `supabase/schema.sql` from this repository, copy all the contents, and paste it into the SQL Editor.
4. Click the green **"Run"** button in the bottom-right corner.
5. You should see `Success. No rows returned` - your tables (`sales_reps`, `client_visits`) and storage bucket (`visit-photos`) are now created!

## 3. Retrieve Your Supabase API Credentials
1. In your Supabase dashboard, go to **Project Settings** (gear icon at the bottom of the left sidebar).
2. Click on **API** in the configuration menu.
3. Look for:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> find the `anon` / `public` key (long JWT string).

## 4. Connect in the Sales ERP Web App
You have two quick ways to connect:
- **Option A (Instant in the Web UI)**: Open the web application, go to the **Settings** tab, scroll to **Supabase Connection Settings**, paste your URL and Anon Key, and click **Save & Test Connection**.
- **Option B (In code)**: Open `js/config.js` and set:
  ```javascript
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-public-key-here"
  ```

## 5. Storage Buckets (Already handled by the SQL script)
The SQL script automatically created the `visit-photos` public storage bucket. If you ever need to view the uploaded visiting cards and office photos directly, go to **Storage -> Buckets -> visit-photos** in your Supabase dashboard.
