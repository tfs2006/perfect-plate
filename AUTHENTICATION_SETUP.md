# Perfect Plate - Full Authentication & Payment Setup Guide

## Overview
This guide will help you implement a complete user authentication system with Stripe subscriptions, user profiles, saved meals, and usage tracking.

## Architecture

### Technology Stack
- **Frontend**: Current HTML/JS/TailwindCSS
- **Authentication**: Supabase Auth (email/password + Google OAuth)
- **Database**: Supabase PostgreSQL
- **Payments**: Stripe Subscriptions
- **Backend**: Vercel Serverless Functions
- **Storage**: Supabase Storage (for user data)

---

## Step 1: Set Up Supabase (Free Tier)

### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Click "Start your project"
3. Create a new project called "perfect-plate"
4. Note your:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon Public Key**: `eyJhb...`
   - **Service Role Key**: `eyJhb...` (keep secret!)

### 1.2 Create Database Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'starter', 'pro', 'unlimited'
  subscription_status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due'
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE
);

-- Saved meals
CREATE TABLE public.saved_meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  meal_type TEXT, -- 'Breakfast', 'Lunch', 'Dinner'
  meal_data JSONB NOT NULL, -- Full meal object with ingredients, steps, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_favorite BOOLEAN DEFAULT false
);

-- Saved grocery lists
CREATE TABLE public.saved_grocery_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL,
  grocery_data JSONB NOT NULL, -- Full grocery list grouped by category
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking (generations per month)
CREATE TABLE public.usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  meal_types TEXT[], -- ['Breakfast', 'Lunch'] - which meals were generated
  year_month TEXT NOT NULL, -- '2025-11' for grouping
  UNIQUE(user_id, generation_date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own saved meals" ON public.saved_meals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own grocery lists" ON public.saved_grocery_lists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON public.usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get monthly usage count
CREATE OR REPLACE FUNCTION get_monthly_usage(p_user_id UUID, p_year_month TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.usage_tracking
  WHERE user_id = p_user_id AND year_month = p_year_month;
$$ LANGUAGE SQL STABLE;
```

---

## Step 2: Set Up Stripe Products

### 2.1 Create Products in Stripe Dashboard

1. Go to https://dashboard.stripe.com/products
2. Create 3 products:

**Product 1: Starter Plan**
- Name: "Perfect Plate Starter"
- Description: "30 meal generations per month"
- Price: $9.99/month recurring
- Metadata: `generation_limit: 30`

**Product 2: Pro Plan**
- Name: "Perfect Plate Pro"
- Description: "100 meal generations per month"
- Price: $24.99/month recurring
- Metadata: `generation_limit: 100`

**Product 3: Unlimited Plan**
- Name: "Perfect Plate Unlimited"
- Description: "Unlimited meal generations"
- Price: $49.99/month recurring
- Metadata: `generation_limit: -1` (unlimited)

### 2.2 Note Your Stripe Keys
- **Publishable Key**: `pk_test_...` (for frontend)
- **Secret Key**: `sk_test_...` (for backend)
- **Webhook Secret**: `whsec_...` (after setting up webhook)

### 2.3 Get Price IDs
After creating products, note the **Price IDs**:
- Starter: `price_xxxxx`
- Pro: `price_yyyyy`
- Unlimited: `price_zzzzz`

---

## Step 3: Environment Variables

Create `.env.local` file (add to .gitignore):

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
VITE_STRIPE_PRICE_STARTER=price_xxxxx
VITE_STRIPE_PRICE_PRO=price_yyyyy
VITE_STRIPE_PRICE_UNLIMITED=price_zzzzz

# Gemini API
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
```

---

## Step 4: Vercel Configuration

Update `vercel.json`:

```json
{
  "buildCommand": "echo 'No build needed'",
  "outputDirectory": ".",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    }
  ],
  "env": {
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
    "STRIPE_SECRET_KEY": "@stripe-secret-key",
    "STRIPE_WEBHOOK_SECRET": "@stripe-webhook-secret"
  }
}
```

---

## Step 5: File Structure

```
perfect-plate/
├── index.html                    # Main app (updated with auth)
├── login.html                    # Login/signup page
├── profile.html                  # User dashboard
├── js/
│   ├── app.js                    # Main app logic (updated)
│   ├── auth.js                   # NEW: Authentication logic
│   ├── supabase-client.js        # NEW: Supabase initialization
│   ├── stripe-client.js          # NEW: Stripe checkout logic
│   └── settings.js               # API config
├── api/
│   ├── generate-plan.js          # Existing (add auth check)
│   ├── create-checkout.js        # NEW: Create Stripe checkout
│   ├── stripe-webhook.js         # NEW: Handle Stripe events
│   ├── save-meal.js              # NEW: Save meal to profile
│   ├── save-grocery-list.js      # NEW: Save grocery list
│   └── check-usage.js            # NEW: Check generation limits
└── css/
    └── style.css                 # Existing styles
```

---

## Step 6: Implementation Order

1. ✅ Set up Supabase project and database
2. ✅ Add Supabase client to frontend
3. ✅ Create login/signup page
4. ✅ Add authentication check to app
5. ✅ Create Stripe products
6. ✅ Implement subscription flow
7. ✅ Add usage tracking
8. ✅ Create profile/dashboard page
9. ✅ Add save meals feature
10. ✅ Add save grocery lists feature
11. ✅ Test full flow

---

## Cost Analysis

### Per-Generation Cost Breakdown:
- **Gemini API**: ~$0.005-0.01 (depending on token usage)
- **Vercel hosting**: ~$0.001 per invocation
- **Supabase**: Free tier covers 500MB storage + 50K requests
- **Total per generation**: ~$0.01

### Monthly Profit Per Plan:
- **Starter** (30 gens): Revenue $9.99 - Cost $0.30 = **$9.69 profit (97% margin)**
- **Pro** (100 gens): Revenue $24.99 - Cost $1.00 = **$23.99 profit (96% margin)**
- **Unlimited** (~250 gens): Revenue $49.99 - Cost $2.50 = **$47.49 profit (95% margin)**

---

## Next Steps

Would you like me to implement:
1. The authentication system first?
2. The Stripe integration?
3. The user dashboard?
4. All of the above step by step?

Let me know and I'll start building!
