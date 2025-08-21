import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// We create a temporary client here to validate the token.
// The actual Supabase client in the route will be user-specific.
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'No token provided. Authorization denied.' });
    }
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Attach user and token to the request object for use in other routes
    // @ts-ignore (extending Request object)
    req.user = user;
    // @ts-ignore
    req.token = token;

    next(); // Proceed to the next middleware or route handler
};