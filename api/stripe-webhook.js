// Vercel Serverless Function - Stripe Webhook Handler
const { createClient } = require('@supabase/supabase-js');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = require('stripe')(STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Stripe webhook received:', event.type);

  // Initialize Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const customerEmail = session.customer_email;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        console.log('💳 Checkout completed for user:', userId);

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;

        // Determine tier based on price ID
        let tier = 'free';
        let generationLimit = 3;
        
        if (priceId === process.env.STRIPE_PRICE_STARTER) {
          tier = 'starter';
          generationLimit = 30;
        } else if (priceId === process.env.STRIPE_PRICE_PRO) {
          tier = 'pro';
          generationLimit = 100;
        } else if (priceId === process.env.STRIPE_PRICE_UNLIMITED) {
          tier = 'unlimited';
          generationLimit = -1;
        }

        // Update user profile
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            monthly_generation_limit: generationLimit,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (error) {
          console.error('❌ Error updating profile:', error);
          throw error;
        }

        console.log(`✅ User ${userId} upgraded to ${tier} plan`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Find user by stripe subscription ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (!profile) {
          console.log('⚠️ No profile found for subscription:', subscription.id);
          break;
        }

        // Update subscription status
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (error) {
          console.error('❌ Error updating subscription:', error);
          throw error;
        }

        console.log(`✅ Subscription updated for user ${profile.id}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Find user by stripe subscription ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (!profile) {
          console.log('⚠️ No profile found for subscription:', subscription.id);
          break;
        }

        // Downgrade to free tier
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            monthly_generation_limit: 3,
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (error) {
          console.error('❌ Error downgrading user:', error);
          throw error;
        }

        console.log(`✅ User ${profile.id} downgraded to free tier`);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return res.status(500).json({ error: error.message });
  }
};
