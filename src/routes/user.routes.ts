// server/src/routes/user.routes.ts
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

router.get('/storage', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;

    if (!user || !user.id) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    // ✅ FIX #1: Removed the problematic .neq('size', null) filter
    const { data, error } = await supabase
        .from('files')
        .select('size')
        .eq('user_id', user.id)
        .eq('is_trashed', false);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // ✅ FIX #2: Safely calculate the sum, treating null values as 0
    const totalUsage = data.reduce((sum, file) => sum + (file.size ?? 0), 0);

    res.status(200).json({ totalUsage });
});

export default router;