"""Test-only Supabase HTTP simulator executing real PostgreSQL RLS and RPCs.

Auth and the HTTP gateway are simulated; no claim of a live Supabase deployment.
"""

import json
from enum import StrEnum
from uuid import UUID

import httpx
import psycopg
from fastapi.encoders import jsonable_encoder
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.enum import EnumInfo, register_enum
from psycopg.types.json import Jsonb
from test_analysis import payload


class DatabaseHTTP:
    def __init__(self, uri: str) -> None:
        self.uri = uri
        with psycopg.connect(uri) as connection:
            names = connection.execute(
                "select typname from pg_type where typnam"
                "espace='public'::regnamespace and typtyp"
                "e='e'"
            ).fetchall()
            self.enums = [EnumInfo.fetch(connection, name[0]) for name in names]

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.host == "data.geopf.fr":
            assert request.url.params["index"] == "address"
            return httpx.Response(
                200,
                json={
                    "features": [
                        {
                            "geometry": {"type": "Point", "coordinates": [2.35, 48.85]},
                            "properties": {"label": "Test site"},
                        }
                    ]
                },
            )
        if request.url.host == "api.openai.com":
            body = json.loads(request.content)
            if body["text"]["format"]["name"] == "need_draft":
                draft = {
                    "category": "clothes",
                    "attributes": payload()["extracted"]["attributes"],
                    "seasons": [],
                    "target_quantity": "10",
                    "unit": "item",
                }
                return httpx.Response(
                    200,
                    json={
                        "status": "completed",
                        "output": [
                            {
                                "type": "message",
                                "content": [
                                    {
                                        "type": "output_text",
                                        "text": json.dumps(
                                            {
                                                "draft": draft,
                                                "warnings": ["Confirm fields"],
                                            }
                                        ),
                                    }
                                ],
                            }
                        ],
                    },
                )
            return httpx.Response(
                200,
                json={
                    "status": "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {"type": "output_text", "text": json.dumps(payload())}
                            ],
                        }
                    ],
                },
            )
        with psycopg.connect(self.uri, row_factory=dict_row) as connection:
            for info in self.enums:
                register_enum(
                    info,
                    connection,
                    enum=StrEnum(info.name, {label: label for label in info.labels}),
                )
            if request.url.path == "/auth/v1/user":
                token = request.headers.get("authorization", "").removeprefix("Bearer ")
                try:
                    subject = UUID(token.removeprefix("test:"))
                except ValueError:
                    return httpx.Response(401, json={})
                if connection.execute(
                    "select id from auth.users where id=%s", (subject,)
                ).fetchone():
                    return httpx.Response(
                        200,
                        json={
                            "id": str(subject),
                            "user_metadata": {"role": "platform_admin"},
                        },
                    )
                return httpx.Response(401, json={})
            try:
                if request.url.path.startswith("/rest/v1/rpc/"):
                    assert request.headers["apikey"] == "secret-test-key"
                    connection.execute("set local role service_role")
                    function = request.url.path.split("/")[-1]
                    body = json.loads(request.content)
                    arguments = []
                    values = []
                    for key, value in body.items():
                        arguments.append(sql.SQL("{}=>%s").format(sql.Identifier(key)))
                        values.append(
                            Jsonb(value) if isinstance(value, dict | list) else value
                        )
                    query = sql.SQL("select public.{}({}) as value").format(
                        sql.Identifier(function), sql.SQL(",").join(arguments)
                    )
                    result = connection.execute(query, values).fetchone()["value"]
                    return httpx.Response(200, json=jsonable_encoder(result))
                token = request.headers["authorization"].removeprefix("Bearer test:")
                connection.execute("set local role authenticated")
                connection.execute(
                    "select set_config('request.jwt.claim.sub',%s,true)", (token,)
                )
                table = request.url.path.split("/")[-1]
                fields = request.url.params.get("select", "*")
                columns = (
                    sql.SQL("*")
                    if fields == "*"
                    else sql.SQL(",").join(
                        sql.Identifier(field) for field in fields.split(",")
                    )
                )
                query = sql.SQL("select {} from public.{}").format(
                    columns, sql.Identifier(table)
                )
                conditions = []
                values = []
                for key, value in request.url.params.multi_items():
                    if key in ("select", "order", "limit", "offset"):
                        continue
                    op, argument = value.split(".", 1)
                    assert op == "eq", op
                    conditions.append(sql.SQL("{}=%s").format(sql.Identifier(key)))
                    values.append(argument)
                if conditions:
                    query += sql.SQL(" where ") + sql.SQL(" and ").join(conditions)
                if "order" in request.url.params:
                    terms = []
                    for term in request.url.params["order"].split(","):
                        parts = term.split(".")
                        terms.append(
                            sql.Identifier(parts[0])
                            + sql.SQL(" desc" if "desc" in parts else " asc")
                        )
                    query += sql.SQL(" order by ") + sql.SQL(",").join(terms)
                if "limit" in request.url.params:
                    query += sql.SQL(" limit %s")
                    values.append(int(request.url.params["limit"]))
                if "offset" in request.url.params:
                    query += sql.SQL(" offset %s")
                    values.append(int(request.url.params["offset"]))
                rows = connection.execute(query, values).fetchall()
                return httpx.Response(200, json=jsonable_encoder(rows))
            except psycopg.Error as exc:
                connection.rollback()
                return httpx.Response(
                    400,
                    json={"message": exc.diag.message_primary, "code": exc.sqlstate},
                )
