import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/all';
import { ExternalLink } from 'lucide-react';
import '../heroes.css';

const LEDE =
  "Turn your knowledge into practical skills with NOXIRA's project-based online internships. Take on hands-on tasks, build projects, and submit your work for evaluation. Complete the program to earn a NOXIRA certificate and showcase what you've built as you take your next step beyond the classroom.";

function useIntro(fn, deps = []) {
  const root = useRef(null);
  useEffect(() => {
    let ctx;
    let done = false;
    let tws = [];

    const go = () => {
      if (done || !root.current) return;
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

    if (window.__nxMounted || document.documentElement.classList.contains('nx-ready')) {
      start();
    } else {
      window.addEventListener(
        'noxira:mount',
        () => {
          window.__nxMounted = 1;
          start();
        },
        { once: true }
      );
    }

    const fb = setTimeout(() => {
      go();
      start();
    }, 4000);

    return () => {
      clearTimeout(fb);
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
    'SKILL COURSE',
    'TRAINING',
    'CAREER TOOLS',
  ];

  const allRows = isMobile
    ? POOL.map((_, i) => {
        const r = POOL.slice(i).concat(POOL.slice(0, i));
        return i % 2 ? r.slice().reverse() : r;
      })
    : [
        ['WEBSITES', 'PROJECTS'],
        ['AI AUTOMATION', 'APPS'],
        ['INTERNSHIPS', 'JOURNEY'],
        ['CERTIFICATES', 'TRAINING'],
        ['SKILL COURSE'],
        ['CAREER TOOLS'],
      ];

  const root = useIntro((r) => {
    const tw = [];
    const DS = [52, 74, 43, 33, 60, 48];
    const PH = [0.463, 0.373, 0.139, 0.867, 0.61, 0.25];
    const MV = [30, 38, 27, 32, 35, 24, 34, 28];
    const MP = [0.07, 0.83, 0.61, 0.77, 0.18, 0.4, 0.48, 0.85];

    const convs = [];
    r.querySelectorAll('.mq').forEach((row, i) => {
      const m = window.matchMedia('(max-width:800px)').matches;
      const dir = i % 2 ? -1 : 1;
      const phase = m ? MP[i % 8] : PH[i % 6];
      const speed = () => (m ? MV[i % 8] : (DS[i % 6] * window.innerWidth) / 1440);
      const unit = [...row.children];
      const ulen = unit.length;
      let spans = unit;
      let w = [];
      let left = [];
      let total = 1;
      let head = 0;
      let built = false;
      let want = false;
      let on = false;
      let vis = true;

      const paint = () => {
        for (let j = 0; j < spans.length; j++) {
          let px = left[j] - head;
          if (px < -w[j]) px += total;
          gsap.set(spans[j], { x: px - left[j], force3D: true });
        }
      };

      const tick = (t, dt) => {
        dt = Math.min(dt || 16.7, 100);
        head = (head + (dir * speed() * dt) / 1000) % total;
        if (head < 0) head += total;
        paint();
      };

      const startT = () => {
        if (!on && built && want && vis) {
          gsap.ticker.add(tick);
          on = true;
        }
      };

      const stopT = () => {
        if (on) {
          gsap.ticker.remove(tick);
          on = false;
        }
      };

      const build = () => {
        const frac = built ? head / total : phase;
        while (row.children.length > ulen) row.removeChild(row.lastChild);
        const uw = unit.map((s2) => s2.offsetWidth);
        const unitW = uw.reduce((a, b) => a + b, 0);
        const maxW = Math.max.apply(null, uw);
        const parentW = row.parentElement ? row.parentElement.clientWidth : window.innerWidth;
        const reps = Math.max(1, Math.ceil((parentW + maxW) / (unitW || 1)));
        for (let u = 1; u < reps; u++) {
          for (let j = 0; j < ulen; j++) {
            const c = unit[j].cloneNode(true);
            c.classList.toggle('o', (u * ulen + j + i) % 2 === 1);
            row.appendChild(c);
          }
        }
        spans = [...row.children];
        w = spans.map((s2) => s2.offsetWidth);
        left = [];
        let acc = 0;
        for (const x of w) {
          left.push(acc);
          acc += x;
        }
        total = acc || 1;
        head = frac * total;
        built = true;
        paint();
        startT();
      };

      const ctl = {
        pause() {
          want = false;
          stopT();
        },
        play() {
          want = true;
          startT();
        },
        rebuild() {
          if (built) build();
        },
      };

      build();
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);

      if (typeof IntersectionObserver !== 'undefined') {
        const observer = new IntersectionObserver((en) => {
          vis = en[0].isIntersecting;
          if (vis) startT();
          else stopT();
        });
        observer.observe(r);
      }

      convs.push(ctl);
      tw.push(ctl);
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
      mqs.style.setProperty(
        '--fit',
        Math.min(1.6, Math.max(0.85, (window.innerHeight * 1) / (nat * Math.cos((3 * Math.PI) / 180)))).toFixed(3)
      );
    };

    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      fit();
      let lw = window.innerWidth;
      const onResize = () => {
        if (window.innerWidth === lw) return;
        lw = window.innerWidth;
        fit();
        convs.forEach((c) => c.rebuild());
      };
      window.addEventListener('resize', onResize);
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
      <div className="mqs">
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
              {isFormConfigured ? (
                <a
                  href={googleForm1Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gb pri inline-flex items-center gap-2"
                  title="Apply via official Google Form"
                >
                  Apply now
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title={noteMessage}
                  className="gb pri opacity-60 cursor-not-allowed"
                >
                  Apply now
                </button>
              )}
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
