# 🔐 Configuration Guide - Supabase & Stripe Setup

## ✅ What's Configured

### Supabase Credentials (DONE ✅)
All your Supabase credentials have been securely configured:

- **Project URL**: `https://cmoobysjpnypfvsudcap.supabase.co`
- **Anon Key**: Configured in `js/supabase-client.js` (frontend)
- **Service Role Key**: Configured in `api/supabase-admin.js` (backend)
- **Environment Variables**: Stored in `.env` file (ignored by git)

### Files Created:
1. ✅ `.env` - Your actual credentials (secure, git-ignored)
2. ✅ `.env.example` - Template with placeholders
3. ✅ `api/supabase-admin.js` - Server-side Supabase client with service role key

## 🔒 Security Notes

### ⚠️ CRITICAL: Service Role Key Security
The **service role key** bypasses all Row Level Security (RLS) policies. It should:
- ✅ ONLY be used in server-side code (API functions)
- ❌ NEVER be exposed in frontend JavaScript
- ✅ Be stored in environment variables
- ✅ Be kept in `.env` (which is git-ignored)

### Frontend vs Backend Keys:
- **Anon Key** (`js/supabase-client.js`): Safe for frontend, respects RLS
- **Service Role Key** (`api/supabase-admin.js`): Backend only, bypasses RLS

## 📋 Deployment Checklist

### For Vercel Deployment:
1. Go to your Vercel project dashboard
2. Navigate to: **Settings → Environment Variables**
3. Add these variables:

```
SUPABASE_URL = https://cmoobysjpnypfvsudcap.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtb29ieXNqcG55cGZ2c3VkY2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTY2NTksImV4cCI6MjA3NzU3MjY1OX0.71-BNiFoMGFFIOiA_sZd7nwIGDBJLmdLGfhADHZ3Z94
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtb29ieXNqcG55cGZ2c3VkY2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5NjY1OSwiZXhwIjoyMDc3NTcyNjU5fQ.U0djMpGHTlIn_pzegjlmdp0AILP6c5XVIRJoj9aKSy4
```

4. Click **Save**
5. Redeploy your app

### For Netlify Deployment:
1. Go to your Netlify site dashboard
2. Navigate to: **Site settings → Environment variables**
3. Add the same variables as above
4. Click **Save**
5. Trigger a new deploy

## 🎯 Testing Your Configuration

### Local Testing:
```bash
# 1. Start local server
python3 -m http.server 8000

# 2. Open in browser
open http://localhost:8000/login.html

# 3. Create a test account
# 4. Check that authentication works
```

### Verify Supabase Connection:
```bash
# Open browser console (F12) on login.html
# You should see no errors about Supabase connection
```

### Test Checklist:
- ✅ Can create new account
- ✅ Receive confirmation email
- ✅ Can sign in after confirming
- ✅ Redirected to main app after login
- ✅ User info displays in sidebar
- ✅ Generation count shows correctly
- ✅ Meal generation increments counter
- ✅ Paywall shows after 3 generations

## 🚀 Next Step: Stripe Integration

When you're ready to accept payments, follow these steps:

### 1. Create Stripe Account
- Sign up at https://stripe.com
- Complete account verification

### 2. Create Products in Stripe Dashboard
Go to **Products → Add Product** and create 3 products:

#### Product 1: Starter Plan
- Name: Starter Plan
- Price: $9.99/month
- Recurring: Monthly
- Copy the **Price ID** (starts with `price_`)

#### Product 2: Pro Plan
- Name: Pro Plan
- Price: $24.99/month
- Recurring: Monthly
- Copy the **Price ID**

#### Product 3: Unlimited Plan
- Name: Unlimited Plan
- Price: $49.99/month
- Recurring: Monthly
- Copy the **Price ID**

### 3. Get Your Stripe Keys
Go to **Developers → API Keys**:
- Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
- Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

### 4. Update .env File
Add to your `.env` file:
```bash
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PRICE_STARTER=price_your_starter_id_here
STRIPE_PRICE_PRO=price_your_pro_id_here
STRIPE_PRICE_UNLIMITED=price_your_unlimited_id_here
```

### 5. Update pricing.html
Replace the placeholder price IDs in `pricing.html`:
```javascript
// Line ~85, ~115, ~145
onclick="selectPlan('starter', 'price_YOUR_ACTUAL_STARTER_ID')"
onclick="selectPlan('pro', 'price_YOUR_ACTUAL_PRO_ID')"
onclick="selectPlan('unlimited', 'price_YOUR_ACTUAL_UNLIMITED_ID')"
```

### 6. Implement Checkout Session Endpoint
Update `api/create-checkout-session.js` to create Stripe checkout sessions.

### 7. Create Webhook Handler
Create `api/stripe-webhook.js` to handle subscription events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 8. Test Payment Flow
1. Click "Upgrade" button
2. Complete Stripe checkout
3. Verify subscription in Stripe Dashboard
4. Check that user's generation limit updates in database

## 📂 File Structure

```
perfect-plate/
├── .env                          # Your actual credentials (git-ignored)
├── .env.example                  # Template for others
├── .gitignore                    # Protects .env
├── js/
│   ├── supabase-client.js        # Frontend Supabase (anon key)
│   ├── auth.js                   # Auth functions
│   └── app.js                    # Main app logic
├── api/
│   ├── supabase-admin.js         # Backend Supabase (service key) ⚠️
│   ├── generate-plan.js          # Meal generation
│   └── create-checkout-session.js # Stripe checkout (TODO)
├── login.html                    # Sign in/up page
├── pricing.html                  # Subscription pricing
└── index.html                    # Main app
```

## 🐛 Troubleshooting

### "Supabase client not defined" error
- Check that `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` is in your HTML
- Ensure `js/supabase-client.js` is loaded before `js/app.js`

### "Invalid API key" error
- Verify your credentials in `.env` match Supabase Dashboard
- Check for extra spaces or line breaks in the keys

### Authentication not working
1. Check Supabase Dashboard → Authentication → Settings
2. Verify "Enable Email Confirmations" setting
3. For testing, you can disable email confirmation temporarily

### RLS Policy errors
- Ensure you ran the SQL setup script in Supabase SQL Editor
- Check Table Editor → Profiles → RLS is enabled
- Verify policies exist in SQL Editor → Policies tab

## 📞 Support

If you run into issues:
1. Check browser console for JavaScript errors
2. Check Supabase Dashboard → Logs for database errors
3. Verify all environment variables are set correctly
4. Review `AUTH_IMPLEMENTATION_COMPLETE.md` for testing guide

---

## ✅ Current Status

**COMPLETED:**
- ✅ Supabase credentials configured
- ✅ Database tables created
- ✅ Authentication system implemented
- ✅ Usage tracking working
- ✅ Frontend/backend separation secure
- ✅ Environment variables protected

**TODO:**
- ⏳ Stripe products creation
- ⏳ Checkout session implementation
- ⏳ Webhook handler for subscriptions
- ⏳ Test payment flow

**You're ready to test authentication! 🎉**
