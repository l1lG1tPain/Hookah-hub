// Раз в день (19:00 по Ташкенту): «Микс дня». Выбор тот же, что на главной: номер дня → топ-10 миксов с оценками.
import { init, send, SITE } from './_lib/push.js';

export default async () => {
    const db = init();
    const { data: mixes } = await db.from('mixes_with_stats').select('id,title,votes,avg_score,taste_tags').eq('is_published', true)
        .gte('votes', 3).order('avg_score', { ascending: false }).order('votes', { ascending: false }).limit(10);
    if (!mixes?.length) return;
    const m = mixes[Math.floor(Date.now() / 864e5) % mixes.length];
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('notify_daily', true);
    const payload = {
        title: 'Микс дня 🔥',
        body: `«${m.title}» — ★ ${Number(m.avg_score).toFixed(1)}${m.taste_tags?.length ? ' · ' + m.taste_tags.slice(0, 3).join(', ') : ''}`,
        url: `${SITE}/m/${m.id}`, tag: 'daily',
    };
    let sent = 0;
    for (const s of subs || []) if (await send(db, s, payload)) sent++;
    console.log('push-daily sent', sent);
};

export const config = { schedule: '0 14 * * *' };
