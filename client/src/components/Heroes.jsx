import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/all';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import '../heroes.css';

const LEDE =
  "Turn your knowledge into practical skills with NOXIRA's project-based online internships. Take on hands-on tasks, build projects, and submit your work for evaluation. Complete the program to earn a NOXIRA certificate and showcase what you've built as you take your next step beyond the classroom.";

function useIntro(fn, deps = []) {
  const root = useRef(null);
  useEffect(() => {
    let ctx;
    let done = false;
    let tws = [];
    let disposed = false;

    const go = () => {
      if (done || disposed || !root.current) return;
      done = true;
      ctx = gsap.context(() => {
        tws = fn(root.current) || [];
      }, root.current);
      tws.forEach((t) => t && t.pause && t.pause());
    };

    const start = () => {
      if (!done) go();
      tws.forEach((t) => t && t.play && t.play());
    };

    if (window.__nxPrepared) go();
    else window.addEventListener('noxira:prepare', go, { once: true });

    const onMount = () => {
      window.__nxMounted = 1;
      start();
    };
    if (window.__nxMounted || document.documentElement.classList.contains('nx-ready')) {
      start();
    } else {
      window.addEventListener('noxira:mount', onMount, { once: true });
    }

    const fb = setTimeout(() => {
      go();
      start();
    }, 4000);

    return () => {
      disposed = true;
      clearTimeout(fb);
      window.removeEventListener('noxira:prepare', go);
      window.removeEventListener('noxira:mount', onMount);
      tws.forEach((t) => t && t.kill && t.kill());
      if (ctx) ctx.revert();
    };
  }, deps);
  return root;
}

