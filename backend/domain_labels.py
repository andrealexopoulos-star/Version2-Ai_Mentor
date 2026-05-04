import re


def domain_business_label(domain: str) -> str:
    """
    Build a human-readable business hint from a domain.
    Avoid generic host prefixes like `www` so UI never renders
    business names such as "Www" after URL scans.
    """
    host = (domain or "").strip().lower()
    if not host:
        return "Business"
    labels = [p for p in host.split(".") if p]
    if not labels:
        return "Business"
    ignored = {"www", "app", "portal", "login", "api", "m", "web"}
    while len(labels) > 1 and labels[0] in ignored:
        labels = labels[1:]
    primary = labels[0] if labels else ""
    if primary in ignored:
        return "Business"
    primary = re.sub(r"[^a-z0-9 -]+", " ", primary).replace("-", " ").strip()
    return primary.title() if primary else "Business"
