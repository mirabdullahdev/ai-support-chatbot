from app import orders


def test_lookup_requires_matching_number_and_email() -> None:
    order = orders.lookup_order("NT-10427", "mia.johnson@example.com")
    assert order is not None
    assert order["status"] == "shipped"
    assert order["tracking_number"] == "781298765432"


def test_wrong_email_is_rejected() -> None:
    assert orders.lookup_order("NT-10427", "someone.else@example.com") is None


def test_unknown_order_is_rejected() -> None:
    assert orders.lookup_order("NT-99999", "mia.johnson@example.com") is None


def test_missing_details_are_rejected() -> None:
    assert orders.lookup_order(None, "mia.johnson@example.com") is None
    assert orders.lookup_order("NT-10427", None) is None


def test_email_is_case_insensitive_and_number_is_normalised() -> None:
    assert orders.lookup_order("nt 10427", " MIA.Johnson@Example.com ") is not None
    assert orders.lookup_order("#10427", "mia.johnson@example.com") is not None


def test_extraction_from_free_text() -> None:
    text = "sure, it's order nt-10427 and my email is Mia.Johnson@example.com thanks"
    assert orders.extract_order_number(text) == "NT-10427"
    assert orders.extract_email(text) == "mia.johnson@example.com"
    assert orders.extract_order_number("no digits here") is None
