"""API projections retain donor identity without extra database reads."""

from uuid import uuid4

from app.api.dependencies import Actor
from app.services.donations import donation_view


class ProjectionDatabase:
    async def read(self, table, token, query):
        if table == "donations":
            return [
                {
                    "id": str(uuid4()),
                    "name": "Blue winter coat",
                    "description": "Small tear at cuff.",
                    "category": "clothes",
                    "attributes": {"type": "coat"},
                    "quantity": "1",
                    "unit": "item",
                    "revision": 2,
                    "facts_revision": 1,
                }
            ]
        return []

    async def command(self, operation, actor, arguments):
        return [{"posting": None}]


async def test_owner_projection_keeps_donor_identity():
    actor = Actor(id=uuid4(), token="test-token")
    view = await donation_view(ProjectionDatabase(), actor, uuid4())
    assert view["facts"]["name"] == "Blue winter coat"
    assert view["facts"]["description"] == "Small tear at cuff."
    assert "name" not in view
    assert "description" not in view
