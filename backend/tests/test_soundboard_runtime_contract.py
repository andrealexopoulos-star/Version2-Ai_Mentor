from core.advisor_response_style import (
    build_flagship_response_contract_text,
    ensure_flagship_response_sections,
    parse_flagship_response_slots,
)


def test_contract_text_includes_required_sections():
    contract = build_flagship_response_contract_text().lower()
    assert "priority now" in contract
    assert "decision" in contract
    assert "pathways" in contract
    assert "kpi note" in contract
    assert "risk if delayed" in contract


def test_ensure_sections_fills_missing_slots():
    raw = "Decision: Focus on overdue invoices this week."
    fixed = ensure_flagship_response_sections(raw)
    lowered = fixed.lower()
    assert "priority now:" in lowered
    assert "decision:" in lowered
    assert "pathways:" in lowered
    assert "kpi note:" in lowered
    assert "risk if delayed:" in lowered


def test_parse_slots_extracts_complete_shape():
    reply = (
        "Priority now: tighten cash conversion this week.\n"
        "Decision: assign one owner to recover overdue invoices.\n"
        "Pathways: A) call top debtors today, B) set automatic reminder cadence.\n"
        "KPI note: track weekly cash conversion rate and invoice aging bucket.\n"
        "Risk if delayed: cash pressure increases and execution slows."
    )
    parsed = parse_flagship_response_slots(reply)
    assert parsed["is_complete"] is True
    assert parsed["priority_now"] == "tighten cash conversion this week."
    assert parsed["decision"] == "assign one owner to recover overdue invoices."
    assert parsed["kpi_note"] == "track weekly cash conversion rate and invoice aging bucket."


def test_golden_prompt_replay_contract_and_tone():
    # Golden replay set: verifies contract completeness and non-robotic phrasing standard.
    golden_replies = [
        (
            "Priority now: protect your top three pipeline deals before month-end.\n"
            "Decision: move two stalled proposals to executive follow-up within 48 hours.\n"
            "Pathways: A) owner-led call sequence, B) single-page offer revision and resend.\n"
            "KPI note: monitor proposal-to-close conversion this week.\n"
            "Risk if delayed: slippage pushes cash timing and weakens forecast confidence."
        ),
        (
            "Priority now: stabilise overdue receivables and protect short-term runway.\n"
            "Decision: launch a seven-day collections sprint with clear owner accountability.\n"
            "Pathways: A) immediate debtor outreach by value tier, B) payment-plan offers for aged invoices.\n"
            "KPI note: track overdue-invoice recovery rate daily until baseline is set.\n"
            "Risk if delayed: working-capital pressure compounds and operating flexibility drops."
        ),
    ]

    for reply in golden_replies:
        parsed = parse_flagship_response_slots(reply)
        assert parsed["is_complete"] is True
        # Tone guard: plain language should avoid theatrical/robotic terms.
        lowered = reply.lower()
        assert "as an ai" not in lowered
        assert "i cannot" not in lowered
