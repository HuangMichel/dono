"""Donor-authored identity is normalized independently of category attributes."""

import pytest
from pydantic import ValidationError

from app.api.models import Facts


def test_item_details_are_trimmed_and_blank_description_is_null():
    facts = Facts(name="  Blue winter coat  ", description="   ")
    assert facts.name == "Blue winter coat"
    assert facts.description is None
    assert Facts().name is None


@pytest.mark.parametrize("field,length", [("name", 121), ("description", 2001)])
def test_item_details_have_bounded_lengths(field, length):
    with pytest.raises(ValidationError):
        Facts.model_validate({field: "a" * length})
