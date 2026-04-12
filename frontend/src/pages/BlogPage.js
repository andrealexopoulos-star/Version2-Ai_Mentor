/**
 * BlogPage — "Blog" marketing page.
 *
 * Sections: Hero (with search + category filters), Featured Article,
 * Article Grid (3-col), Newsletter CTA. Uses WebsiteLayout.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import { BLOG_ARTICLES } from '../data/blogArticles';
import { Clock, ArrowRight, Search } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const CATEGORIES = ['All', ...new Set(BLOG_ARTICLES.map(a => a.category))];

const CAT_COLORS = {
  Strategy: '#3B82F6', Healthcare: '#10B981', Finance: '#10B981',
  Manufacturing: '#F59E0B', Retail: '#7C3AED', Construction: '#10B981',
  Legal: '#EF4444', SMB: '#E85D00', Technology: '#3B82F6',
  Operations: '#F59E0B', Marketing: '#7C3AED', 'Real Estate': '#10B981',
  Education: '#10B981', Future: '#E85D00', Regional: '#3B82F6',
  'AI & Intelligence': '#E85D00', Leadership: '#A855F7',
  Product: '#EF4444', Compliance: '#0EA5E9',
};

const GRADIENTS = [
  'linear-gradient(135deg, #F59E0B, #F97316)',
  'linear-gradient(135deg, #3B82F6, #6366F1)',
  'linear-gradient(135deg, #10B981, #059669)',
  'linear-gradient(135deg, #8B5CF6, #A855F7)',
  'linear-gradient(135deg, #E85D00, #EF4444)',
  'linear-gradient(135deg, #0EA5E9, #3B82F6)',
];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState('idle'); // idle | subscribing | subscribed

  const filtered = BLOG_ARTICLES
    .filter(a => activeCategory === 'All' || a.category === activeCategory)
    .filter(a => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #080C14 0%, #0B1120 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.15] tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
            Blog
          </h1>
          <p className="text-lg max-w-[580px] mx-auto leading-relaxed mb-10"
            style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Insights on AI, business intelligence, and the future of decision-making.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto relative mb-6">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-muted, #708499)' }} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full h-12 pl-11 pr-4 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00]"
              style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border-card, rgba(140,170,210,0.12))', color: 'var(--ink-body, #C8D4E4)' }}
              data-testid="blog-search" />
          </div>

          {/* Category filters */}
          <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 sm:flex-wrap sm:justify-center" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
              const color = CAT_COLORS[cat] || '#E85D00';
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
                  style={{
                    background: activeCategory === cat ? color : 'var(--surface, #0E1628)',
                    color: activeCategory === cat ? 'white' : 'var(--ink-secondary, #8FA0B8)',
                    border: `1px solid ${activeCategory === cat ? 'transparent' : 'var(--border-card, rgba(140,170,210,0.12))'}`,
                  }}
                  data-testid={`blog-cat-${cat.toLowerCase()}`}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Article */}
      {featured && (
        <section className="pb-16 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
          <div className="max-w-[1120px] mx-auto">
            <Link to={`/blog/${featured.slug}`}
              className="block rounded-xl overflow-hidden transition-all hover:border-white/20"
              style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border-card, rgba(140,170,210,0.12))' }}
              data-testid="blog-featured">
              <div className="grid md:grid-cols-2">
                <div className="min-h-[280px] md:min-h-[320px] flex items-center justify-center relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #E85D00 0%, #FF8A3D 40%, #FFB980 100%)' }}>
                  <span className="text-[56px] font-bold relative z-10"
                    style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    BIQc
                  </span>
                  <div className="absolute w-[200px] h-[200px] border-2 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ borderColor: 'rgba(255,255,255,0.15)' }} />
                  <div className="absolute w-[300px] h-[300px] border-2 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                </div>
                <div className="p-10 flex flex-col justify-center">
                  <span className="inline-block self-start text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded mb-4"
                    style={{ background: `${CAT_COLORS[featured.category] || '#E85D00'}15`, color: CAT_COLORS[featured.category] || '#E85D00' }}>
                    {featured.category}
                  </span>
                  <h2 className="text-[26px] font-bold leading-snug tracking-tight mb-3.5"
                    style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
                    {featured.title}
                  </h2>
                  <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-[13px] mb-5" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                    <span>BIQc Team</span>
                    <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#5C6E82' }} />
                    <span>{new Date(featured.publishDate).toLocaleDateString('en-AU', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--lava, #E85D00)' }}>
                    Read Article <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Article Grid */}
      <section className="pb-20 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          {rest.length > 0 && (
            <h2 className="text-[28px] font-semibold tracking-tight mb-8"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              Latest articles
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rest.map((article, i) => {
              const catColor = CAT_COLORS[article.category] || '#E85D00';
              const grad = GRADIENTS[i % GRADIENTS.length];
              return (
                <Link key={article.slug} to={`/blog/${article.slug}`}
                  className="group rounded-[10px] overflow-hidden flex flex-col transition-all hover:border-white/20 hover:shadow-lg"
                  style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border-card, rgba(140,170,210,0.12))' }}
                  data-testid={`blog-card-${article.slug}`}>
                  {/* Gradient image */}
                  <div className="h-40 flex items-center justify-center relative overflow-hidden" style={{ background: grad }}>
                    <span className="text-[32px] font-bold relative z-10"
                      style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="p-6 flex-1 flex flex-col">
                    <span className="inline-block self-start text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded mb-3"
                      style={{ background: `${catColor}15`, color: catColor }}>
                      {article.category}
                    </span>
                    <h3 className="text-base font-semibold leading-snug mb-2.5 group-hover:text-[#E85D00] transition-colors"
                      style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                      {article.title}
                    </h3>
                    <p className="text-sm leading-relaxed mb-4 flex-1 line-clamp-3" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-[13px]" style={{ color: '#5C6E82' }}>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {article.readTime}
                      </div>
                      <span>{new Date(article.publishDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: 'var(--ink-muted, #708499)' }}>No articles match your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="pb-24 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="rounded-2xl p-14 text-center"
            style={{
              background: 'linear-gradient(105deg, rgba(200,220,240,0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0) 55%), linear-gradient(180deg, rgba(140,170,210,0.04) 0%, rgba(140,170,210,0.01) 100%)',
              border: '1px solid rgba(140,170,210,0.15)',
            }}>
            <h2 className="text-[28px] font-semibold tracking-tight mb-2.5"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              Stay informed
            </h2>
            <p className="text-base mb-7 max-w-[440px] mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Get the latest insights on AI, business intelligence, and data-driven strategy delivered to your inbox.
            </p>
            <form className="flex flex-col sm:flex-row gap-2.5 max-w-[440px] mx-auto"
              onSubmit={(e) => {
                e.preventDefault();
                if (subscribeStatus !== 'idle') return;
                setSubscribeStatus('subscribing');
                setTimeout(() => {
                  setSubscribeStatus('subscribed');
                  setEmail('');
                  setTimeout(() => setSubscribeStatus('idle'), 3000);
                }, 1000);
              }}>
              <input type="email" placeholder="Enter your email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={subscribeStatus !== 'idle'}
                className="flex-1 px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[#E85D00]/20 focus:border-[#E85D00] disabled:opacity-60"
                style={{ background: 'var(--bg-secondary, #0B1120)', border: '1px solid var(--border-card, rgba(140,170,210,0.12))', color: 'var(--ink-body, #C8D4E4)' }} />
              <button type="submit"
                disabled={subscribeStatus !== 'idle'}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ background: subscribeStatus === 'subscribed' ? '#16A34A' : 'var(--lava, #E85D00)' }}>
                {subscribeStatus === 'subscribing' ? 'Subscribing...' : subscribeStatus === 'subscribed' ? 'Subscribed' : 'Subscribe'}
              </button>
            </form>
            <p className="text-xs mt-4 max-w-[440px] mx-auto" style={{ color: '#5C6E82' }}>
              No spam. Unsubscribe anytime. We respect your privacy.
            </p>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
