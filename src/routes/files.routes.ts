import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define our plan limits in MB as constants
const PLAN_LIMITS = {
    free: 20 * 1024 * 1024, // 20 MB
    pro: 200 * 1024 * 1024, // 200 MB
};
const createSupabaseClient = (req: Request) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return { supabase, user };
};

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

    let query = supabase.from('files').select('*').eq('user_id', user.id).eq('is_trashed' , false);

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

// Endpoint to get TRASHED files
router.get('/trashed', async (req: Request, res: Response) => {
    // @ts-ignore
    const user = req.user;
    const { supabase } = createSupabaseClient(req);

    const { data, error } = await supabase.from('files').select('*')
        .eq('user_id', user.id)
        .eq('is_trashed', true); // Only get trashed items

    if (error) return res.status(400).json({ error: error.message });
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

//  Endpoint to get files SHARED WITH the current user
router.get('/shared-with-me', async (req: Request, res: Response) => {
    // @ts-ignore
    const user = req.user;
    // @ts-ignore
    const token = req.token;

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
    
    // Now, use user.id in the query
    const { data, error } = await supabase
        .from('shares')
        .select('files (*)')
        .eq('shared_with_user_id', user.id); // Use user.id instead of supabase.auth.uid()

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    const sharedFiles = data.map(item => item.files).filter(Boolean);
    res.status(200).json(sharedFiles);
});

// Endpoint to SEARCH files by name 
router.get('/search', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${query}%`);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
});


// server/src/routes/files.routes.ts

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const user = req.user;
    
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const file = req.file;

    // 1. Get user's plan
    const { data: profile } = await supabase
        .from('profiles').select('plan').eq('id', user.id).single();
    const userPlan = (profile?.plan as 'free' | 'pro') || 'free';
    const planLimit = PLAN_LIMITS[userPlan];

    // 2. Calculate the total usage using the corrected query
    const { data: files, error: filesError } = await supabase
        .from('files').select('size').eq('user_id', user.id).eq('is_trashed', false);
    if (filesError) return res.status(400).json({ error: filesError.message });
    const totalUsage = files ? files.reduce((sum, file) => sum + (file.size ?? 0), 0) : 0;

    // 3. Check if the new file exceeds the limit
    if (totalUsage + file.size > planLimit) {
        return res.status(403).json({ error: 'Storage limit exceeded. Upgrade to Pro for more space.' });
    }
    
    // If check passes, proceed with upload
    const parent_id = req.body.parent_id || null;
    const fileSize = file.size || 0;
    const filePath = `${user.id}/${Date.now()}_${file.originalname}`;
    const { error: uploadError } = await supabase.storage
        .from('files_bucket').upload(filePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) return res.status(400).json({ error: `Storage Error: ${uploadError.message}` });

    const { data: dbData, error: dbError } = await supabase
        .from('files').insert({ name: file.originalname, type: 'file', user_id: user.id, parent_id: parent_id, storage_path: filePath, mimetype: file.mimetype, size: fileSize })
        .select().single();
    if (dbError) {
        console.error('Database insert error:', dbError);
        return res.status(400).json({ error: `Database Error: ${dbError.message}` });
    }
    res.status(201).json(dbData);
});

// Endpoint to DELETE a file or folder
router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { supabase } = createSupabaseClient(req);

    const { data, error } = await supabase.from('files')
        .update({ is_trashed: true, parent_id: null }) // Move to trash and remove from parent folder
        .eq('id', id)
        .select();
    
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json(data);
});

router.post('/:id/restore', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { supabase } = createSupabaseClient(req);
    
    const { data, error } = await supabase.from('files')
        .update({ is_trashed: false }) // Just mark as not trashed
        .eq('id', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json(data);
});

// NEW: Endpoint to PERMANENTLY DELETE a file
router.delete('/:id/permanent', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { supabase} = createSupabaseClient(req);

    // First, get the file's storage path
    const { data: item, error: selectError } = await supabase
        .from('files').select('storage_path, type').eq('id', id).single();

    if (selectError) return res.status(404).json({ error: "Item not found." });

    // If it's a file, delete it from Storage
    if (item.type === 'file' && item.storage_path) {
        const { error: storageError } = await supabase.storage
            .from('files_bucket').remove([item.storage_path]);
        if (storageError) console.error("Storage delete error:", storageError.message);
    }

    // Finally, delete the record from the database
    const { error: dbError } = await supabase.from('files').delete().eq('id', id);
    if (dbError) return res.status(400).json({ error: dbError.message });

    res.status(200).json({ message: 'Item permanently deleted.' });
});


// Endpoint to RENAME a file or folder
router.patch('/:id/rename', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    const { id } = req.params;
    const { newName } = req.body;

    if (!newName) return res.status(400).json({ error: 'New name is required.' });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase
        .from('files')
        .update({ name: newName })
        .eq('id', id)
        .select()
        .single();
    
    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json(data);
});

// Endpoint to get a DOWNLOAD URL for a file
router.get('/:id/download', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    const { id } = req.params;

    // This client needs to have the user's token to know who is asking
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 1. Call our new function to get the storage path directly.
    //    All permission checks happen inside the function itself.
    const { data: storagePath, error: rpcError } = await supabase
        .rpc('get_file_path_if_allowed', { file_id_to_check: id });

    if (rpcError || !storagePath) {
        // This single check handles both "not found" and "no permission" cases.
        return res.status(404).json({ error: "File not found or you don't have access." });
    }

    // 2. If we got a path, create the signed URL.
    const { data, error: urlError } = await supabase.storage
        .from('files_bucket')
        .createSignedUrl(storagePath, 60); // URL is valid for 60 seconds

    if (urlError) {
        return res.status(400).json({ error: urlError.message });
    }

    res.status(200).json({ downloadUrl: data.signedUrl });
});


// Endpoint to SHARE a file (RPC VERSION - FINAL)
router.post('/:id/share', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    // @ts-ignore
    const sharerUser = req.user;
    const { id: fileId } = req.params;
    const { email: recipientEmail } = req.body;

    if (!recipientEmail) {
        return res.status(400).json({ error: 'Recipient email is required.' });
    }
    
    // Admin client is needed to call the SECURITY DEFINER function
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the database function to securely get the recipient's user ID
    const { data: recipientUserId, error: rpcError } = await supabaseAdmin
        .rpc('get_user_id_by_email', {
            user_email: recipientEmail
        });
        
    if (rpcError || !recipientUserId) {
        return res.status(404).json({ error: 'Recipient user not found.' });
    }
    
    if (recipientUserId === sharerUser.id) {
        return res.status(400).json({ error: "You cannot share a file with yourself." });
    }

    // Create a client instance with the user's token to respect RLS policies
    const supabaseUserClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error: shareError } = await supabaseUserClient
        .from('shares')
        .insert({
            file_id: fileId,
            shared_by_user_id: sharerUser.id,
            shared_with_user_id: recipientUserId,
        })
        .select()
        .single();

    if (shareError) {
        if (shareError.code === '23505') {
            return res.status(409).json({ error: 'This file is already shared with that user.' });
        }
        return res.status(400).json({ error: shareError.message });
    }
    
    res.status(201).json(data);
});


// Endpoint to MOVE a file or folder
router.patch('/:id/move', async (req: Request, res: Response) => {
    // @ts-ignore
    const token = req.token;
    const { id: fileToMoveId } = req.params;
    const { destinationFolderId } = req.body; // Can be null for the root directory

    // Critical check: Prevent moving a folder into itself or one of its own subfolders.
    // A full implementation would check the entire ancestry. For now, we'll prevent the simplest case.
    if (fileToMoveId === destinationFolderId) {
        return res.status(400).json({ error: "Cannot move a folder into itself." });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase
        .from('files')
        .update({ parent_id: destinationFolderId || null }) // Set new parent_id
        .eq('id', fileToMoveId)
        .select()
        .single();
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(200).json(data);
});



export default router;

