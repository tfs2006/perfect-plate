-- ============================================
-- SIMPLIFIED DATABASE SETUP FOR PERFECT PLATE
-- Run this in Supabase SQL Editor
-- ============================================

-- IMPORTANT: Drop existing tables to start fresh
-- This will delete all existing data!
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS saved_grocery_lists CASCADE;
DROP TABLE IF EXISTS saved_meals CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'unlimited')),
    monthly_generation_limit INTEGER DEFAULT 3,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='profiles' AND column_name='monthly_generation_limit') THEN
        ALTER TABLE profiles ADD COLUMN monthly_generation_limit INTEGER DEFAULT 3;
    END IF;
END $$;

-- Update existing profiles to have monthly_generation_limit
UPDATE profiles 
SET monthly_generation_limit = 3 
WHERE monthly_generation_limit IS NULL AND subscription_tier = 'free';

UPDATE profiles 
SET monthly_generation_limit = 30 
WHERE monthly_generation_limit IS NULL AND subscription_tier = 'starter';

UPDATE profiles 
SET monthly_generation_limit = 100 
WHERE monthly_generation_limit IS NULL AND subscription_tier = 'pro';

UPDATE profiles 
SET monthly_generation_limit = -1 
WHERE monthly_generation_limit IS NULL AND subscription_tier = 'unlimited';

-- ============================================
-- 2. USAGE TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month_start TIMESTAMPTZ NOT NULL,
    generation_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_start)
);

-- Add missing column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='usage_tracking' AND column_name='generation_count') THEN
        ALTER TABLE usage_tracking ADD COLUMN generation_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- 3. SAVED MEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS saved_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name TEXT NOT NULL,
    meal_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SAVED GROCERY LISTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS saved_grocery_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    list_name TEXT NOT NULL,
    list_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_grocery_lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can view own meals" ON saved_meals;
DROP POLICY IF EXISTS "Users can insert own meals" ON saved_meals;
DROP POLICY IF EXISTS "Users can delete own meals" ON saved_meals;
DROP POLICY IF EXISTS "Users can view own grocery lists" ON saved_grocery_lists;
DROP POLICY IF EXISTS "Users can insert own grocery lists" ON saved_grocery_lists;
DROP POLICY IF EXISTS "Users can delete own grocery lists" ON saved_grocery_lists;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Usage tracking policies
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage" ON usage_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

-- Saved meals policies
CREATE POLICY "Users can view own meals" ON saved_meals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals" ON saved_meals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals" ON saved_meals
    FOR DELETE USING (auth.uid() = user_id);

-- Saved grocery lists policies
CREATE POLICY "Users can view own grocery lists" ON saved_grocery_lists
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery lists" ON saved_grocery_lists
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery lists" ON saved_grocery_lists
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. AUTOMATIC PROFILE CREATION TRIGGER
-- ============================================

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, subscription_tier, monthly_generation_limit)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        'free',
        3
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month ON usage_tracking(user_id, month_start);
CREATE INDEX IF NOT EXISTS idx_saved_meals_user ON saved_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_grocery_lists_user ON saved_grocery_lists(user_id);

-- ============================================
-- DONE! 
-- ============================================
SELECT 'Database setup complete! ✅' as status;
