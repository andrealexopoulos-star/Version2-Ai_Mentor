import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import { BLOG_ARTICLES } from '../data/blogArticles';
import { Clock, ArrowRight, Search, Tag } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const CATEGORIES = ['All', ...new Set(BLOG_ARTICLES.map(a => a.category))];
const CAT_COLORS = { Strategy: '#FF6A00', Healthcare: '#10B981', Finance: '#3B82F6', Manufacturing: '#F59E0B', Retail: '#7C3AED', Construction: '#059669', Legal: '#EF4444', SMB: '#FF6A00', Technology: '#3B82F6', Operations: '#F59E0B', Marketing: '#7C3AED', 'Real Estate': '#059669', Education: '#10B981', Future: '#FF6A00', Regional: '#3B82F6' };

const BlogPage = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = BLOG_ARTICLES
    .filter(a => activeCategory === 'All' || a.category === activeCategory)
    .filter(a => !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.excerpt.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <WebsiteLayout>
      <div style={{ background: '#0F1720', minHeight: '100vh', paddingTop: '64px' }} data-testid="blog-page">
        {/* Hero */}
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase block mb-4" style={{ color: '#FF6A00', fontFamily: MONO }}>Intelligence Blog</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" style={{ fontFamily: HEAD, color: '#F4F7FA' }}>
            AI Is Reshaping Business.<br />
            <span style={{ color: '#FF6A00' }}>Are You Keeping Up?</span>
          </h1>
          <p className="text-base text-[#9FB0C3] max-w-2xl mx-auto mb-8" style={{ fontFamily: BODY }}>
            Evidence-based analysis of how AI is transforming industries. Every statistic cited. Every source verified.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto relative mb-8">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full h-12 pl-11 pr-4 rounded-xl text-sm outline-none"
              style={{ background: '#141C26', border: '1px solid #243140', color: '#F4F7FA', fontFamily: BODY }}
              data-testid="blog-search" />
          </div>

          {/* Category filters */}
          <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-hide justify-center sm:flex-wrap" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: activeCategory === cat ? (CAT_COLORS[cat] || '#FF6A00') : '#141C26',
                  color: activeCategory === cat ? 'white' : '#9FB0C3',
                  border: `1px solid ${activeCategory === cat ? 'transparent' : '#243140'}`,
                  fontFamily: MONO,
                }}
                data-testid={`blog-cat-${cat.toLowerCase()}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles Grid */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(article => {
              const catColor = CAT_COLORS[article.category] || '#FF6A00';
              return (
                <Link key={article.slug} to={`/blog/${article.slug}`}
                  className="group rounded-xl overflow-hidden transition-all hover:-translate-y-1"
                  style={{ background: '#141C26', border: '1px solid #243140' }}
                  data-testid={`blog-card-${article.slug}`}>
                  <div className="h-2" style={{ background: catColor }} />
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: catColor, background: catColor + '15', fontFamily: MONO }}>{article.category}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{article.industry}</span>
                    </div>
                    <h3 className="text-base font-semibold mb-2 leading-snug group-hover:text-[#FF6A00] transition-colors" style={{ color: '#F4F7FA', fontFamily: HEAD }}>{article.title}</h3>
                    <p className="text-xs text-[#9FB0C3] mb-4 leading-relaxed line-clamp-3" style={{ fontFamily: BODY }}>{article.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>
                        <Clock className="w-3 h-3" />
                        {article.readTime}
                      </div>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{new Date(article.publishDate).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-[#64748B]">No articles match your search.</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="rounded-xl p-8 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#F4F7FA', fontFamily: HEAD }}>Ready to see AI intelligence in action?</h3>
            <p className="text-sm text-[#9FB0C3] mb-4" style={{ fontFamily: BODY }}>Experience sovereign business intelligence for your company.</p>
            <Link to="/register-supabase" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="blog-cta">
              Try It Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </WebsiteLayout>
  );
};

export default BlogPage;
