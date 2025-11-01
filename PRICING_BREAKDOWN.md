# Perfect Plate Pricing Breakdown

## 📊 Cost Analysis

### Gemini API Costs (gemini-2.0-flash)
- **Input tokens:** $0.075 per 1M tokens
- **Output tokens:** $0.30 per 1M tokens

### Per Generation Cost
- Average input: ~2,000 tokens
- Average output: ~2,000 tokens
- **Cost per generation:** ~$0.00075

---

## 💰 Pricing Tiers

### Free Plan
- **Price:** $0/month
- **Generations:** 3 per month
- **Cost to us:** $0.00225/month
- **Profit margin:** N/A (acquisition tier)

### Starter Plan
- **Price:** $4.99/month
- **Generations:** 30 per month
- **Cost to us:** $0.0225/month
- **Profit:** $4.97/month
- **Profit margin:** 99.5% 💰

### Pro Plan (Most Popular)
- **Price:** $9.99/month
- **Generations:** 100 per month
- **Cost to us:** $0.075/month
- **Profit:** $9.92/month
- **Profit margin:** 99.2% 💰

### Unlimited Plan
- **Price:** $19.99/month
- **Generations:** Unlimited (estimated 500/month average)
- **Cost to us:** $0.375/month (at 500 generations)
- **Profit:** $19.62/month
- **Profit margin:** 98.1% 💰

---

## 🎯 Revenue Projections

### Conservative Estimate (100 users)
- 70 Free users = $0
- 15 Starter users = $74.85/month
- 10 Pro users = $99.90/month
- 5 Unlimited users = $99.95/month

**Monthly Revenue:** $274.70
**Monthly Costs:** ~$5.55
**Net Profit:** $269.15
**Profit Margin:** 97.9%

### Growth Target (1,000 users)
- 700 Free users = $0
- 150 Starter users = $748.50/month
- 100 Pro users = $999/month
- 50 Unlimited users = $999.50/month

**Monthly Revenue:** $2,747/month
**Monthly Costs:** ~$55.50
**Net Profit:** $2,691.50/month
**Profit Margin:** 98.0%

---

## 📈 Stripe Price IDs (To Be Created)

When setting up Stripe products, create these Price IDs:
- `price_starter_4_99` - Starter Plan ($4.99/month)
- `price_pro_9_99` - Pro Plan ($9.99/month)
- `price_unlimited_19_99` - Unlimited Plan ($19.99/month)

---

## 🔐 Database Mapping

### Subscription Tiers → Generation Limits
```sql
'free' → monthly_generation_limit = 3
'starter' → monthly_generation_limit = 30
'pro' → monthly_generation_limit = 100
'unlimited' → monthly_generation_limit = -1 (unlimited)
```

---

## 💡 Notes

1. **Extremely high profit margins** due to low API costs
2. **Scalable model** - costs grow linearly with usage
3. **No infrastructure costs** - using Vercel (free tier) and Supabase (free tier)
4. **Room for promotions** - Can offer discounts and still maintain 90%+ margins
5. **Competitive pricing** - Similar services charge $20-50/month for comparable features

---

## 🚀 Next Steps

1. Create Stripe account
2. Set up Stripe Products and Prices
3. Add Stripe API keys to `.env`
4. Implement Stripe Checkout integration
5. Set up webhook for subscription events
6. Test payment flow end-to-end
