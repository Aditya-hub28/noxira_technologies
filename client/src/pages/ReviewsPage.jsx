import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Heart, Send, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { SAMPLE_REVIEWS, AVATAR_HUES, Stars, ReviewCard } from '../components/reviewShared';
import './reviews.css';

/*
 * Student Reviews page.
 * Approved reviews come from the backend (submissions stay hidden until an
 * admin approves them). Until launch, the approved 15-review sample set
 * shows whenever no live approved reviews exist yet, so the page never sits
 * empty (his call, 22 Nov: mock reviews stay until hosting, then get
 * removed). The explicit ?demo=1 preview additionally labels the samples as
 * demo data. Samples are never sent to the server.
 */

function RatingInput({ value, onChange }) {
  return (
    <div className="rv-rate" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          className={i <= value ? 'on' : ''}
          onClick={() => onChange(i)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={i <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [form, setForm] = useState({ name: '', role: '', feedback: '', website: '' });
  const [rating, setRating] = useState(0);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('info');
  const [submitting, setSubmitting] = useState(false);
  // 'loading' | 'live' | 'empty' | 'error'
  const [feedState, setFeedState] = useState('loading');
  const [apiReviews, setApiReviews] = useState(null);
  // The approved sample set shows whenever no live reviews exist yet;
  // ?demo=1 additionally labels the samples as demo data.
  const [demoMode] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setNoticeKind('info');
      setNotice('Please pick a star rating first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitReview({
        name: form.name,
        role: form.role,
        text: form.feedback,
        rating,
        website: form.website
      });
      setNoticeKind('ok');
      setNotice(res.message || 'Thank you! Your feedback was submitted and will appear after review.');
      setForm({ name: '', role: '', feedback: '', website: '' });
      setRating(0);
    } catch (err) {
      setNoticeKind('info');
      const serverMessage = err && err.data && err.data.message;
      if (err && err.status === 429) {
        setNotice(serverMessage || 'Too many submissions from your network. Please try again later.');
      } else if (serverMessage && err.status && err.status < 500) {
        setNotice(serverMessage);
      } else {
        setNotice('Feedback submission is not connected in this preview, so nothing was sent. Once the site is deployed with its backend, submitted reviews are saved and appear after admin approval.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rv">
      <span className="glow" aria-hidden="true" />
      <section className="rv-head">
        <div className="wrap">
          <p className="kick">STUDENT REVIEWS</p>
          <h1>
            See what our interns have to say about their journey with <span className="ac">NOXIRA</span>.
          </h1>
          <p className="lede">Your experience matters to us.</p>
          {sampleMode && (
            <p className="rv-demo">
              <Info width={13} height={13} aria-hidden="true" />
              Demo preview: these 15 reviews are sample data, not real students. Real reviews appear here once interns complete programmes and their feedback is approved.
            </p>
          )}
        </div>
      </section>

      <section className="rv-gridsec">
        <div className="wrap">
          {feedState === 'loading' && !showSamples && (
            <p className="rv-state" role="status">Loading reviews...</p>
          )}
          {feedState === 'empty' && !showSamples && (
            <p className="rv-state">No reviews yet. Feedback from interns appears here after it is reviewed and approved. Yours could be the first - share your story below.</p>
          )}
          {feedState === 'error' && !showSamples && (
            <p className="rv-state">Reviews could not be loaded right now. Please try again later.</p>
          )}
          <div className="rv-grid">
            {reviews.map((r) => (
              <ReviewCard key={r.key} review={r} hue={r.hue} />
            ))}
          </div>
        </div>
      </section>

      <section className="rv-storysec">
        <div className="wrap">
          <div className="rv-story">
            <span className="rv-strip" aria-hidden="true" />
            <div className="rv-form">
              <h2><Info width={16} height={16} aria-hidden="true" /> Share Your Story</h2>
              <p>Your feedback helps us improve and guides future students. If you had a positive experience, we would love to hear it!</p>
              <form onSubmit={submit}>
                <div className="rv-row">
                  <div>
                    <label htmlFor="rv-name">Your Name</label>
                    <input id="rv-name" required placeholder="e.g. Rahul Sharma" value={form.name} onChange={set('name')} autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="rv-role">Your Role</label>
                    <input id="rv-role" required placeholder="e.g. Web Dev Intern" value={form.role} onChange={set('role')} />
                  </div>
                </div>
                <label htmlFor="rv-feedback">Your Feedback</label>
                <textarea id="rv-feedback" required rows={4} maxLength={600} value={form.feedback} onChange={set('feedback')} />
                {/* honeypot: hidden from people, bots fill it and get dropped server-side */}
                <input
                  type="text"
                  name="website"
                  className="rv-hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={form.website}
                  onChange={set('website')}
                />
                <label>Your Rating</label>
                <RatingInput value={rating} onChange={setRating} />
                <button type="submit" className="rv-send" disabled={submitting}><Send width={14} height={14} aria-hidden="true" /> {submitting ? 'Submitting...' : 'Submit Feedback'}</button>
                {notice && <p role="status" className={`rv-notice${noticeKind === 'ok' ? ' ok' : ''}`}>{notice}</p>}
              </form>
            </div>
            <div className="rv-thanks">
              <Heart width={42} height={42} strokeWidth={1.6} aria-hidden="true" />
              <b>Thank you for your contribution!</b>
              <p>Join our community and help us build the future of tech education.</p>
              <Link to="/" className="rv-back"><ArrowLeft width={13} height={13} aria-hidden="true" /> Back to Home</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
