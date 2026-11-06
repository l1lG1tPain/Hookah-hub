/* Подсчёт рейтинга (по принципу IMDb):
   — средняя оценка показывается только когда набралось MIN_VOTES голосов;
   — в «Топе» и сортировке «Лучшие» работает взвешенный рейтинг (байесовский):
     WR = v/(v+m)·R + m/(v+m)·C, где R — средняя, v — число голосов, C — средняя по каталогу, m — «вес сомнения». */
export const MIN_VOTES = 3;
export const PRIOR_M = 5;

export const hasRating = (x) => (x?.votes || 0) >= MIN_VOTES && x.avg_score != null;
export const votesLeft = (x) => Math.max(0, MIN_VOTES - (x?.votes || 0));

export function catalogMean(items) {
    const rated = items.filter(hasRating);
    const v = rated.reduce((s, x) => s + x.votes, 0);
    return v ? rated.reduce((s, x) => s + x.avg_score * x.votes, 0) / v : 3.8;
}

/** Возвращает копии с полем wr, отсортированные по убыванию; без достаточного числа голосов — не попадают */
export function rankItems(items) {
    const C = catalogMean(items);
    return items.filter(hasRating)
        .map((x) => ({ ...x, wr: (x.votes / (x.votes + PRIOR_M)) * x.avg_score + (PRIOR_M / (x.votes + PRIOR_M)) * C }))
        .sort((a, b) => b.wr - a.wr || b.votes - a.votes);
}

/** Для сортировки «Лучшие»: сначала оценённые по wr, потом остальные по числу голосов */
export function sortTop(items) {
    const ranked = rankItems(items);
    const ids = new Set(ranked.map((x) => x.id));
    return [...ranked, ...items.filter((x) => !ids.has(x.id)).sort((a, b) => b.votes - a.votes)];
}
