// Authentication logic

// Check if user is authenticated
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Sign up new user
async function signUp(email, password, fullName) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        // Profile will be created automatically by the trigger
        return { success: true, data };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}

// Sign in existing user
async function signIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Error signing out: ' + error.message);
    }
}

// Get current user profile
async function getUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user);
        if (!user) return null;

        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Profile query error:', error);
            // If profile doesn't exist, create it manually
            if (error.code === 'PGRST116') {
                console.warn('Profile not found! Creating profile manually...');
                return await createProfileManually(user);
            }
            throw error;
        }
        
        // Fix profile if monthly_generation_limit is missing
        data = await fixProfileIfNeeded(data);
        
        return data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}

// Manually create profile if trigger didn't fire
async function createProfileManually(user) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || 'User',
                subscription_tier: 'free',
                monthly_generation_limit: 3
            })
            .select()
            .single();

        if (error) throw error;
        console.log('Profile created successfully:', data);
        return data;
    } catch (error) {
        console.error('Error creating profile manually:', error);
        return null;
    }
}

// Fix missing monthly_generation_limit
async function fixProfileIfNeeded(profile) {
    if (!profile) return null;
    
    // Check if monthly_generation_limit is missing
    if (typeof profile.monthly_generation_limit === 'undefined' || profile.monthly_generation_limit === null) {
        console.warn('Profile missing monthly_generation_limit, updating...');
        
        // Set default limit based on subscription tier
        const limits = {
            'free': 3,
            'starter': 30,
            'pro': 100,
            'unlimited': -1
        };
        
        const limit = limits[profile.subscription_tier] || 3;
        
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ monthly_generation_limit: limit })
                .eq('id', profile.id)
                .select()
                .single();
            
            if (error) throw error;
            console.log('Profile updated with monthly_generation_limit:', limit);
            return data;
        } catch (error) {
            console.error('Error updating profile:', error);
            // Return profile with limit added manually
            return { ...profile, monthly_generation_limit: limit };
        }
    }
    
    return profile;
}

// Check if user can generate (has generations left)
async function canUserGenerate() {
    try {
        const profile = await getUserProfile();
        if (!profile) return false;

        // Get current month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('usage_tracking')
            .select('generation_count')
            .eq('user_id', profile.id)
            .gte('month_start', startOfMonth.toISOString())
            .maybeSingle(); // Use maybeSingle() - returns null if no rows

        if (error) throw error;

        const currentCount = data ? data.generation_count : 0;
        const limit = profile.monthly_generation_limit;

        return limit === -1 || currentCount < limit; // -1 means unlimited
    } catch (error) {
        console.error('Error checking generation limit:', error);
        return false;
    }
}

// Increment generation count
async function incrementGenerationCount() {
    try {
        console.log('🔄 incrementGenerationCount() called');
        const profile = await getUserProfile();
        if (!profile) throw new Error('No user profile found');
        console.log('✅ Profile found:', profile.id);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        console.log('📅 Month start:', startOfMonth.toISOString());

        // Try to increment existing record
        const { data: existing, error: fetchError } = await supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', profile.id)
            .gte('month_start', startOfMonth.toISOString())
            .maybeSingle(); // Use maybeSingle() - returns null if no rows

        if (fetchError) throw fetchError;
        console.log('📊 Existing usage record:', existing);

        if (existing) {
            // Update existing record
            console.log(`📈 Updating count from ${existing.generation_count} to ${existing.generation_count + 1}`);
            const { error } = await supabase
                .from('usage_tracking')
                .update({ generation_count: existing.generation_count + 1 })
                .eq('id', existing.id);

            if (error) throw error;
            console.log('✅ Successfully incremented generation count!');
        } else {
            // Create new record for this month
            console.log('➕ Creating new usage record with count=1');
            const { error } = await supabase
                .from('usage_tracking')
                .insert({
                    user_id: profile.id,
                    month_start: startOfMonth.toISOString(),
                    generation_count: 1
                });

            if (error) throw error;
            console.log('✅ Successfully created new usage record!');
        }

        return true;
    } catch (error) {
        console.error('❌ Error incrementing generation count:', error);
        return false;
    }
}

// Get remaining generations for current month
async function getRemainingGenerations() {
    try {
        const profile = await getUserProfile();
        console.log('getRemainingGenerations - Profile:', profile);
        if (!profile) {
            console.error('No profile found');
            return 0;
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        console.log('Querying usage_tracking for user_id:', profile.id);
        console.log('Month start:', startOfMonth.toISOString());

        const { data, error } = await supabase
            .from('usage_tracking')
            .select('generation_count')
            .eq('user_id', profile.id)
            .gte('month_start', startOfMonth.toISOString())
            .maybeSingle(); // Use maybeSingle() - returns null if no rows, doesn't error

        if (error) {
            console.error('Supabase query error:', error);
            throw error;
        }

        console.log('Usage tracking data:', data);
        const currentCount = data ? data.generation_count : 0;
        const limit = profile.monthly_generation_limit;
        
        console.log('Current count:', currentCount, 'Limit:', limit);

        if (limit === -1) return -1; // Unlimited
        const remaining = Math.max(0, limit - currentCount);
        console.log('Remaining:', remaining);
        return remaining;
    } catch (error) {
        console.error('Error getting remaining generations:', error);
        return 0;
    }
}
