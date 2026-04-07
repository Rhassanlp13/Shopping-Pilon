import { CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
