(() => {
    document.documentElement.classList.add('js');

    const html = document.documentElement;

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle?.addEventListener('click', () => {
        const next = html.dataset.theme === 'light' ? 'dark' : 'light';
        html.dataset.theme = next;
        localStorage.setItem('theme', next);
    });

    // Language toggle
    const langToggle = document.getElementById('lang-toggle');
    langToggle?.addEventListener('click', () => {
        const next = html.dataset.lang === 'pt' ? 'en' : 'pt';
        html.dataset.lang = next;
        html.lang = next;
        localStorage.setItem('lang', next);
    });

    // CV dropdown
    const cvToggle = document.getElementById('cv-toggle');
    const cvDropdown = document.getElementById('cv-dropdown');
    cvToggle?.addEventListener('click', () => {
        cvDropdown.classList.toggle('open');
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.cv-wrapper')) {
            cvDropdown?.classList.remove('open');
        }
    });

    // Scroll reveal (stagger on first appearance, instant after)
    const revealed = new WeakSet();
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(e => {
                if (e.isIntersecting && !revealed.has(e.target)) {
                    revealed.add(e.target);
                    e.target.classList.add('visible');
                    // After the staggered transition finishes, reset delay to 0
                    const delay = parseFloat(e.target.style.transitionDelay) || 0;
                    setTimeout(() => { e.target.style.transitionDelay = '0s'; }, (delay + 0.5) * 1000);
                } else {
                    e.target.classList.toggle('visible', e.isIntersecting);
                }
            });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    // Assign stagger delays to timeline entries
    document.querySelectorAll('.tl-entry').forEach((el, i) => {
        el.style.transitionDelay = (i * 0.05) + 's';
    });

    document.querySelectorAll('.tl-entry, .project, .github-stats, .oss, .uses, .map').forEach(el => observer.observe(el));

    // Typewriter for section titles
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        function visibleText(el) {
            let t = '';
            el.childNodes.forEach(n => {
                if (n.nodeType === 3) t += n.textContent;
                else if (n.nodeType === 1 && getComputedStyle(n).display !== 'none')
                    t += visibleText(n);
            });
            return t;
        }

        function typewrite(h2) {
            if (h2._typeAnim) h2._typeAnim.cancel();
            h2.style.maxWidth = 'none';
            const w = h2.getBoundingClientRect().width;
            const chars = visibleText(h2).length;
            if (!chars) return;
            h2.style.maxWidth = '';
            h2.classList.add('typing');
            h2._typeAnim = h2.animate(
                [{ maxWidth: '0px' }, { maxWidth: w + 'px' }],
                { duration: chars * 60, easing: 'steps(' + chars + ')', fill: 'forwards' }
            );
            h2._typeAnim.onfinish = () => {
                setTimeout(() => h2.classList.remove('typing'), 600);
            };
        }

        const typeObs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const h2 = e.target.querySelector('h2');
                if (h2) setTimeout(() => typewrite(h2), 500);
                typeObs.unobserve(e.target);
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('h2').forEach(h2 => {
            if (h2.parentElement) typeObs.observe(h2.parentElement);
        });
    }

    // Modal open
    document.addEventListener('click', e => {
        if (e.target.closest('a[href]')) return;
        const btn = e.target.closest('[data-modal]');
        if (!btn) return;
        const dialog = document.getElementById('modal-' + btn.dataset.modal);
        if (!dialog) return;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        dialog.querySelectorAll('.slideshow').forEach(s =>
            s.dispatchEvent(new Event('open-slideshow'))
        );
        // Play standalone videos (non-slideshow)
        dialog.querySelectorAll('.modal-media:not(.slideshow) video').forEach(v => {
            v.currentTime = 0;
            v.play();
        });
    });

    // Modal close
    document.querySelectorAll('.modal').forEach(dialog => {
        dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', e => {
            if (e.target === dialog) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.body.style.overflow = '';
            dialog.querySelectorAll('.modal-media:not(.slideshow) video').forEach(v => v.pause());
        });
    });

    // GitHub stats
    async function fetchGitHubStats() {
        const fallback = { repos: '20+', langs: 'Python, Go, JS' };
        try {
            const [userRes, reposRes] = await Promise.all([
                fetch('https://api.github.com/users/paulofilip3'),
                fetch('https://api.github.com/users/paulofilip3/repos?per_page=100')
            ]);
            if (!userRes.ok || !reposRes.ok) throw new Error('API error');
            const user = await userRes.json();
            const repos = await reposRes.json();

            const langCount = {};
            repos.forEach(r => {
                if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
            });
            const topLangs = Object.entries(langCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([l]) => l)
                .join(', ');

            return { repos: user.public_repos, langs: topLangs || fallback.langs };
        } catch {
            return fallback;
        }
    }

    fetchGitHubStats().then(data => {
        const reposEl = document.getElementById('gh-repos');
        const langsEl = document.getElementById('gh-langs');
        if (reposEl) { reposEl.textContent = data.repos; reposEl.classList.remove('skeleton'); }
        if (langsEl) { langsEl.textContent = data.langs; langsEl.classList.remove('skeleton'); }
    });

    // Contribution graph
    function pad2(n) { return String(n).padStart(2, '0'); }

    async function fetchContribGraph() {
        try {
            const res = await fetch('https://github-contributions-api.jogruber.de/v4/paulofilip3?y=last');
            if (!res.ok) throw new Error();
            return await res.json();
        } catch {
            return null;
        }
    }

    function renderContribGraph(data) {
        const grid = document.getElementById('contrib-grid');
        const monthsEl = document.getElementById('contrib-months');
        const totalEl = document.getElementById('gh-contrib-total');
        if (!grid || !data?.contributions) return;

        const total = data.total?.lastYear ?? data.contributions.reduce((s, c) => s + c.count, 0);
        totalEl.textContent = total;
        totalEl.classList.remove('skeleton');

        const map = {};
        data.contributions.forEach(c => { map[c.date] = { level: c.level, count: c.count }; });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(start.getDate() - 39 * 7 - start.getDay());

        const step = 13;
        let weekCol = 0;
        let lastMonth = -1;

        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            const key = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

            if (dow === 0 && d.getTime() !== start.getTime()) weekCol++;

            if (dow === 0) {
                const month = d.getMonth();
                if (month !== lastMonth) {
                    const label = document.createElement('span');
                    const en = d.toLocaleDateString('en', { month: 'short' });
                    const pt = d.toLocaleDateString('pt', { month: 'short' }).replace(/\.$/, '').replace(/^./, c => c.toUpperCase());
                    label.innerHTML = '<span lang="en">' + en + '</span><span lang="pt">' + pt + '</span>';
                    label.style.left = (weekCol * step) + 'px';
                    monthsEl.appendChild(label);
                    lastMonth = month;
                }
            }

            const info = map[key];
            const count = info?.count ?? 0;
            const cell = document.createElement('span');
            cell.className = 'contrib-cell';
            cell.dataset.level = info?.level ?? 0;
            const lang = html.dataset.lang;
            const dateStr = lang === 'pt'
                ? d.toLocaleDateString('pt', { month: 'short', day: 'numeric' }).replace(/\.$/, '')
                : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
            cell.dataset.tooltip = count + (count === 1 ? ' contribution' : ' contributions') + ' — ' + dateStr;
            grid.appendChild(cell);
        }
    }

    fetchContribGraph().then(renderContribGraph);

    // Slideshows — only run while their modal is open
    document.querySelectorAll('.slideshow').forEach(show => {
        const slides = show.querySelectorAll('img, video');
        if (slides.length < 2) return;
        const dialog = show.closest('dialog');
        if (!dialog) return;
        let idx = 0;
        let timer = null;
        let running = false;

        function stop() {
            running = false;
            clearTimeout(timer);
            timer = null;
            const current = slides[idx];
            if (current.tagName === 'VIDEO') {
                current.removeEventListener('ended', next);
                current.pause();
            }
        }

        function reset() {
            stop();
            slides[idx].classList.remove('active');
            idx = 0;
            slides[0].classList.add('active');
        }

        function go(dir) {
            if (!running) return;
            clearTimeout(timer);
            timer = null;
            const prev = slides[idx];
            if (prev.tagName === 'VIDEO') {
                prev.removeEventListener('ended', next);
                prev.pause();
            }
            prev.classList.remove('active');
            idx = (idx + dir + slides.length) % slides.length;
            slides[idx].classList.add('active');
            schedule();
        }

        function next() { go(1); }

        function schedule() {
            if (!running) return;
            const current = slides[idx];
            if (current.tagName === 'VIDEO') {
                current.currentTime = 0;
                current.play();
                current.addEventListener('ended', next, { once: true });
            } else {
                timer = setTimeout(() => go(1), 5000);
            }
        }

        // Touch swipe
        let startX = 0;
        show.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
        show.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        });

        dialog.addEventListener('close', reset);

        show.addEventListener('open-slideshow', () => {
            running = true;
            schedule();
        });
    });

    // Contribution graph tooltips (fixed position to avoid overflow clipping)
    const tooltip = document.createElement('div');
    tooltip.className = 'contrib-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    document.querySelector('.contrib-grid')?.addEventListener('mouseover', e => {
        const cell = e.target.closest('.contrib-cell[data-tooltip]');
        if (!cell) return;
        const rect = cell.getBoundingClientRect();
        tooltip.textContent = cell.dataset.tooltip;
        tooltip.style.display = '';
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - 6) + 'px';
        tooltip.style.transform = 'translate(-50%, -100%)';
    });

    document.querySelector('.contrib-grid')?.addEventListener('mouseout', e => {
        if (e.target.closest('.contrib-cell')) tooltip.style.display = 'none';
    });

    // Sticky sidebar scroll (desktop)
    const heroLeft = document.querySelector('.hero-left');
    if (heroLeft) {
        let lastY = window.scrollY;
        let stickyTop = 0;
        let heroHeight = heroLeft.offsetHeight;
        const mq = window.matchMedia('(min-width: 960px)');

        new ResizeObserver(() => { heroHeight = heroLeft.offsetHeight; }).observe(heroLeft);

        window.addEventListener('scroll', () => {
            if (!mq.matches) {
                lastY = window.scrollY;
                stickyTop = 0;
                heroLeft.style.top = '';
                return;
            }
            const dy = window.scrollY - lastY;
            lastY = window.scrollY;
            const minTop = Math.min(0, window.innerHeight - heroHeight);
            stickyTop = Math.max(minTop, Math.min(0, stickyTop - dy));
            heroLeft.style.top = stickyTop + 'px';
        }, { passive: true });
    }
})();
