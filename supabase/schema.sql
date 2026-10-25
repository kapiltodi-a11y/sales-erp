-- ==============================================================================
-- SALES ERP & FIELD VISIT TRACKING SYSTEM - SUPABASE SQL SCHEMA
-- Run this script in your Supabase Project's SQL Editor (Dashboard -> SQL Editor)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Sales Representatives Table
CREATE TABLE IF NOT EXISTS public.sales_reps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    employee_id VARCHAR(100),
    designation VARCHAR(150) DEFAULT 'Field Sales Representative',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Client Visits Table
CREATE TABLE IF NOT EXISTS public.client_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_rep_id UUID REFERENCES public.sales_reps(id) ON DELETE SET NULL,
    sales_rep_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255), -- Backwards compatibility alias
    address_option_a TEXT NOT NULL, -- Visiting card or manually entered address
    address_option_b TEXT, -- Auto-detected locked GPS address
    client_address TEXT, -- General address fallback
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
    office_photo_url TEXT NOT NULL,
    ocr_raw_text TEXT,
    ocr_extracted_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration for existing databases: Add new columns if table already exists
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS address_option_a TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS address_option_b TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS contact_person_email VARCHAR(255);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS visiting_card_front_url TEXT;
ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS visiting_card_back_url TEXT;

-- Update business_name from client_name for legacy rows
UPDATE public.client_visits SET business_name = client_name WHERE business_name IS NULL AND client_name IS NOT NULL;
UPDATE public.client_visits SET address_option_a = client_address WHERE address_option_a IS NULL AND client_address IS NOT NULL;

-- 4. Create Indexes for High Performance Queries & Duplicate Prevention
CREATE INDEX IF NOT EXISTS idx_visits_sales_rep_id ON public.client_visits(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_time ON public.client_visits(visit_time DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.client_visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_business_name ON public.client_visits(business_name);

-- Prevent duplicate business names (case-insensitive)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_visits_unique_business_name'
    ) THEN
        BEGIN
            CREATE UNIQUE INDEX idx_visits_unique_business_name ON public.client_visits (LOWER(TRIM(business_name)));
        EXCEPTION WHEN unique_violation THEN
            RAISE NOTICE 'Existing duplicate business names detected; unique index skipped until cleaned.';
        END;
    END IF;
END $$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_visits ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
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

-- 7. Insert Initial Sample Sales Team Members
INSERT INTO public.sales_reps (name, email, phone, employee_id, designation, is_active)
VALUES 
    ('Rahul Sharma', 'rahul.sharma@example.com', '+91 98765 43210', 'EMP-101', 'Senior Sales Executive', true),
    ('Priya Patel', 'priya.patel@example.com', '+91 98765 43211', 'EMP-102', 'Field Sales Specialist', true),
    ('Amit Verma', 'amit.verma@example.com', '+91 98765 43212', 'EMP-103', 'Business Development Rep', true)
ON CONFLICT DO NOTHING;

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
