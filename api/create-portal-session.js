// Vercel Serverless Function - Create Stripe Customer Portal Session
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = require('stripe')(STRIPE_SECRET_KEY);
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    // Create a portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin || 'https://perfectplate.4ourmedia.com'}/profile.html`,
    });

    console.log('✅ Customer portal session created for:', customerId);

    return res.status(200).json({
      url: session.url
    });
  } catch (error) {
    console.error('❌ Error creating customer portal session:', error);
    return res.status(500).json({ 
      error: 'Failed to create customer portal session',
      message: error.message 
    });
  }
};
