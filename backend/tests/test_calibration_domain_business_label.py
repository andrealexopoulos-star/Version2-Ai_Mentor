import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from domain_labels import domain_business_label


def test_domain_business_label_strips_www():
    assert domain_business_label("www.canva.com") == "Canva"


def test_domain_business_label_strips_common_subdomain():
    assert domain_business_label("app.smsglobal.com") == "Smsglobal"


def test_domain_business_label_falls_back_for_empty():
    assert domain_business_label("") == "Business"
