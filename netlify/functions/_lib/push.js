// Общие хелперы для функций рассылки пушей
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const SITE = process.env.SITE_URL || 'https://hookahhub.netlify.app';

export function init() {
    const pub = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) throw new Error('VAPID keys are not set');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@hookahhub.netlify.app', pub, priv);
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

/** Отправка одной подписке; мёртвые (404/410) удаляем из базы */
export async function send(db, sub, payload) {
    try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        return true;
    } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', sub.id);
        else console.error('push error', e.statusCode, e.body);
        return false;
    }
}

export const EMOJI = { 5: '💯', 4: '🔥', 3: '😎', 2: '🙂', 1: '😐' };
const SCORE = { excellent: 5, good: 4, ok: 3, bad: 2, notgood: 1 };
export const scoreNum = (s) => SCORE[s] ?? Number(s) ?? 3;