export default function Hero({ googleForm1Url, isFormConfigured, noteMessage, onServicesClick }) {
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 800;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 800);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const POOL = [
    'WEBSITES',
    'PROJECTS',
    'AI AUTOMATION',
    'JOURNEY',
    'APPS',
    'CERTIFICATES',
    'INTERNSHIPS',
    'PROJECTS',
    'TRAINING',
    'WEBSITES',
  ];

  const allRows = isMobile
    ? [
        ['WEBSITES'],
        ['APPS'],
        ['AI AUTOMATION'],
        ['INTERNSHIPS'],
        ['PROJECTS', 'CERTIFICATES'],
        ['JOURNEY'],
        ['PROJECTS'],
        ['WEBSITES', 'TRAINING'],
      ]
    : [
        ['WEBSITES', 'PROJECTS'],
        ['AI AUTOMATION', 'APPS'],
        ['INTERNSHIPS', 'JOURNEY'],
        ['CERTIFICATES', 'TRAINING'],
        ['PROJECTS'],
        ['WEBSITES'],
      ];

  const root = useIntro((r) => {
    const tw = [];
    const DS = [52, 74, 43, 33, 60, 48];
    const PH = [0.463, 0.373, 0.139, 0.867, 0.61, 0.25];
    const MV = [30, 38, 27, 32, 35, 24, 34, 28];
    const MP = [0.07, 0.83, 0.61, 0.77, 0.18, 0.4, 0.48, 0.85];

    const convs = [];
    const cleanups = [];
    let isVisible = true;
    let isPlaying = false;
    let alive = true;

    r.querySelectorAll('.mq').forEach((row, i) => {
      const m = window.matchMedia('(max-width:800px)').matches;
      // Even rows move left (-1), odd rows move right (1)
      const dir = i % 2 === 0 ? -1 : 1;
      const phase = m ? MP[i % 8] : PH[i % 6];
      const speed = () => (m ? MV[i % 8] : (DS[i % 6] * window.innerWidth) / 1440);

      const originalSpans = [...row.querySelectorAll('span')].map((s) => {
        const copy = s.cloneNode(true);
        gsap.set(copy, { clearProps: 'all' });
        return copy;
      });
      const ulen = originalSpans.length;

      let blockWidth = 0;
      let x = 0;
      let tickerRunning = false;

      const build = () => {
        gsap.set(row, { clearProps: 'x,transform' });
        row.innerHTML = '';

        // Add 1 base unit to measure initial unit width
        originalSpans.forEach((s) => row.appendChild(s.cloneNode(true)));
        const unitWidth = [...row.children].reduce((sum, el) => sum + el.offsetWidth, 0) || 1;
        const parentW = row.parentElement ? row.parentElement.clientWidth : window.innerWidth;

        // Number of unit repetitions in Block 1 (ensure blockWidth > parentW + 400 and even word count for alternating .o pattern)
        let reps = Math.max(2, Math.ceil((parentW + 400) / unitWidth));
        if ((reps * ulen) % 2 !== 0) reps += 1;

        // Build Block 1
        row.innerHTML = '';
        for (let u = 0; u < reps; u++) {
          for (let j = 0; j < ulen; j++) {
            const c = originalSpans[j].cloneNode(true);
            c.classList.toggle('o', (u * ulen + j + i) % 2 === 1);
            row.appendChild(c);
          }
        }

        // Measure Block 1 width
        blockWidth = [...row.children].reduce((sum, el) => sum + el.offsetWidth, 0) || 1;

        // Build Block 2 (identical duplicate of Block 1 for infinite seamless looping)
        for (let u = 0; u < reps; u++) {
          for (let j = 0; j < ulen; j++) {
            const c = originalSpans[j].cloneNode(true);
            c.classList.toggle('o', (u * ulen + j + i) % 2 === 1);
            row.appendChild(c);
          }
        }

        // Set initial phase offset
        x = -(phase * blockWidth);
        gsap.set(row, { x, force3D: true });
      };

      const tick = (time, dt) => {
        if (!blockWidth) return;
        const delta = Math.min(dt || 16.7, 50);
        const move = (speed() * delta) / 1000;

        if (dir === -1) {
          // Moving left: x decreases towards -blockWidth
          x -= move;
          if (x <= -blockWidth) {
            x += blockWidth;
          }
        } else {
          // Moving right: x increases towards 0
          x += move;
          if (x >= 0) {
            x -= blockWidth;
          }
        }
        gsap.set(row, { x, force3D: true });
      };

      const startT = () => {
        if (!tickerRunning && isVisible && isPlaying) {
          gsap.ticker.add(tick);
          tickerRunning = true;
        }
      };

      const stopT = () => {
        if (tickerRunning) {
          gsap.ticker.remove(tick);
          tickerRunning = false;
        }
      };

      build();

      cleanups.push(() => {
        stopT();
      });

      const ctl = {
        play() {
          isPlaying = true;
          startT();
        },
        pause() {
          isPlaying = false;
          stopT();
        },
        updateVisibility(vis) {
          if (vis) startT();
          else stopT();
        },
        rebuild() {
          build();
        },
      };

      convs.push(ctl);
      tw.push(ctl);
    });

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          isVisible = entries[0].isIntersecting;
          convs.forEach((c) => c.updateVisibility(isVisible));
        },
        { rootMargin: '100px 0px' }
      );
      observer.observe(r);
      cleanups.push(() => observer.disconnect());
    }

    tw.push({
      kill() {
        alive = false;
        cleanups.forEach((fn) => fn());
      },
    });

    tw.push(
      gsap.from(r.querySelectorAll('.mqw'), {
        opacity: 0,
        x: (i) => (i % 2 ? -80 : 80),
        duration: 1.4,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.2,
      })
    );
    tw.push(
      gsap.from(r.querySelectorAll('.hl > span'), {
        yPercent: 115,
        duration: 1.3,
        ease: 'power3.out',
        stagger: 0.16,
        delay: 0.5,
      })
    );
    tw.push(
      gsap.from(r.querySelectorAll('.hv-in'), {
        y: 28,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.95,
      })
    );

    const mqs = r.querySelector('.mqs');
    const fit = () => {
      if (!mqs) return;
      const ws = [...mqs.children];
      const nat =
        ws.reduce((a, w) => a + w.offsetHeight, 0) +
        parseFloat(getComputedStyle(mqs).rowGap || 0) * (ws.length - 1);
      // Fit the stack to the conveyor's own box (not the viewport height) and keep a
      // small margin so the tilted rows never slice at the top or bottom edge.
      const area = mqs.clientHeight || window.innerHeight;
      mqs.style.setProperty(
        '--fit',
        Math.min(1.6, Math.max(0.45, (area * 0.95) / (nat * Math.cos((3 * Math.PI) / 180)))).toFixed(3)
      );
    };

    let lw = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lw) return;
      lw = window.innerWidth;
      fit();
      convs.forEach((c) => c.rebuild());
    };
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));

    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      if (!alive) return;
      fit();
      convs.forEach((c) => c.rebuild());
    });

    return tw;
  }, [isMobile]);

  const handleServicesClick = (e) => {
    e.preventDefault();
    if (onServicesClick) {
      onServicesClick();
    } else {
      const t = document.getElementById('services');
      const sm = ScrollSmoother.get();
      if (sm && t) {
        sm.scrollTo(t, true, 'top 90px');
      } else if (t) {
        t.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="hv hv2" ref={root}>
      <div className="lt" />
      <div className="lt2" />
      <div className="mqs" key={isMobile ? 'mobile-conveyor' : 'desktop-conveyor'}>
        {allRows.map((r, i) => (
          <div className="mqw" key={i}>
            <div className="mq">
              {r.map((w, j) => (
                <span key={j} className={(j + i) % 2 ? 'o' : ''}>
                  {w}
                  <em>/</em>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hv-c one">
        <div className="rd">
          <div className="rdbg" />
          <h1 className="big hq">
            <i className="hl">
              <span>The best way to learn</span>
            </i>
            <i className="hl">
              <span className="ac">
                is to build something real<b className="pd">.</b>
              </span>
            </i>
          </h1>
          <p className="lede hv-in">{LEDE}</p>
          <div className="hv-in">
            <div className="hv-cta">
              <Link
                to="/apply"
                className="gb pri inline-flex items-center gap-2"
                title="Browse programs and apply"
              >
                Apply now
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href="#services"
                onClick={handleServicesClick}
                className="gb inline-flex items-center"
              >
                Our services
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
