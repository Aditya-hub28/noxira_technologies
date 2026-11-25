import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { SAMPLE_REVIEWS, AVATAR_HUES, ReviewCard } from './reviewShared';
import '../pages/reviews.css';

/*
 * Homepage Student Reviews marquee: the final content section, a continuous
 * right-to-left auto-scrolling strip of review cards (pauses on hover).
 * Live approved reviews from the backend always win. Until launch, the
 * approved 15-review sample set shows whenever no live reviews exist yet, so
 * the section stays visible (his call, 22 Nov: mock reviews stay until
 * hosting, then get removed). The explicit ?demo=1 preview additionally
 * labels the samples as demo data. Samples are never sent to the server.
 */
export default function ReviewMarquee() {
  // 'loading' | 'live' | 'empty' | 'error'
  const [feedState, setFeedState] = useState('loading');
  const [apiReviews, setApiReviews] = useState(null);
  const [demoMode] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');

  useEffect(() => {
    let alive = true;
    api.getApprovedReviews()
      .then((res) => {
        if (!alive) return;
        if (res && Array.isArray(res.reviews) && res.reviews.length > 0) {
          setApiReviews(res.reviews);
          setFeedState('live');
        } else {
          setFeedState('empty');
        }
      })
      .catch(() => {
        if (alive) setFeedState('error');
      });
    return () => { alive = false; };
  }, []);

  const showSamples = feedState === 'empty' || feedState === 'error';
  const sampleMode = showSamples && demoMode;
  const reviews = useMemo(() => {
    const source = feedState === 'live' ? apiReviews : (showSamples ? SAMPLE_REVIEWS : []);
    return (source || []).map((r, i) => ({
      key: r._id || r.name,
      name: r.name,
      role: r.role,
      text: r.text,
      rating: r.rating,
      hue: AVATAR_HUES[i % AVATAR_HUES.length]
    }));
  }, [apiReviews, feedState, showSamples]);

  if (reviews.length === 0) return null;

  // Repeat the set so the strip always overflows the viewport, then render
  // two identical tracks for a seamless -50% loop.
  const loopItems = [];
  while (loopItems.length < Math.max(10, reviews.length)) {
    loopItems.push(...reviews);
  }
  const durationSeconds = Math.max(28, loopItems.length * 3.2);

  return (
    <section id="reviews" className="rv-marquee-sec">
      <div className="wrap">
        <p className="kick rv">04 - STUDENT REVIEWS</p>
        <h2 className="rv">What our interns say.</h2>
        {sampleMode && (
          <p className="rv-demo rv">
            <Info width={13} height={13} aria-hidden="true" />
            Demo preview: these reviews are sample data, not real students. Real reviews appear here once interns complete programmes and their feedback is approved.
          </p>
        )}
      </div>
      <div className="rv-marquee rv" aria-label="Student reviews, automatically scrolling">
        <div className="rv-mtrack" style={{ animationDuration: `${durationSeconds}s` }}>
          {[0, 1].map((copy) => (
            <div className="rv-mset" key={copy} aria-hidden={copy === 1}>
              {loopItems.map((r, i) => (
                <ReviewCard key={`${copy}-${r.key}-${i}`} review={r} hue={r.hue} marquee />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="wrap rv-mmore">
        <Link to="/reviews" className="rv-mcta">
          Read all reviews &amp; share your story
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
