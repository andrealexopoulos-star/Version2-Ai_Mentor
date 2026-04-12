import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import { BLOG_ARTICLES } from '../data/blogArticles';
import { ArrowLeft, Clock, ArrowRight, Tag, ExternalLink } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const CAT_COLORS = { Strategy: '#E85D00', Healthcare: '#10B981', Finance: '#3B82F6', Manufacturing: '#F59E0B', Retail: '#7C3AED', Construction: '#10B981', Legal: '#EF4444', SMB: '#E85D00', Technology: '#3B82F6', Operations: '#F59E0B', Marketing: '#7C3AED', 'Real Estate': '#10B981', Education: '#10B981', Future: '#E85D00', Regional: '#3B82F6' };

// Simple markdown-like renderer for article content
const RenderContent = ({ content }) => {
  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-semibold mt-8 mb-3" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{line.replace('## ', '')}</h2>);
    } else if (line.startsWith('**Source:**')) {
      // Extract source citation
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      const sourceText = line.replace('**Source:**', '').replace(urlMatch?.[0] || '', '').trim();
      elements.push(
        <div key={i} className="my-3 p-3 rounded-lg flex items-start gap-2" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
          <ExternalLink className="w-3.5 h-3.5 text-[#E85D00] shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-semibold tracking-wider uppercase block mb-0.5" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Source</span>
            <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{sourceText}</span>
            {urlMatch && (
              <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] block mt-0.5 break-all" style={{ fontFamily: fontFamily.mono }}>
                {urlMatch[0]}
              </a>
            )}
          </div>
        </div>
      );
    } else if (line.trim() === '') {
      // skip empty lines
    } else {
      // Regular paragraph - handle bold text
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={i} className="text-sm leading-relaxed mb-4" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="text-[#EDF1F7]">{part.replace(/\*\*/g, '')}</strong>;
            }
            return part;
          })}
        </p>
      );
    }
    i++;
  }

  return <>{elements}</>;
};

const BlogArticlePage = () => {
  const { slug } = useParams();
  const article = BLOG_ARTICLES.find(a => a.slug === slug);

  if (!article) return <Navigate to="/blog" replace />;

  const catColor = CAT_COLORS[article.category] || '#E85D00';
  const relatedArticles = BLOG_ARTICLES.filter(a => a.slug !== slug && (a.category === article.category || a.industry === article.industry)).slice(0, 3);

  return (
    <WebsiteLayout>
      <div style={{ background: 'var(--biqc-bg)', minHeight: '100vh', paddingTop: '64px' }} data-testid="blog-article-page">
        <article className="max-w-3xl mx-auto px-6 py-12">
          {/* Back */}
          <Link to="/blog" className="inline-flex items-center gap-2 mb-8 text-sm text-[#64748B] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.body }} data-testid="blog-back">
            <ArrowLeft className="w-4 h-4" /> Back to all articles
          </Link>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: catColor, background: catColor + '15', fontFamily: fontFamily.mono }}>{article.category}</span>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{article.industry}</span>
            <div className="flex items-center gap-1 text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              <Clock className="w-3 h-3" />
              {article.readTime}
            </div>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              {new Date(article.publishDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{article.title}</h1>
          <p className="text-base text-[#9FB0C3] mb-8 leading-relaxed" style={{ fontFamily: fontFamily.body }}>{article.excerpt}</p>

          <div className="h-px mb-8" style={{ background: 'rgba(140,170,210,0.15)' }} />

          {/* Content */}
          <div className="prose-dark">
            <RenderContent content={article.content} />
          </div>

          <div className="h-px my-8" style={{ background: 'rgba(140,170,210,0.15)' }} />

          {/* CTA */}
          <div className="rounded-xl p-6 text-center mb-8" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>See these insights in action for your business</h3>
            <p className="text-sm text-[#9FB0C3] mb-4" style={{ fontFamily: fontFamily.body }}>BIQc surfaces real intelligence from your connected business systems.</p>
            <Link to="/register-supabase" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#E85D00' }} data-testid="article-cta">
              Try It Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Related */}
          {relatedArticles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Related Articles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedArticles.map(ra => (
                  <Link key={ra.slug} to={`/blog/${ra.slug}`}
                    className="rounded-lg p-4 transition-all hover:bg-white/[0.02]"
                    style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] px-2 py-0.5 rounded mb-2 inline-block" style={{ color: CAT_COLORS[ra.category] || '#E85D00', background: (CAT_COLORS[ra.category] || '#E85D00') + '15', fontFamily: fontFamily.mono }}>{ra.category}</span>
                    <h4 className="text-sm font-semibold mb-1 line-clamp-2" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{ra.title}</h4>
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{ra.readTime}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </WebsiteLayout>
  );
};

export default BlogArticlePage;
