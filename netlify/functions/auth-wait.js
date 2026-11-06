// netlify/functions/auth-wait.js
// Браузер опрашивает эту функцию, пока пользователь подтверждает вход в боте.
// Когда бот отметил state как 'ok', выдаём одноразовый token_hash Supabase Auth —
// фронт обменивает его на обычную Supabase-сессию (с авто-обновлением).
import { createClient } from '@supabase/supabase-js';

const TTL_MS = 10 * 60 * 1000;
const tgEmail = (tgId) => `tg${tgId}@telegram.hookahhub.app`;

export const handler = async (event) => {
    try {
        const state = (event.queryStringParameters?.state || '').trim();
        if (!/^[a-f0-9]{32}$/.test(state)) return json(400, { ok: false, error: 'bad_state' });

        const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: st, error: stErr } = await admin
            .from('login_states').select('*').eq('state', state).maybeSingle();
        if (stErr) throw stErr;
        if (!st) return json(404, { ok: false, error: 'state_not_found' });

        const age = st.created_at ? Date.now() - new Date(st.created_at).getTime() : 0;
        if (age > TTL_MS && st.status !== 'consumed') {
            await admin.from('login_states').update({ status: 'expired' }).eq('state', state);
            return json(200, { ok: false, error: 'expired' });
        }
        if (st.status === 'consumed') return json(200, { ok: false, error: 'consumed' });
        if (st.status !== 'ok') return json(200, { ok: false, wait: true });

        // Профиль, созданный ботом
        const { data: profile, error: pErr } = await admin
            .from('users').select('id, tg_id, name, avatar_url, auth_id').eq('id', st.user_id).maybeSingle();
        if (pErr) throw pErr;
        if (!profile?.tg_id) return json(200, { ok: false, error: 'user_not_found' });

        const email = tgEmail(profile.tg_id);

        // Гарантируем auth-пользователя (при первом входе создаём;
        // SQL-триггер привяжет его к существующему профилю по tg_id)
        if (!profile.auth_id) {
            const { error: cErr } = await admin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: {
                    provider: 'telegram',
                    tg_id: String(profile.tg_id),
                    name: profile.name,
                    avatar_url: profile.avatar_url,
                },
            });
            if (cErr && !/already|registered|exists/i.test(cErr.message || '')) throw cErr;
        }

        // Одноразовая ссылка-токен для входа (письмо не отправляется)
        const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        if (lErr) throw lErr;

        if (!profile.auth_id && link?.user?.id) {
            await admin.from('users').update({ auth_id: link.user.id, email, provider: 'telegram' }).eq('id', profile.id);
        }

        await admin.from('login_states').update({ status: 'consumed' }).eq('state', state);

        return json(200, { ok: true, token_hash: link.properties.hashed_token });
    } catch (e) {
        console.error('auth-wait error', e);
        return json(500, { ok: false, error: 'internal' });
    }
};

function json(status, body) {
    return {
        statusCode: status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify(body),
    };
}
