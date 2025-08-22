// server/src/routes/user.routes.ts

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Define our plan limits in MB as constants
const PLAN_LIMITS = {
    free: 1 * 1024 * 1024, // 50 MB
    pro: 5 * 1024 * 1024, // 200 MB
};

// Helper function to create a Supabase client with the user's token
const createSupabaseClient = (req: Request) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return { supabase, user, token };
};

const router = Router();

router.get('/storage', async (req: Request, res: Response) => {
    const { supabase, user } = createSupabaseClient(req);

    const { data: profile, error: profileError } = await supabase
        .from('profiles').select('plan').eq('id', user.id).single();
    if (profileError) return res.status(500).json({ error: profileError.message });
    const userPlan = profile.plan as 'free' | 'pro';
    const planLimit = PLAN_LIMITS[userPlan];

    const { data: files, error: filesError } = await supabase
        .from('files').select('size').eq('user_id', user.id).eq('is_trashed', false);

    if (filesError) return res.status(400).json({ error: filesError.message });
    
    const totalUsage = files.reduce((sum, file) => sum + (file.size ?? 0), 0);

    res.status(200).json({ totalUsage, plan: userPlan, limit: planLimit });
});

export default router;