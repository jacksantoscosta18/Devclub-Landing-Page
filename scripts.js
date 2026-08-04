(() => {
    'use strict';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /* ══════════════════════════════════════════
       0. FUNDO — rede de nós que reage ao mouse
       ══════════════════════════════════════════ */
    (() => {
        const cvs = document.getElementById('netbg');
        if (!cvs || reduce) return; // efeito puramente decorativo: fora com movimento reduzido
        const ctx = cvs.getContext('2d');

        let W = 0, H = 0, DPR = 1, nodes = [];
        const mouse = { x: -9999, y: -9999, active: false };

        const NODE_RGB = '196,181,253';  // roxo — pontos
        const LINE_RGB = '123,224,245';  // ciano — malha entre pontos próximos
        const MOUSE_RGB = '186,140,255';  // roxo mais forte — raios até o cursor
        const LINK_D = 128;            // distância máx. entre dois nós pra ligar
        const MOUSE_D = 230;            // raio de influência do cursor

        function build() {
            const n = Math.round(clamp((W * H) / 26000, 34, 95));
            nodes = Array.from({ length: n }, () => ({
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
                r: Math.random() * 1.2 + .8
            }));
        }
        function resize() {
            DPR = Math.min(window.devicePixelRatio || 1, 2);
            W = cvs.clientWidth; H = cvs.clientHeight;
            cvs.width = W * DPR; cvs.height = H * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            build();
        }

        window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
        document.addEventListener('mouseleave', () => mouse.active = false);

        let paused = false;
        document.addEventListener('visibilitychange', () => {
            const hidden = document.visibilityState === 'hidden';
            if (hidden) paused = true;
            else if (paused) { paused = false; requestAnimationFrame(frame); }
        });

        function frame() {
            if (paused) return;
            ctx.clearRect(0, 0, W, H);

            for (const p of nodes) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
                if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
            }

            // malha entre nós vizinhos
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK_D) {
                        ctx.strokeStyle = `rgba(${LINE_RGB},${(1 - d / LINK_D) * .2})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
            }

            // raios convergindo pro cursor
            if (mouse.active) {
                for (const p of nodes) {
                    const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                    if (d < MOUSE_D) {
                        ctx.strokeStyle = `rgba(${MOUSE_RGB},${(1 - d / MOUSE_D) * .45})`;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                    }
                }
            }

            // pontos — os próximos do cursor acendem mais forte
            for (const p of nodes) {
                const d = mouse.active ? Math.hypot(p.x - mouse.x, p.y - mouse.y) : Infinity;
                const near = d < MOUSE_D;
                const rr = near ? p.r * (1 + (1 - d / MOUSE_D) * 1.2) : p.r;
                ctx.fillStyle = near ? `rgba(${MOUSE_RGB},.85)` : `rgba(${NODE_RGB},.5)`;
                ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
            }

            requestAnimationFrame(frame);
        }

        const ro = new ResizeObserver(resize);
        ro.observe(cvs);
        resize();
        requestAnimationFrame(frame);
    })();

    /* ══════════════════════════════════════════
       1. NAVBAR + MENU MOBILE
       ══════════════════════════════════════════ */
    const nav = document.getElementById('nav');
    const burger = document.getElementById('burger');
    const onScrollNav = () => nav.classList.toggle('stuck', window.scrollY > 40);
    onScrollNav();
    window.addEventListener('scroll', onScrollNav, { passive: true });

    burger.addEventListener('click', () => {
        const open = document.body.classList.toggle('nav-open');
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
    document.querySelectorAll('#mobileMenu a').forEach(a =>
        a.addEventListener('click', () => {
            document.body.classList.remove('nav-open');
            burger.setAttribute('aria-expanded', 'false');
        })
    );

    /* ══════════════════════════════════════════
       2. HERO — estrelas que formam DEVCLUB
       ══════════════════════════════════════════ */
    const cvs = document.getElementById('stars');
    const ctx = cvs.getContext('2d', { alpha: true });
    const heroEl = document.getElementById('hero');
    const heroTop = document.getElementById('heroTop');
    const heroBottom = document.getElementById('heroBottom');
    const scrollHint = document.getElementById('scrollHint');
    const heroBoom = document.getElementById('heroBoom');
    const heroRing1 = document.getElementById('heroRing1');
    const heroRing2 = document.getElementById('heroRing2');

    let W = 0, H = 0, DPR = 1, WORD_Y = 0;
    let word = [];      // estrelas que formam o wordmark
    let ambient = [];   // poeira estelar de fundo
    let progress = 0, shown = 0;
    let boomFired = false, boomTime = -Infinity;

    // Dispara o flash + ondas de choque quando o wordmark termina de se formar.
    // Reseta se o usuário rolar de volta pra cima, pra poder ver de novo.
    function fireBoom() {
        boomTime = performance.now();
        [heroBoom, heroRing1, heroRing2].forEach(el => {
            el.classList.remove('go');
            void el.offsetWidth; // força reflow pra permitir repetir a animação
            el.classList.add('go');
        });
    }

    /* Sprites de brilho pré-renderizados — evita criar 1000+ gradientes por frame */
    const glowSprite = (rgb) => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, `rgba(${rgb},1)`);
        grd.addColorStop(.35, `rgba(${rgb},.35)`);
        grd.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
        return c;
    };
    const GLOWS = [glowSprite('255,255,255'), glowSprite('150,190,255'), glowSprite('123,224,245')];

    // Canvas de amostragem reaproveitado, anexado ao DOM dentro da área visível
    // (1px, opacidade zero) — alguns navegadores mobile não fazem a leitura de
    // pixels corretamente em canvases nunca inseridos na página.
    const offCanvas = document.createElement('canvas');
    offCanvas.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1';
    document.body ? document.body.appendChild(offCanvas) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(offCanvas));

    function buildWord() {
        // Renderiza "DEVCLUB" fora da tela e amostra os pixels acesos
        const off = offCanvas;
        const octx = off.getContext('2d');
        off.width = W; off.height = H;

        const size = clamp(W * 0.135, 40, 190);
        const font = s => `700 ${s}px 'Space Grotesk', 'Segoe UI', system-ui, sans-serif`;
        octx.fillStyle = '#fff';
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.font = font(size);

        const txt = 'DEVCLUB';
        // Encolhe se não couber na largura útil
        const maxW = W * 0.86;
        const m = octx.measureText(txt).width;
        if (m > maxW) octx.font = font(size * (maxW / m));

        WORD_Y = H * 0.42;                 // wordmark um pouco acima do centro óptico
        octx.fillText(txt, W / 2, WORD_Y);

        // Amostragem mais densa e com menos "tremor" de posição — letras mais
        // sólidas e nítidas em vez de um amontoado de pontos soltos.
        const step = W < 640 ? 2.2 : (W < 1200 ? 2.8 : 3);
        const data = octx.getImageData(0, 0, W, H).data;
        const pts = [];
        for (let y = 0; y < H; y += step) {
            for (let x = 0; x < W; x += step) {
                // x/y fracionários (step 2.2/2.8) exigem arredondar pra baixo antes de
                // indexar o array de pixels — índice fracionário num typed array
                // sempre dá `undefined`, o que fazia a amostragem falhar em qualquer
                // tela com menos de 1200px de largura (ou seja, praticamente todo
                // celular, mas funcionava sempre em telas largas de desktop).
                const xi = x | 0, yi = y | 0;
                if (data[(yi * W + xi) * 4 + 3] > 128) {
                    pts.push([x + (Math.random() - .5) * 0.7, y + (Math.random() - .5) * 0.7]);
                }
            }
        }

        // Limita a densidade para manter fluidez
        const MAX = W < 700 ? 1050 : 1900;
        let chosen = pts;
        if (pts.length > MAX) {
            chosen = [];
            const stride = pts.length / MAX;
            for (let i = 0; i < MAX; i++) chosen.push(pts[Math.floor(i * stride)]);
        }

        word = chosen.map(([tx, ty]) => {
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.max(W, H) * (0.35 + Math.random() * 0.75);
            return {
                tx, ty,
                sx: W / 2 + Math.cos(ang) * rad,
                sy: H / 2 + Math.sin(ang) * rad * 0.75,
                r: 0.8 + Math.random() * 0.85,
                tw: Math.random() * Math.PI * 2,          // fase do brilho
                sp: 0.45 + Math.random() * 0.85,        // velocidade individual
                g: Math.random() > .68 ? 2 : (Math.random() > .45 ? 1 : 0)
            };
        });
    }

    function buildAmbient() {
        const n = Math.round(clamp((W * H) / 9000, 90, 320));
        ambient = Array.from({ length: n }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.15 + .25,
            a: Math.random() * .55 + .12,
            tw: Math.random() * Math.PI * 2,
            sp: Math.random() * .9 + .25,
            drift: (Math.random() - .5) * .06
        }));
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = cvs.clientWidth; H = cvs.clientHeight;
        cvs.width = W * DPR; cvs.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildWord();
        buildAmbient();
    }

    // easeInOutCubic — a formação "assenta" no final
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let t = 0;
    function draw() {
        t += 0.016;
        ctx.clearRect(0, 0, W, H);

        // p vai de 0 (espalhado) a 1 (wordmark formado)
        shown = lerp(shown, progress, 0.09);
        const p = ease(clamp(shown, 0, 1));

        // "Boom" no instante em que as estrelas terminam de se juntar (usa `shown`,
        // não `progress`, pra disparar quando o nome está visualmente completo —
        // não no instante em que o scroll target chega em 1, que é antes disso).
        if (shown > 0.985 && !boomFired) {
            boomFired = true;
            fireBoom();
        } else if (shown < 0.9 && boomFired) {
            boomFired = false; // rolou de volta pra cima: pode disparar de novo
        }
        const boomAge = (performance.now() - boomTime) / 1000; // segundos desde o boom
        const boomPulse = boomAge >= 0 && boomAge < 0.4 ? (1 - boomAge / 0.4) : 0;

        // ---- poeira estelar de fundo ----
        for (const s of ambient) {
            const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.tw);
            s.y += s.drift;
            if (s.y < -2) s.y = H + 2; else if (s.y > H + 2) s.y = -2;
            ctx.globalAlpha = s.a * tw * (1 - p * 0.65); // poeira apaga mais para o wordmark se destacar
            ctx.fillStyle = '#dbe6ff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }

        // ---- estrelas do wordmark ----
        ctx.globalCompositeOperation = 'lighter';
        for (const s of word) {
            const k = clamp(p * s.sp * 1.35, 0, 1);
            const e = ease(k);
            const x = lerp(s.sx, s.tx, e);
            const y = lerp(s.sy, s.ty, e);
            // Cintilação mais sutil (0.82–1.0 em vez de 0.6–1.0) e piso de brilho mais
            // alto: as letras ficam sólidas e legíveis, sem pontos "apagando".
            const tw = 0.82 + 0.18 * Math.sin(t * 1.7 + s.tw);
            const alpha = clamp((0.42 + e * 0.72) * tw + boomPulse * 0.5, 0, 1);
            const r = s.r * (0.78 + e * 0.62) * (1 + boomPulse * 0.4);

            // halo (sprite pré-renderizado), mais discreto pra não borrar o contorno
            if (e > 0.6) {
                const gr = r * 4;
                ctx.globalAlpha = 0.22 * ((e - 0.6) / 0.4) * tw;
                ctx.drawImage(GLOWS[s.g], x - gr, y - gr, gr * 2, gr * 2);
            }
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        // Clarão suave por trás de todo o wordmark no instante do boom
        if (boomPulse > 0) {
            const bg = ctx.createRadialGradient(W / 2, WORD_Y, 0, W / 2, WORD_Y, Math.max(W, H) * 0.4);
            bg.addColorStop(0, `rgba(200,225,255,${0.28 * boomPulse})`);
            bg.addColorStop(1, 'rgba(200,225,255,0)');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        if (!reduce) requestAnimationFrame(draw);
    }

    function heroScroll() {
        if (reduce) {                       // sem animação: nome já formado, texto sempre visível
            progress = shown = 1;
            heroTop.classList.add('show'); heroBottom.classList.add('show');
            heroTop.style.transform = heroBottom.style.transform = 'translate(-50%,0)';
            scrollHint.style.opacity = '0';
            draw();
            return;
        }
        const total = heroEl.offsetHeight - window.innerHeight;
        const raw = clamp((window.scrollY - heroEl.offsetTop) / Math.max(total, 1), 0, 1);
        // O wordmark se forma nos primeiros 65% do scroll do hero
        progress = clamp(raw / 0.65, 0, 1);

        // Texto entra conforme a constelação se fecha
        const reveal = clamp((raw - 0.26) / 0.32, 0, 1);
        const on = reveal > 0.04;
        heroTop.classList.toggle('show', on);
        heroBottom.classList.toggle('show', on);
        heroTop.style.transform = `translate(-50%, ${lerp(-40, 0, reveal)}px)`;
        heroBottom.style.transform = `translate(-50%, ${lerp(44, 0, reveal)}px)`;
        scrollHint.style.opacity = String(clamp(1 - raw * 4.5, 0, 1));
    }

    const ro = new ResizeObserver(resize);
    ro.observe(cvs);
    resize();
    heroScroll();
    window.addEventListener('scroll', heroScroll, { passive: true });
    window.addEventListener('resize', () => { resize(); heroScroll(); });
    window.addEventListener('orientationchange', () => { resize(); heroScroll(); });
    // Reconstrói de novo como rede de segurança pra fontes que carregam depois
    // do primeiro layout (comum no celular) — via resize() pra sempre reler o
    // tamanho real do canvas nesse momento.
    if (document.fonts) {
        document.fonts.load(`700 ${Math.round(clamp(W * 0.135, 40, 190))}px "Space Grotesk"`).catch(() => { }).then(resize);
        document.fonts.ready.then(resize).catch(() => { });
    }
    setTimeout(resize, 400);
    setTimeout(resize, 1200);
    if (!reduce) requestAnimationFrame(draw); else { progress = shown = 1; draw(); }

    /* ══════════════════════════════════════════
       3. EMPRESAS — marcas alternando na mesma posição (crossfade)
       ══════════════════════════════════════════ */
    (() => {
        const grid = document.getElementById('logoGrid');
        if (!grid) return;

        const V = ['', 'v-heavy', 'v-mono', 'v-wide', 'v-serif', 'v-light'];
        const rv = () => V[Math.floor(Math.random() * V.length)];

        // 20 células, cada uma com 3 marcas que se revezam no mesmo lugar
        const cells = [
            ['Itaú', 'Vivo', 'Renner'],
            ['nubank', 'C&A', 'Ford'],
            ['Ambev Tech', 'Heineken', 'Danone'],
            ['Mercado Livre', 'Shopee', 'Amazon'],
            ['Globo', 'SBT', 'Record'],
            ['ifood', 'Rappi', 'Uber Eats'],
            ['Stone', 'Cielo', 'PagBank'],
            ['Magalu', 'Americanas', 'Casas Bahia'],
            ['XP Inc.', 'BTG Pactual', 'Ágora'],
            ['TOTVS', 'SAP', 'Oracle'],
            ['PicPay', 'Neon', 'Banco Inter'],
            ['Natura', 'Avon', 'O Boticário'],
            ['hotmart', 'Eduzz', 'Kiwify'],
            ['Localiza', 'Movida', 'Unidas'],
            ['Serasa', 'Boa Vista', 'SPC'],
            ['Bradesco', 'Santander', 'Caixa'],
            ['loggi', 'Jadlog', 'Correios'],
            ['Claro', 'TIM', 'Oi'],
            ['Sicredi', 'Sicoob', 'Banrisul'],
            ['B3', 'CVM', 'Ibovespa']
        ];

        grid.innerHTML = cells.map(names => {
            const spans = names.map(n => `<span class="lg ${rv()}">${n}</span>`).join('');
            return `<div class="logo-cell" role="listitem">${spans}</div>`;
        }).join('');

        document.querySelectorAll('.logo-cell').forEach((cell, ci) => {
            const items = [...cell.querySelectorAll('.lg')];
            items[0].classList.add('active');
            if (reduce || items.length < 2) return;
            let idx = 0;
            const tick = () => {
                const next = (idx + 1) % items.length;
                items[idx].classList.remove('active');
                const incoming = items[next];
                incoming.classList.add('active', 'pop');
                // o flash colorido dura só o começo da troca, depois some
                setTimeout(() => incoming.classList.remove('pop'), 500);
                idx = next;
                setTimeout(tick, 3200 + Math.random() * 2200);
            };
            setTimeout(tick, 900 + ci * 140 + Math.random() * 1400);
        });
    })();

    /* ══════════════════════════════════════════
       4. REVELAÇÃO AO ROLAR
       ══════════════════════════════════════════ */
    const revealIO = new IntersectionObserver((entries) => {
        entries.forEach((en, i) => {
            if (en.isIntersecting) {
                en.target.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
                en.target.classList.add('in');
                revealIO.unobserve(en.target);
            }
        });
    }, { threshold: .14, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

    /* ══════════════════════════════════════════
       5. CONTADORES
       ══════════════════════════════════════════ */
    const fmt = (v, mode) => {
        if (mode === 'k') return (v / 1000).toFixed(v >= 12000 ? 0 : 1).replace('.', ',') + ' mil';
        if (mode === 'milhar') return v.toLocaleString('pt-BR');
        return v.toLocaleString('pt-BR');
    };
    const countIO = new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            const el = en.target;
            const to = +el.dataset.to;
            const mode = el.dataset.fmt;
            const dur = 1700;
            const t0 = performance.now();
            const tick = now => {
                const k = clamp((now - t0) / dur, 0, 1);
                const e = 1 - Math.pow(1 - k, 3);
                el.textContent = fmt(Math.round(to * e), mode);
                if (k < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            countIO.unobserve(el);
        });
    }, { threshold: .5 });
    document.querySelectorAll('.count').forEach(el => countIO.observe(el));

    /* ══════════════════════════════════════════
       6. RADAR (pentágono de competências)
       ══════════════════════════════════════════ */
    (() => {
        const wrap = document.getElementById('radar');
        if (!wrap) return;
        const CX = 100, CY = 94, R = 60, LR = R + 18;
        const axes = [
            { label: 'Front-end', v: .88 },
            { label: 'Back-end', v: .74 },
            { label: 'Banco', v: .69 },
            { label: 'Deploy', v: .62 },
            { label: 'Carreira', v: .81 }
        ];
        const pt = (i, r) => {
            const a = -Math.PI / 2 + i * (Math.PI * 2 / axes.length);
            return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
        };
        const NS = 'http://www.w3.org/2000/svg';

        // Desenha o pentágono de competências dentro de qualquer conjunto de
        // grupos SVG — usado tanto no celular pequeno (com sufixo '') quanto no
        // modal de diagnóstico (com sufixo '2'), pra não duplicar essa conta.
        function buildRadarInto(suffix) {
            const grid = document.getElementById('radarGrid' + suffix);
            const axesG = document.getElementById('radarAxes' + suffix);
            const dots = document.getElementById('radarDots' + suffix);
            const labels = document.getElementById('radarLabels' + suffix);
            const poly = document.getElementById('radarPoly' + suffix);
            if (!grid || grid.childElementCount) return poly; // já construído, não duplica

            [.28, .52, .76, 1].forEach(k => {
                const p = document.createElementNS(NS, 'polygon');
                p.setAttribute('points', axes.map((_, i) => pt(i, R * k).join(',')).join(' '));
                grid.appendChild(p);
            });
            axes.forEach((ax, i) => {
                const [x, y] = pt(i, R);
                const l = document.createElementNS(NS, 'line');
                l.setAttribute('x1', CX); l.setAttribute('y1', CY); l.setAttribute('x2', x); l.setAttribute('y2', y);
                axesG.appendChild(l);

                const [dx, dy] = pt(i, R * ax.v);
                const c = document.createElementNS(NS, 'circle');
                c.setAttribute('cx', dx); c.setAttribute('cy', dy); c.setAttribute('r', 2);
                c.setAttribute('class', 'radar-dot');
                dots.appendChild(c);

                // rótulo + valor, empurrados para fora do polígono
                const [lx, ly] = pt(i, LR);
                const anchor = Math.abs(lx - CX) < 6 ? 'middle' : (lx > CX ? 'start' : 'end');
                const ox = anchor === 'middle' ? 0 : (lx > CX ? -4 : 4);

                const val = document.createElementNS(NS, 'text');
                val.setAttribute('x', lx + ox); val.setAttribute('y', ly - 2);
                val.setAttribute('text-anchor', anchor);
                val.setAttribute('class', 'radar-val');
                val.setAttribute('fill', ax.v >= .8 ? '#7BE0F5' : (ax.v >= .7 ? '#8FBBFF' : '#C3A6FF'));
                val.textContent = Math.round(ax.v * 100) + '%';
                labels.appendChild(val);

                const lab = document.createElementNS(NS, 'text');
                lab.setAttribute('x', lx + ox); lab.setAttribute('y', ly + 7);
                lab.setAttribute('text-anchor', anchor);
                lab.setAttribute('class', 'radar-label');
                lab.textContent = ax.label;
                labels.appendChild(lab);
            });
            poly.setAttribute('points', axes.map((ax, i) => pt(i, R * ax.v).join(',')).join(' '));
            return poly;
        }

        const poly = buildRadarInto('');
        const dots = document.getElementById('radarDots');
        const labels = document.getElementById('radarLabels');

        // Construção amarrada ao scroll: começa quando o celular ainda está
        // entrando na tela e só termina quando ele já está bem visível — dando
        // tempo real de acompanhar o desenho se formando.
        const phoneEl = document.querySelector('.phone');
        const radarUpdate = () => {
            const r = phoneEl.getBoundingClientRect();
            const start = window.innerHeight * 0.92;
            const end = window.innerHeight * 0.34;
            const p = clamp((start - r.top) / (start - end), 0, 1);
            poly.style.transform = `scale(${(0.05 + 0.95 * p).toFixed(3)})`;
            poly.style.opacity = String(clamp(p * 1.25, 0, 1));
            dots.style.opacity = String(clamp((p - 0.7) / 0.3, 0, 1));
            labels.style.opacity = String(clamp((p - 0.8) / 0.2, 0, 1));
        };
        radarUpdate();
        window.addEventListener('scroll', radarUpdate, { passive: true });
        window.addEventListener('resize', radarUpdate);

        // Expõe pro módulo do modal de diagnóstico construir a versão grande.
        window.__buildRadarInto = buildRadarInto;
    })();

    /* ══════════════════════════════════════════
       7. TRILHA — fases acendem em sequência, uma vez, ao entrar na tela
       ══════════════════════════════════════════ */
    (() => {
        const cards = [...document.querySelectorAll('.tcard')];
        const nodes = [...document.querySelectorAll('.track-node')];
        const fill = document.getElementById('railFill');
        const cardsRow = document.getElementById('trackCards');
        if (!cards.length || !cardsRow) return;

        let active = -2;
        const setActive = i => {
            if (i === active) return;
            active = i;
            cards.forEach((c, k) => c.classList.toggle('on', k === i));
            nodes.forEach((n, k) => n.classList.toggle('on', k <= i));
            fill.style.width = `${i < 0 ? 0 : ((i + 0.5) / cards.length) * 100}%`;
        };

        if (reduce) { setActive(cards.length - 1); return; }

        // Preso à posição do scroll (sobe = recua, desce = avança), medido pela
        // fileira de cards em si — não pela seção inteira, que começa lá em cima
        // com o título e fazia o cálculo "gastar" distância de rolagem antes dos
        // cards sequer aparecerem. A faixa vai de quando o topo da fileira ainda
        // está perto do rodapé da tela até quase sair por cima, dando ritmo
        // suficiente pra acompanhar as 4 fases uma a uma.
        const update = () => {
            const r = cardsRow.getBoundingClientRect();
            const vh = window.innerHeight;
            const start = vh * 0.95;
            const end = vh * -0.15;
            const p = clamp((start - r.top) / (start - end), 0, 1);
            setActive(p <= 0 ? -1 : clamp(Math.floor(p * cards.length), 0, cards.length - 1));
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
    })();

    /* Módulos: a flutuação e o lift no hover agora são só CSS
       (@keyframes tileFloat + transição no :hover), sem JS. */

    /* ══════════════════════════════════════════
       9. MENTORES — foto girando + troca ao rolar
       ══════════════════════════════════════════ */
    (() => {
        const scroller = document.getElementById('mentorScroll');
        const disc = document.getElementById('mentorDisc');
        const faces = [...document.querySelectorAll('.mentor-face')];
        const items = [...document.querySelectorAll('.mentor-item')];
        const counter = document.getElementById('mentorCounter');
        const bar = document.getElementById('mentorBar');
        if (!scroller) return;

        const N = items.length;
        // Uma "tela" de scroll por mentor + um respiro no fim
        scroller.style.height = `${N * 100 + 30}vh`;

        let cur = -1;
        const update = () => {
            const rect = scroller.getBoundingClientRect();
            const total = scroller.offsetHeight - window.innerHeight;
            const raw = clamp(-rect.top / Math.max(total, 1), 0, 1);
            // ignora o respiro final no cálculo do índice
            const p = clamp(raw / 0.93, 0, 1);
            const i = clamp(Math.floor(p * N), 0, N - 1);

            // A foto gira e inclina conforme o scroll (efeito da referência 4)
            const spin = p * 360;                       // rotação no plano
            const tiltY = Math.sin(p * Math.PI * 2 * 2) * 13;
            const tiltX = Math.cos(p * Math.PI * 2 * 2) * 7;
            disc.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${spin}deg)`;
            // O conteúdo interno gira ao contrário para o nome/rosto ficar sempre legível
            disc.style.setProperty('--spin', `${-spin}deg`);

            bar.style.width = `${p * 100}%`;

            if (i !== cur) {
                cur = i;
                faces.forEach((f, k) => f.classList.toggle('on', k === i));
                items.forEach((it, k) => it.classList.toggle('on', k === i));
                counter.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(N).padStart(2, '0')}`;
            }
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
    })();

    /* ══════════════════════════════════════════
       10. DEPOIMENTOS — marquee infinito
       ══════════════════════════════════════════ */
    (() => {
        const data = [
            ['Larissa M.', 'Dev Front-end · fintech', '#2B4AA8', '#1B2A6B', 5, 'Entrei sem saber o que era uma variável. Sete meses depois assinei carteira como front-end júnior. A diferença foi ter um caminho claro em vez de vídeo solto no YouTube.'],
            ['Diego R.', 'Full Stack · agência', '#1F6E8C', '#0E3A4C', 5, 'O módulo de Node destravou tudo. Eu sabia montar tela, mas não sabia de onde vinham os dados. Hoje entrego API e front no mesmo projeto.'],
            ['Bruna C.', 'Dev Júnior · saúde', '#5B3FA8', '#2E2166', 5, 'Estudava de madrugada depois do turno no hospital. O formato modular foi o que permitiu continuar. Larguei a escala 12x36 no ano seguinte.'],
            ['Thiago A.', 'Freelancer', '#1F7A63', '#0D3D31', 5, 'Fechei meu primeiro freela no meio da formação, com o projeto do módulo 4 no portfólio. Pagou o curso inteiro e sobrou.'],
            ['Ana Paula', 'Dev Back-end · varejo', '#8C4A2B', '#4A2517', 5, 'A mentoria de carreira mudou o jogo. Eu já sabia codar, mas meu currículo não passava do filtro. Refiz tudo na aula e comecei a ser chamada.'],
            ['Marcos V.', 'Dev Full Stack · logística', '#2B4AA8', '#152C63', 5, 'O que mais valeu foi o code review nas lives. Ver alguém sênior apontar o que está errado no seu código acelera anos de aprendizado.'],
            ['Juliana S.', 'Dev Front-end · edtech', '#5B3FA8', '#33235C', 5, 'Aos 38 anos, migrando do administrativo. Achei que era tarde. Não era — era só questão de método e de não estudar sozinha.'],
            ['Rafael P.', 'Dev Júnior · seguros', '#1F6E8C', '#123846', 5, 'Projeto final no ar com Docker e domínio próprio. Foi literalmente a primeira coisa que o entrevistador abriu na chamada.'],
            ['Camila F.', 'Dev Full Stack · startup', '#1F7A63', '#0F4136', 5, 'Comunidade ativa é o detalhe que ninguém conta. Travei num bug por dois dias, postei e resolveram em vinte minutos.'],
            ['Gustavo L.', 'Dev Back-end · banco', '#8C4A2B', '#54301D', 5, 'Saí de operador de caixa para desenvolvedor no mesmo banco. Mostrei o portfólio na avaliação interna e abriram a vaga.']
        ];

        const star = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.8.8-5 4.7 1.3 6.8L12 17.3 6 20.6l1.3-6.8-5-4.7 6.8-.8z"/></svg>';

        const card = ([name, role, c1, c2, n, txt]) => `
    <article class="quote">
      <div class="quote-stars" aria-label="${n} de 5 estrelas">${star.repeat(n)}</div>
      <p>${txt}</p>
      <div class="quote-who">
        <div class="avatar" style="background:linear-gradient(150deg,${c1},${c2})" aria-hidden="true">${name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
        <div><b>${name}</b><small>${role}</small></div>
      </div>
    </article>`;

        const build = (rowId, list) => {
            const row = document.getElementById(rowId);
            const inner = document.createElement('div');
            inner.className = 'marquee';
            // 3 cópias: o loop desloca exatamente 1/3, sem buraco em telas largas
            const html = list.map(card).join('');
            inner.innerHTML = html + html + html;
            row.appendChild(inner);
        };
        build('row1', data.slice(0, 5));
        build('row2', data.slice(5));
    })();

    /* ══════════════════════════════════════════
       11. FAQ
       ══════════════════════════════════════════ */
    document.querySelectorAll('.faq-item').forEach(item => {
        const btn = item.querySelector('.faq-q');
        const panel = item.querySelector('.faq-a');
        btn.addEventListener('click', () => {
            const open = item.classList.contains('open');
            document.querySelectorAll('.faq-item.open').forEach(o => {
                o.classList.remove('open');
                o.querySelector('.faq-a').style.height = '0px';
                o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
            });
            if (!open) {
                item.classList.add('open');
                panel.style.height = panel.scrollHeight + 'px';
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });
    window.addEventListener('resize', () => {
        const open = document.querySelector('.faq-item.open .faq-a');
        if (open) open.style.height = open.scrollHeight + 'px';
    });

    /* ══════════════════════════════════════════
       12. Scroll suave com compensação da navbar
       ══════════════════════════════════════════ */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const id = a.getAttribute('href');
            if (id === '#' || id.length < 2) return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            const y = target.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
        });
    });

    /* ══════════════════════════════════════════
       13. SUPORTE — bolha flutuante + painel de contato
       ══════════════════════════════════════════ */
    (() => {
        const fab = document.getElementById('supportFab');
        const panel = document.getElementById('supportPanel');
        if (!fab || !panel) return;

        const setOpen = open => {
            document.body.classList.toggle('support-open', open);
            fab.setAttribute('aria-expanded', String(open));
            panel.setAttribute('aria-hidden', String(!open));
        };
        const toggle = () => setOpen(!document.body.classList.contains('support-open'));

        fab.addEventListener('click', toggle);

        document.addEventListener('click', e => {
            if (!document.body.classList.contains('support-open')) return;
            if (panel.contains(e.target) || fab.contains(e.target)) return;
            setOpen(false);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') setOpen(false);
        });
    })();

    /* ══════════════════════════════════════════
       14. DIAGNÓSTICO — o radar "vem pra frente" ao apertar o botão do celular
       ══════════════════════════════════════════ */
    (() => {
        const btn = document.getElementById('phBtn');
        const backdrop = document.getElementById('diagBackdrop');
        const modal = document.getElementById('diagModal');
        const card = document.getElementById('diagCard');
        const closeBtn = document.getElementById('diagClose');
        const phoneEl = document.querySelector('.phone');
        if (!btn || !modal || !card) return;

        // Constrói a versão grande do radar (mesma função usada no celular). O
        // preenchimento (.radar-poly) começa em opacity:0/scale(.05) por CSS —
        // no celular isso é controlado pelo scroll, mas aqui é um retrato estático,
        // então precisa forçar pra visível na hora, senão fica vazio por dentro.
        if (window.__buildRadarInto) {
            const poly2 = window.__buildRadarInto('2');
            if (poly2) { poly2.style.transform = 'scale(1)'; poly2.style.opacity = '1'; }
        }

        let busy = false;
        function openDiag() {
            if (busy) return;
            busy = true;
            document.body.classList.add('diag-open');
            modal.setAttribute('aria-hidden', 'false');
            backdrop.setAttribute('aria-hidden', 'false');

            if (!reduce && phoneEl) {
                // Efeito "vem pra frente": parte pequeno, exatamente de cima do
                // celular, e cresce/centraliza até virar o cartão grande.
                const cardRect = card.getBoundingClientRect();
                const phoneRect = phoneEl.getBoundingClientRect();
                const dx = (phoneRect.left + phoneRect.width / 2) - (cardRect.left + cardRect.width / 2);
                const dy = (phoneRect.top + phoneRect.height / 2) - (cardRect.top + cardRect.height / 2);
                const scale = clamp(phoneRect.width / cardRect.width, 0.25, 1);
                card.style.transition = 'none';
                card.style.transform = `translate(${dx}px,${dy}px) scale(${scale})`;
                card.style.opacity = '0.5';
                void card.offsetWidth; // força reflow antes de tirar a transição
                card.style.transition = '';
                requestAnimationFrame(() => {
                    card.style.transform = '';
                    card.style.opacity = '';
                });
            }
            setTimeout(() => { busy = false; }, 500);
        }

        function closeDiag() {
            document.body.classList.remove('diag-open');
            modal.setAttribute('aria-hidden', 'true');
            backdrop.setAttribute('aria-hidden', 'true');
        }

        btn.addEventListener('click', openDiag);
        closeBtn?.addEventListener('click', closeDiag);
        backdrop.addEventListener('click', closeDiag);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.body.classList.contains('diag-open')) closeDiag();
        });
    })();
})();
