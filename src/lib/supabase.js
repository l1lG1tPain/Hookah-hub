import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Демо-режим: нет ключей или `npm run dev:demo` — приложение работает на встроенных данных
export const DEMO = import.meta.env.MODE === 'demo' || !url || !key;

export const supabase = DEMO ? null : createClient(url, key, {
    auth: {
        flowType: 'pkce',          // ?code=… в query — не конфликтует с hash-роутером
        persistSession: true,      // сессия живёт в localStorage и обновляется сама
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'hh-auth',
    },
});
