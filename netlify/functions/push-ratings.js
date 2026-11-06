// Каждые 15 минут: авторам миксов — «ваш микс получил оценку». Одно уведомление на пачку.
import { init, send, SITE, EMOJI, scoreNum } from './_lib/push.js';

export default async () => {
    const db = init();
    const { data: subs, error } = await db.from('push_subscriptions').select('*').eq('notify_ratings', true);
    if (error) throw error;
    const byUser = new Map();
    for (const s of subs || []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id).push(s); }
    const now = new Date().toISOString();
    let sent = 0;

    for (const [uid, list] of byUser) {
        const since = list.reduce((m, s) => (s.last_rating_check < m ? s.last_rating_check : m), list[0].last_rating_check);
        const { data: mixes } = await db.from('mixes').select('id,title').eq('author_id', uid);
        if (mixes?.length) {
            const titles = new Map(mixes.map((m) => [m.id, m.title]));
            const { data: ratings } = await db.from('mix_ratings').select('mix_id,user_id,score,updated_at')
                .in('mix_id', [...titles.keys()]).gt('updated_at', since).neq('user_id', uid).order('updated_at');
            if (ratings?.length) {
                const one = ratings.length === 1 ? ratings[0] : null;
                const mixCount = new Set(ratings.map((r) => r.mix_id)).size;
                const payload = one
                    ? { title: `Новая оценка ${EMOJI[scoreNum(one.score)] || ''}`, body: `Ваш микс «${titles.get(one.mix_id)}» оценили`, url: `${SITE}/m/${one.mix_id}`, tag: `rate-${one.mix_id}` }
                    : { title: 'Новые оценки', body: `${ratings.length} новых оценок у ваших миксов (${mixCount})`, url: `${SITE}/#/profile`, tag: 'rate-batch' };
                for (const s of list) if (await send(db, s, payload)) sent++;
            }
        }
        await db.from('push_subscriptions').update({ last_rating_check: now }).in('id', list.map((s) => s.id));
    }
    console.log('push-ratings sent', sent);
};

export const config = { schedule: '*/15 * * * *' };
