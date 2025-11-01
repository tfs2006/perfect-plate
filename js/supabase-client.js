// Supabase client initialization
const SUPABASE_URL = 'https://cmoobysjpnypfvsudcap.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtb29ieXNqcG55cGZ2c3VkY2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTY2NTksImV4cCI6MjA3NzU3MjY1OX0.71-BNiFoMGFFIOiA_sZd7nwIGDBJLmdLGfhADHZ3Z94';

// Create Supabase client using the global supabase object from the CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export as 'supabase' for convenience
const supabase = supabaseClient;
