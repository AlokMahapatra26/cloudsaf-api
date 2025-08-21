import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Endpoint to get files/folders within a specific folder
router.get('/', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;

    // Create a new Supabase client with the user's auth token
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const parentId = req.query.parentId || null;

    let query = supabase.from('files').select('*').eq('user_id', user.id);

    if (parentId) {
        query = query.eq('parent_id', parentId);
    } else {
        query = query.is('parent_id', null); // For root files/folders
    }

    const { data, error } = await query;

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.status(200).json(data);
});

// Endpoint to create a new folder
router.post('/folder', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { name, parent_id } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Folder name is required.' });
    }

    const { data, error } = await supabase
        .from('files')
        .insert({
            name,
            type: 'folder',
            user_id: user.id,
            parent_id: parent_id || null,
        })
        .select()
        .single(); // .single() returns the created object

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
});


export default router;