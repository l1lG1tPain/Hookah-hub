import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export const handler = async () => {
    try {
        const state = crypto.randomBytes(16).toString('hex');
        await supa.from('login_states').insert({ state });

        const bot = process.env.TELEGRAM_BOT_USERNAME;
        const httpsLink = `https://t.me/${bot}?start=login_${state}`;
        const tgLink    = `tg://resolve?domain=${bot}&start=login_${state}`;

        return { statusCode: 200, body: JSON.stringify({ ok: true, state, httpsLink, tgLink }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(e) }) };
    }
};
