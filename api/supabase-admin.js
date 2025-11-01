// Supabase Admin Client (Server-side only - uses service role key)
// WARNING: Only use this in server-side code (Vercel functions, Netlify functions, etc.)
// NEVER import this in frontend code!

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://cmoobysjpnypfvsudcap.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtb29ieXNqcG55cGZ2c3VkY2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk5NjY1OSwiZXhwIjoyMDc3NTcyNjU5fQ.U0djMpGHTlIn_pzegjlmdp0AILP6c5XVIRJoj9aKSy4';

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabaseAdmin };
