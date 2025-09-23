// netlify/functions/auth-start.js
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') return resp(405, { ok: false });

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

        // 1) одноразовый state
        const state = crypto.randomBytes(16).toString('hex');

        // 2) кладём в login_states со статусом 'new'
        const { error: insErr } = await supabase
            .from('login_states')
            .insert({ state, status: 'new' });

        if (insErr) throw insErr;

        // 3) дип-линки (ВАЖНО: payload с префиксом login_)
        const bot = process.env.TELEGRAM_BOT_USERNAME; // "my_hookahhub_bot"
        const payload = `login_${state}`;
        const tgLink = `tg://resolve?domain=${bot}&start=${payload}`;
        const httpsLink = `https://t.me/${bot}?start=${payload}`;

        return resp(200, { ok: true, state, tgLink, httpsLink });
    } catch (e) {
        console.error('auth-start error', e);
        return resp(500, { ok: false, error: 'internal' });
    }
};

function resp(status, body) {
    return { statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}
