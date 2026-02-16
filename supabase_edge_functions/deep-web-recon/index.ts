import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * BIQc Deep-Web-Recon Edge Function
 * 
 * MANDATE: Zero-Presumption Intelligence
 * - Ingests: Website, LinkedIn, X, IG, FB handles
 * - Performs: SWOT (competitor news, staff sentiment, customer reviews)
 * - Writes: biqc_insights, intelligence_actions, observation_events
 * - Enforces: [Read/Action/Ignore] toggles on every signal
 * - Attention Protection: If delta < 2%, suppress with "Signal Stable"
 * 
 * SECRETS REQUIRED (Supabase Edge Function Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, FIRECRAWL_API_KEY
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface SWOTResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface ReconSignal {
  source: string;
  summary: string;
  severity: "high" | "medium" | "low";
  category: "competitor" | "sentiment" | "market" | "operational";
}

interface ReconResponse {
  swot: SWOTResult;
  signals: ReconSignal[];
  executive_summary: string;
  crawl_hash: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, website, linkedin, twitter, instagram, facebook } = body;

    console.log("[RECON] deep-web-recon invoked", {
      user_id,
      has_website: !!website,
      has_linkedin: !!linkedin,
      has_twitter: !!twitter,
      has_instagram: !!instagram,
      has_facebook: !!facebook,
      timestamp: new Date().toISOString(),
    });

    if (!user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "user_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ═══ PHASE 1: MULTI-CHANNEL SCRAPE ═══
    const crawlTargets = [
      { url: website, source: "website" },
      { url: linkedin, source: "linkedin" },
      { url: twitter, source: "twitter" },
      { url: instagram, source: "instagram" },
      { url: facebook, source: "facebook" },
    ].filter((t) => t.url && t.url.trim());

    let scrapedContent: { source: string; content: string }[] = [];

    for (const target of crawlTargets) {
      try {
        let url = target.url.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }

        // Attempt Firecrawl scrape if key exists
        if (FIRECRAWL_KEY) {
          console.log(`[RECON] Scraping ${target.source}: ${url}`);
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${FIRECRAWL_KEY}`,
            },
            body: JSON.stringify({
              url: url,
              formats: ["markdown"],
              onlyMainContent: true,
              timeout: 15000,
            }),
          });

          if (scrapeRes.ok) {
            const scrapeData = await scrapeRes.json();
            const markdown =
              scrapeData.data?.markdown || scrapeData.data?.content || "";
            if (markdown.length > 50) {
              scrapedContent.push({
                source: target.source,
                content: markdown.substring(0, 3000),
              });
              console.log(
                `[RECON] ✅ ${target.source}: ${markdown.length} chars`
              );
            }
          } else {
            console.warn(
              `[RECON] ⚠️ ${target.source} scrape failed: ${scrapeRes.status}`
            );
          }
        } else {
          // Fallback: use URL as context without scraping
          scrapedContent.push({
            source: target.source,
            content: `[${target.source}] URL: ${url} — content not scraped (no FIRECRAWL_API_KEY)`,
          });
        }
      } catch (e) {
        console.warn(`[RECON] ${target.source} scrape error: ${(e as Error).message}`);
        scrapedContent.push({
          source: target.source,
          content: `[${target.source}] URL: ${target.url} — scrape failed`,
        });
      }
    }

    // ═══ PHASE 2: GET BUSINESS CONTEXT ═══
    let businessName = "Unknown Business";
    let industry = "";

    try {
      const { data: profile } = await supabase
        .from("business_profiles")
        .select("business_name, industry, target_market, main_challenges")
        .eq("user_id", user_id)
        .maybeSingle();

      if (profile) {
        businessName = profile.business_name || businessName;
        industry = profile.industry || "";
      }
    } catch (e) {
      console.warn("[RECON] Profile fetch failed, falling back to users table");
    }

    // Fallback: users table (company_name → business_name mapping)
    if (businessName === "Unknown Business") {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("company_name, industry")
          .eq("id", user_id)
          .maybeSingle();
        if (user) {
          businessName = user.company_name || businessName;
          industry = user.industry || industry;
        }
      } catch {}
    }

    // ═══ PHASE 3: GET PREVIOUS CRAWL FOR DELTA COMPARISON ═══
    let previousHash = "";
    let previousCrawlTime: string | null = null;

    try {
      const { data: prev } = await supabase
        .from("biqc_insights")
        .select("insight_payload, last_deep_crawl, crawl_delta_percentage")
        .eq("user_id", user_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prev?.insight_payload) {
        previousHash = JSON.stringify(prev.insight_payload).substring(0, 200);
        previousCrawlTime = prev.last_deep_crawl;
      }
    } catch {}

    // ═══ PHASE 4: AI SWOT SYNTHESIS ═══
    const scrapeSummary = scrapedContent
      .map((s) => `### ${s.source.toUpperCase()}\n${s.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are BIQc's Strategic Intelligence Engine. Zero-Presumption mandate: only state what is evidenced in the data provided. Do NOT invent competitors, staff reviews, or customer sentiment that is not visible in the scraped content. If insufficient data exists for a SWOT category, state "Insufficient signal — requires deeper recon."`;

    const userPrompt = `BUSINESS: ${businessName}
INDUSTRY: ${industry}
PREVIOUS CRAWL: ${previousCrawlTime || "First crawl — no baseline"}

SCRAPED INTELLIGENCE:
${scrapeSummary || "No content scraped — generate assessment from business context only"}

GENERATE:
1. SWOT analysis — ONLY from evidenced data. Include:
   - Strengths: What the business demonstrably does well
   - Weaknesses: Gaps or vulnerabilities visible from public data
   - Opportunities: Market signals, competitor gaps, timing windows
   - Threats: Competitive pressure, regulatory, market shifts
2. 3-5 actionable intelligence signals with severity (high/medium/low) and category (competitor/sentiment/market/operational)
3. A crawl_hash: first 32 chars of a hash representing the content state (for delta detection)
4. One-paragraph executive summary

Respond with JSON ONLY:
{
  "swot": { "strengths": ["..."], "weaknesses": ["..."], "opportunities": ["..."], "threats": ["..."] },
  "signals": [{ "source": "linkedin|twitter|market|...", "summary": "...", "severity": "high|medium|low", "category": "competitor|sentiment|market|operational" }],
  "executive_summary": "...",
  "crawl_hash": "..."
}`;

    console.log("[RECON] Calling OpenAI for SWOT synthesis...");

    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[RECON] OpenAI error:", errText);
      return new Response(
        JSON.stringify({ ok: false, error: "AI synthesis failed", detail: errText.substring(0, 200) }),
        { status: 500, headers: corsHeaders }
      );
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let cleaned = rawContent.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.split("\n", 1 + 1)[1] || cleaned;
      cleaned = cleaned.replace(/```\s*$/, "").trim();
    }

    let recon: ReconResponse;
    try {
      recon = JSON.parse(cleaned);
    } catch {
      console.error("[RECON] JSON parse failed, raw:", cleaned.substring(0, 200));
      return new Response(
        JSON.stringify({ ok: false, error: "AI response was not valid JSON" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("[RECON] ✅ SWOT generated:", {
      strengths: recon.swot?.strengths?.length || 0,
      weaknesses: recon.swot?.weaknesses?.length || 0,
      opportunities: recon.swot?.opportunities?.length || 0,
      threats: recon.swot?.threats?.length || 0,
      signals: recon.signals?.length || 0,
    });

    // ═══ PHASE 5: DELTA DETECTION ═══
    const currentHash = recon.crawl_hash || JSON.stringify(recon.swot).substring(0, 32);
    const hashMatch = previousHash && currentHash === previousHash.substring(0, 32);

    // Calculate approximate delta percentage
    let deltaPercentage = 100; // First crawl = 100% new
    if (previousHash) {
      const prevChars = previousHash.split("");
      const currChars = currentHash.split("");
      let matches = 0;
      for (let i = 0; i < Math.min(prevChars.length, currChars.length); i++) {
        if (prevChars[i] === currChars[i]) matches++;
      }
      const similarity = prevChars.length > 0 ? (matches / prevChars.length) * 100 : 0;
      deltaPercentage = Math.round(100 - similarity);
    }

    const now = new Date().toISOString();

    // ═══ PHASE 6: ATTENTION PROTECTION ═══
    if (deltaPercentage < 2 && previousCrawlTime) {
      console.log("[RECON] Delta < 2% — Signal Stable");

      // Update biqc_insights with stable status
      await supabase.from("biqc_insights").upsert(
        {
          user_id,
          status: "stable",
          insight_payload: recon.swot,
          last_deep_crawl: now,
          crawl_delta_percentage: deltaPercentage,
          updated_at: now,
        },
        { onConflict: "user_id", ignoreDuplicates: false }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          suppressed: true,
          message: "Signal Stable: Executive Attention Preserved",
          delta_percentage: deltaPercentage,
          last_crawl: previousCrawlTime,
          current_crawl: now,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ═══ PHASE 7: WRITE INTELLIGENCE LAYERS ═══

    // 7a. Write to biqc_insights (primary SWOT store)
    console.log("[RECON] Writing to biqc_insights...");
    const { error: insightError } = await supabase.from("biqc_insights").upsert(
      {
        user_id,
        status: "ready",
        insight_payload: {
          swot: recon.swot,
          executive_summary: recon.executive_summary,
          sources_crawled: crawlTargets.map((t) => t.source),
          content_lengths: scrapedContent.map((s) => ({
            source: s.source,
            chars: s.content.length,
          })),
        },
        last_deep_crawl: now,
        crawl_delta_percentage: deltaPercentage,
        updated_at: now,
      },
      { onConflict: "user_id", ignoreDuplicates: false }
    );

    if (insightError) {
      console.error("[RECON] biqc_insights write failed:", insightError);
      // Fallback: try insert without upsert
      await supabase.from("biqc_insights").insert({
        user_id,
        status: "ready",
        insight_payload: {
          swot: recon.swot,
          executive_summary: recon.executive_summary,
        },
        last_deep_crawl: now,
        crawl_delta_percentage: deltaPercentage,
      });
    }

    // 7b. Write signals to intelligence_actions with [Read/Action/Ignore] status
    console.log("[RECON] Writing intelligence_actions...");
    let signalsWritten = 0;

    for (const signal of recon.signals || []) {
      try {
        await supabase.from("intelligence_actions").insert({
          user_id,
          signal_source: signal.source || "recon",
          content_summary: signal.summary || "",
          status: signal.severity === "high" ? "action_required" : "read",
          created_at: now,
        });
        signalsWritten++;
      } catch (e) {
        console.warn("[RECON] Signal write failed:", (e as Error).message);
      }
    }

    // 7c. Write SWOT to observation_events for Watchtower
    console.log("[RECON] Writing observation_events...");
    try {
      await supabase.from("observation_events").insert({
        user_id,
        domain: "market",
        event_type: "deep_web_recon",
        payload: {
          swot: recon.swot,
          executive_summary: recon.executive_summary,
          delta_percentage: deltaPercentage,
          sources: crawlTargets.map((t) => t.source),
        },
        source: "deep-web-recon",
        severity: deltaPercentage > 20 ? "warning" : "info",
        observed_at: now,
      });
    } catch (e) {
      console.warn("[RECON] Observation write failed:", (e as Error).message);
    }

    // 7d. Update social_handles in business_profiles
    try {
      const socialHandles: Record<string, string> = {};
      if (linkedin) socialHandles.linkedin = linkedin;
      if (twitter) socialHandles.twitter = twitter;
      if (instagram) socialHandles.instagram = instagram;
      if (facebook) socialHandles.facebook = facebook;

      if (Object.keys(socialHandles).length > 0) {
        await supabase
          .from("business_profiles")
          .update({
            social_handles: socialHandles,
            updated_at: now,
          })
          .eq("user_id", user_id);
      }
    } catch (e) {
      console.warn("[RECON] Social handles update failed:", (e as Error).message);
    }

    console.log("[RECON] ✅ Recon complete", {
      user_id,
      signals_written: signalsWritten,
      delta_percentage: deltaPercentage,
      sources_crawled: crawlTargets.length,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        suppressed: false,
        status: "complete",
        swot: recon.swot,
        executive_summary: recon.executive_summary,
        signals_created: signalsWritten,
        delta_percentage: deltaPercentage,
        sources_crawled: crawlTargets.map((t) => t.source),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[RECON] Fatal error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
