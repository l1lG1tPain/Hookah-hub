/* Шторка заведения: ссылка, QR-карточка «на стол» (1080×1440 и A6), «Поделиться» и «Скачать» */
import { html, icon, sheet, toast, copyText, venueUrl } from './ui.js';

const FORMATS = {
    std: { label: '1080×1440', opts: {}, file: 'table-1080x1440' },
    a6: { label: 'A6 (печать)', opts: { w: 1240, h: 1748 }, file: 'table-a6' },
};

export function venueShareSheet(v) {
    const url = venueUrl(v);
    let fmt = 'std', blob = null, objUrl = '';
    const s = sheet(html`<div class="pshare">
        <h2 class="h2">${v.name}</h2>
        <div class="seg seg--sm" id="vsFmt">
          ${Object.entries(FORMATS).map(([k, f]) => html`<button data-fmt="${k}" aria-selected="${k === fmt}">${f.label}</button>`)}
        </div>
        <div class="pshare__card"><div class="skel"></div></div>
        <div class="pshare__url mono">${url.replace(/^https?:\/\//, '')}</div>
        <div class="pshare__btns">
          <button class="btn btn--accent btn--lg" id="vsShare">${icon('share')} ${navigator.share ? 'Поделиться' : 'Скачать картинку'}</button>
          <button class="btn btn--ghost" id="vsCopy">${icon('copy')} Ссылка</button>
          ${navigator.share ? html`<button class="btn btn--ghost" id="vsSave">Скачать</button>` : ''}
        </div>
        <p class="muted small">Распечатайте карточку и поставьте на стол — гости сканируют и видят меню миксов с оценками.</p>
      </div>`, { onClose: () => { if (objUrl) URL.revokeObjectURL(objUrl); } });

    const $ = (q) => s.body.querySelector(q);
    const render = async () => {
        blob = null;
        $('.pshare__card').innerHTML = '<div class="skel"></div>';
        try {
            const { makeTableCard } = await import('./sharecard.js');
            const b = await makeTableCard(v, url, FORMATS[fmt].opts);
            if (objUrl) URL.revokeObjectURL(objUrl);
            blob = b; objUrl = URL.createObjectURL(b);
            $('.pshare__card').innerHTML = '';
            $('.pshare__card').append(Object.assign(new Image(), { src: objUrl, alt: 'QR на стол', draggable: false }));
        } catch { $('.pshare__card').textContent = 'Не удалось собрать картинку'; }
    };
    const download = () => {
        const link = Object.assign(document.createElement('a'), { href: objUrl, download: `hookah-hub-${v.slug}-${FORMATS[fmt].file}.png` });
        link.click(); toast('Картинка сохранена');
    };
    render();

    $('#vsFmt').onclick = (e) => {
        const b = e.target.closest('[data-fmt]'); if (!b || b.dataset.fmt === fmt) return;
        fmt = b.dataset.fmt;
        $('#vsFmt').querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', x === b));
        render();
    };
    $('#vsCopy').onclick = async () => { const ok = await copyText(url); toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать', ok ? '' : 'err'); };
    $('#vsSave')?.addEventListener('click', () => blob && download());
    $('#vsShare').onclick = async () => {
        if (!blob) return;
        const file = new File([blob], 'hookah-hub-venue.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: v.name, text: `${v.name} — меню миксов\n${url}` }); }
            catch (e) { if (e?.name !== 'AbortError') toast('Не удалось поделиться', 'err'); }
        } else download();
    };
}
