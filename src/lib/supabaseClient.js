import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eahhpjgonzidswchxuee.supabase.co';
const supabaseKey = 'sb_publishable_JO3Bc5ORZZIgCkaMseSLiQ_lNDrNyNB';

export const supabase = createClient(supabaseUrl, supabaseKey);
