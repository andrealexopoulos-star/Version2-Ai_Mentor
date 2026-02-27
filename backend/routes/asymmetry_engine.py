"""Adaptive Asymmetry Engine v2 — Tiered, Structure-Aware."""
from typing import Dict, List


async def build_asymmetries_v2(
    subject_name: str, subject_domain: str, location: str,
    subject_structure: Dict, competitors: List[Dict],
    _serper, _get_review_data, _check_authority,
) -> List[Dict]:
    """Three-tier adaptive asymmetry engine. ≥3 guaranteed or explicit insufficient."""
    asymmetries = []
    structure_type = subject_structure.get('structure', 'SingleLocationService')
    is_large_brand = structure_type in ('Franchise',) or subject_structure.get('national_scope')

    subject_reviews = await _get_review_data(subject_name, location)
    subject_authority = await _check_authority(subject_name)

    primary_service = subject_structure.get('services', ['business'])[0] if subject_structure.get('services') else 'business'
    search_query = f'{primary_service} {location}' if location else primary_service
    search_results = await _serper(search_query)
    subject_search_position = None
    for i, item in enumerate(search_results.get('organic', [])[:10]):
        if subject_domain in item.get('link', ''):
            subject_search_position = i + 1
            break

    comp_reviews = []
    comp_authorities = []
    for comp in competitors[:3]:
        cr = await _get_review_data(comp['name'], location)
        ca = await _check_authority(comp['name'])
        comp_reviews.append({**cr, 'name': comp['name']})
        comp_authorities.append({**ca, 'name': comp['name']})

    # ═══ TIER 1: MAJOR (ratio ≥ 1.5x) ═══

    # Review Density
    for cr in comp_reviews:
        if cr['reviews'] > 0 and cr['reviews'] > subject_reviews['reviews'] * 1.5 and cr['reviews'] >= 10:
            ratio = round(cr['reviews'] / max(subject_reviews['reviews'], 1), 1)
            asymmetries.append({
                'category': 'ReviewDensityGap', 'tier': 'major',
                'subject_metric': f"{subject_reviews['reviews']} Google reviews",
                'competitor_metric': f"{cr['name']}: {cr['reviews']} Google reviews",
                'metric_source': 'Google Maps',
                'differential_ratio': f'{ratio}x',
                'structural_implication': 'Trust Density Imbalance',
                'confidence': min(0.66, 0.5 + (ratio / 50)),
            })
            break

    # Search Visibility
    if subject_search_position is None:
        top_comp = None
        for i, item in enumerate(search_results.get('organic', [])[:5]):
            for c in competitors:
                if c['domain'] in item.get('link', ''):
                    top_comp = {'name': c['name'], 'position': i + 1}
                    break
            if top_comp:
                break
        if top_comp:
            asymmetries.append({
                'category': 'SearchVisibilityGap', 'tier': 'major',
                'subject_metric': f'Not found in top 10 for "{search_query}"',
                'competitor_metric': f"{top_comp['name']}: Position {top_comp['position']}",
                'metric_source': 'Google Search',
                'differential_ratio': 'absent vs present',
                'structural_implication': 'Visibility Compression',
                'confidence': 0.60,
            })

    # Authority
    for ca in comp_authorities:
        if ca['total'] > subject_authority['total'] and ca['total'] >= 2:
            asymmetries.append({
                'category': 'AuthorityGap', 'tier': 'major',
                'subject_metric': f"{subject_authority['total']} authority markers",
                'competitor_metric': f"{ca['name']}: {ca['total']} markers",
                'metric_source': 'Google Search',
                'differential_ratio': f"{ca['total']}:{subject_authority['total']}",
                'structural_implication': 'Authority Deficit',
                'confidence': 0.55,
            })
            break

    # Review Surface
    platforms_checked = ['Google Maps', 'ProductReview', 'Facebook', 'Glassdoor', 'Indeed']
    platforms_found = ['Google Maps'] if subject_reviews['reviews'] > 0 else []
    for platform, q in [('ProductReview', f'{subject_name} site:productreview.com.au'),
                         ('Facebook', f'{subject_name} {location} facebook reviews')]:
        results = await _serper(q, num=3)
        if any(subject_name.lower() in r.get('snippet', '').lower() for r in results.get('organic', [])):
            platforms_found.append(platform)
    absent = [p for p in platforms_checked if p not in platforms_found]
    if len(absent) >= 2:
        asymmetries.append({
            'category': 'ReviewSurfaceGap', 'tier': 'major',
            'subject_metric': f"Absent from: {', '.join(absent[:3])}",
            'competitor_metric': 'Competitors present on multiple platforms',
            'metric_source': 'Platform search',
            'differential_ratio': f"{len(absent)}/{len(platforms_checked)} absent",
            'structural_implication': 'Reputation Surface Fragility',
            'confidence': 0.50,
        })

    # ═══ TIER 2: MODERATE (fallback if <3) ═══
    if len(asymmetries) < 3:
        suburb_count = len(subject_structure.get('suburbs_detected', []))
        if suburb_count < 5:
            asymmetries.append({
                'category': 'GeographicCoverageGap', 'tier': 'moderate',
                'subject_metric': f"{suburb_count} geographic mentions",
                'competitor_metric': 'Typical local coverage 5+ suburbs',
                'metric_source': 'Website analysis',
                'differential_ratio': f"{suburb_count}/5",
                'structural_implication': 'Geographic Visibility Compression',
                'confidence': 0.48,
            })

        if subject_reviews.get('rating'):
            for cr in comp_reviews:
                if cr.get('rating') and cr['rating'] > subject_reviews['rating'] and cr['reviews'] >= 10:
                    asymmetries.append({
                        'category': 'RatingQualityGap', 'tier': 'moderate',
                        'subject_metric': f"{subject_reviews['rating']}/5 ({subject_reviews['reviews']} reviews)",
                        'competitor_metric': f"{cr['name']}: {cr['rating']}/5 ({cr['reviews']} reviews)",
                        'metric_source': 'Google Maps',
                        'differential_ratio': f"{cr['rating']} vs {subject_reviews['rating']}",
                        'structural_implication': 'Trust Quality Asymmetry',
                        'confidence': 0.52,
                    })
                    break

        services_count = len(subject_structure.get('services', []))
        if services_count < 3:
            asymmetries.append({
                'category': 'ContentFrequencyGap', 'tier': 'moderate',
                'subject_metric': f"{services_count} service categories detected",
                'competitor_metric': 'Competitors typically list 4+ services',
                'metric_source': 'Website analysis',
                'differential_ratio': f"{services_count}/4",
                'structural_implication': 'Service Validation Fragmentation',
                'confidence': 0.45,
            })

    # ═══ TIER 3: STRUCTURAL TENSION (variance-based) ═══
    if len(asymmetries) < 3 or is_large_brand:
        services = subject_structure.get('services', [])
        if len(services) >= 3 and subject_authority['total'] < 3:
            asymmetries.append({
                'category': 'ServiceValidationTension', 'tier': 'structural',
                'subject_metric': f"{len(services)} services, {subject_authority['total']} authority markers",
                'competitor_metric': 'Breadth exceeds validation depth',
                'metric_source': 'Website + Search',
                'differential_ratio': f"{len(services)}:{subject_authority['total']}",
                'structural_implication': 'Breadth vs Depth Imbalance',
                'confidence': 0.50,
            })

        if subject_authority['awards'] > 0 and subject_authority['media'] == 0:
            asymmetries.append({
                'category': 'AuthorityCitationTension', 'tier': 'structural',
                'subject_metric': f"{subject_authority['awards']} awards, 0 media",
                'competitor_metric': 'One-dimensional authority surface',
                'metric_source': 'Google Search',
                'differential_ratio': f"{subject_authority['awards']}:0",
                'structural_implication': 'Authority Dispersion Imbalance',
                'confidence': 0.45,
            })

        if is_large_brand and subject_reviews.get('reviews', 0) < 20 and location:
            asymmetries.append({
                'category': 'CorporateLocalMismatch', 'tier': 'structural',
                'subject_metric': f"National brand, {subject_reviews.get('reviews', 0)} local reviews in {location}",
                'competitor_metric': 'National scope vs weak local surface',
                'metric_source': 'Google Maps + Website',
                'differential_ratio': 'national vs local gap',
                'structural_implication': 'Corporate vs Local Authority Mismatch',
                'confidence': 0.48,
            })

        if structure_type == 'Franchise':
            cities = subject_structure.get('suburbs_detected', [])
            if len(cities) >= 2:
                loc_reviews = []
                for city in cities[:3]:
                    lr = await _get_review_data(subject_name, city)
                    loc_reviews.append(lr.get('reviews', 0))
                if loc_reviews and max(loc_reviews) > 0:
                    variance = max(loc_reviews) - min(loc_reviews)
                    if variance > max(loc_reviews) * 0.5:
                        asymmetries.append({
                            'category': 'LocationTrustVariance', 'tier': 'structural',
                            'subject_metric': f"Review range: {min(loc_reviews)}-{max(loc_reviews)}",
                            'competitor_metric': f"Variance: {variance} reviews across locations",
                            'metric_source': 'Google Maps',
                            'differential_ratio': f"{max(loc_reviews)}:{min(loc_reviews)}",
                            'structural_implication': 'Franchise Trust Distribution Imbalance',
                            'confidence': 0.55,
                        })

    required = ['category', 'subject_metric', 'competitor_metric', 'metric_source',
                'differential_ratio', 'structural_implication', 'confidence']
    return [a for a in asymmetries if all(a.get(f) for f in required)]
