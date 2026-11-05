-- ==============================================================================
-- SALES ERP & FIELD VISIT TRACKING SYSTEM - SUPABASE SQL SCHEMA
-- Run this script in your Supabase Project's SQL Editor (Dashboard -> SQL Editor)
-- Direct URL: https://supabase.com/dashboard/project/vdgmbqhjzpxwhndnpocq/sql/new
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Sales Representatives Table
CREATE TABLE IF NOT EXISTS public.sales_reps (
    id TEXT PRIMARY KEY DEFAULT ('rep-' || substr(md5(random()::text), 1, 8)),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    employee_id VARCHAR(100),
    role_type VARCHAR(50) DEFAULT 'sales_rep', -- 'sales_rep' or 'sr_sales_rep'
    designation VARCHAR(150) DEFAULT 'Field Sales Representative',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Client Visits Table
CREATE TABLE IF NOT EXISTS public.client_visits (
    id TEXT PRIMARY KEY,
    sales_rep_id TEXT,
    sales_rep_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(100),
    business_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255), -- Backwards compatibility alias
    address_option_a TEXT,    -- Visiting card or manually entered address
    address_option_b TEXT,    -- Auto-detected locked GPS address
    client_address TEXT,      -- General address fallback
    visit_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_address TEXT,
    contact_person_name VARCHAR(255) NOT NULL,
    contact_person_phone VARCHAR(50) NOT NULL,
    contact_person_email VARCHAR(255),
    pincode VARCHAR(20),
    status VARCHAR(50) NOT NULL DEFAULT 'Follow-up Required', -- 'Successful Closed' or 'Follow-up Required'
    follow_up_date DATE,
    remarks TEXT,
    visiting_card_front_url TEXT,
    visiting_card_back_url TEXT,
    visiting_card_url TEXT, -- Backward compatibility
    office_photo_url TEXT,
    ocr_raw_text TEXT,
    ocr_extracted_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrations for existing databases: Add columns safely if tables already exist
ALTER TABLE public.sales_reps ADD COLUMN IF NOT EXISTS role_type VARCHAR(50) DEFAULT 'sales_rep';
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS address_option_a TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS address_option_b TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS contact_person_email VARCHAR(255);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS visiting_card_front_url TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS visiting_card_back_url TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS office_photo_url TEXT;

-- Update business_name from client_name for legacy rows
UPDATE public.client_visits SET business_name = client_name WHERE business_name IS NULL AND client_name IS NOT NULL;
UPDATE public.client_visits SET address_option_a = client_address WHERE address_option_a IS NULL AND client_address IS NOT NULL;

-- 4. Create Indexes for High Performance Queries
CREATE INDEX IF NOT EXISTS idx_visits_sales_rep_id ON public.client_visits(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_time ON public.client_visits(visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.client_visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_business_name ON public.client_visits(business_name);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies (Full Read/Write Access for Sales ERP Mobile & Web)
DROP POLICY IF EXISTS "Public access to sales reps" ON public.sales_reps;
CREATE POLICY "Public access to sales reps" 
    ON public.sales_reps 
    FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to client visits" ON public.client_visits;
CREATE POLICY "Public access to client visits" 
    ON public.client_visits 
    FOR ALL 
    TO anon, authenticated 
    USING (true) 
    WITH CHECK (true);

-- 7. Insert/Seed Permanent Team Members
INSERT INTO public.sales_reps (id, name, email, phone, employee_id, role_type, designation, is_active)
VALUES 
    ('rep-001', 'Kapil Todi', 'kapil.todi@gmail.com', '+91 97696 61978', 'EMP-101', 'sr_sales_rep', 'Sr. Sales Rep', true),
    ('rep-002', 'Supriya Yadav', 'supriya.yadav@example.com', '+91 98765 43211', 'EMP-102', 'sales_rep', 'Sales Rep', true),
    ('rep-003', 'Kalyani Mundada', 'kalyani.mundada@example.com', '+91 98765 43212', 'EMP-103', 'sales_rep', 'Sales Rep', true)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    employee_id = EXCLUDED.employee_id,
    role_type = EXCLUDED.role_type,
    designation = EXCLUDED.designation;

-- 8. Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public access to visit photos" ON storage.objects;
CREATE POLICY "Public access to visit photos"
    ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id = 'visit-photos')
    WITH CHECK (bucket_id = 'visit-photos');
