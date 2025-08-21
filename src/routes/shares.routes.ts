import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Endpoint to REMOVE a shared file from a user's view
router.delete('/:file_id', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    const { file_id } = req.params;

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { error } = await supabase
        .from('shares')
        .delete()
        .eq('file_id', file_id)
        .eq('shared_with_user_id', user.id);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Share removed successfully.' });
});

export default router;