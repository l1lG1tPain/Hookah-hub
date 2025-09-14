import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseSR = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

function parseInit(objOrStr){
    if (typeof objOrStr === 'string') return Object.fromEntries(new URLSearchParams(objOrStr));
    return objOrStr || {};
}
function isValidTelegram(dataRaw){
    const data = { ...dataRaw };
    const hash = data.hash; delete data.hash;
    const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const check = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n');
    const hmac = crypto.createHmac('sha256', secret).update(check).digest('hex');
    return hmac === hash;
}

async function upsertUser(initData){
    const tgUser = JSON.parse(initData.user || '{}');
    const name = tgUser.first_name || tgUser.username || `user_${tgUser.id}`;
    const { data, error } = await supabaseSR
        .from('users')
        .upsert({ tg_id: tgUser.id, name, avatar_url: tgUser.photo_url || null }, { onConflict: 'tg_id' })
        .select().single();
    if (error) throw error;
    return data;
}

export const handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            // Лэндинг для виджета: возьмём query, позовём себя же POST’ом, сохраним user и вернёмся назад
            const html = `<!doctype html><meta charset="utf-8">
<script>
(async () => {
  const qs = new URLSearchParams(location.search);
  const init = Object.fromEntries(qs.entries());
  const r = await fetch(location.pathname, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({ initData: init })
  });
  const data = await r.json();
  if (data && data.ok && data.user) {
    localStorage.setItem('hh:user', JSON.stringify(data.user));
    location.replace('/#/profile');
  } else {
    document.body.textContent = 'Auth error: ' + (data && data.error || 'unknown');
  }
})();
</script>`;
            return { statusCode: 200, headers: {'content-type':'text/html; charset=utf-8'}, body: html };
        }

        const body = JSON.parse(event.body || '{}');
        const initData = parseInit(body.initData);
        if (!isValidTelegram(initData)) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Telegram data' }) };
        }
        const user = await upsertUser(initData);
        return { statusCode: 200, body: JSON.stringify({ ok: true, user }) };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
    }
};
