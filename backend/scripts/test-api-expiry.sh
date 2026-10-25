#!/usr/bin/env bash
# API source-date/read-time boundary cases; no OpenAI or storage calls.
set +x
set -euo pipefail
umask 077
: "${DONOR_TOKEN:?Provide a valid donor access token}"
[[ ${TEST_TARGET:-} == development ]] || { echo 'Set TEST_TARGET=development'; exit 2; }
BASE_URL=${BASE_URL:-http://127.0.0.1:8000/api/v1}
BASE_URL=${BASE_URL%/}
for command in curl jq python3; do command -v "$command" >/dev/null; done
[[ $DONOR_TOKEN != *$'\n'* && $DONOR_TOKEN != *$'\r'* && $DONOR_TOKEN != *'"'* && $DONOR_TOKEN != *'\'* ]] || exit 2
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
python3 - > "$WORK/cases.jsonl" <<'PY'
import json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
now=datetime.now(ZoneInfo('Europe/Paris')).date()
for days,bucket in [(-1,'expired'),(0,'today'),(1,'lt_7'),(6,'lt_7'),(7,'lt_30'),(29,'lt_30'),(30,'lt_90'),(89,'lt_90'),(90,'at_90'),(91,'gt_90')]:
    facts=dict(category='food',attributes={},quantity='1',unit='item',expiry=dict(expiry_date=(now+timedelta(days=days)).isoformat(),date_type='DDM',date_precision='day',readability='readable'))
    print(json.dumps(dict(name=f'days_{days}',facts=facts,bucket=bucket,days=days,expired=days<0)))
for name,category,attributes,expiry,bucket,reason in [
    ('missing','food',{}, {},'unknown','missing_date'),
    ('unreadable','food',{}, {'readability':'unreadable'},'unknown','unreadable_date'),
    ('not_applicable','clothes',{}, {},'not_applicable',None),
    ('partial_ddm','food',{}, {'date_type':'DDM','date_precision':'month','raw_label':'02/2024','readability':'readable'},'expired',None),
    ('partial_dlc','food',{}, {'date_type':'DLC','date_precision':'month','raw_label':'02/2024','readability':'readable'},'unknown','incomplete_strict_date'),
    ('pao_unopened','para',{'opening_state':'unopened'}, {'date_type':'PAO','pao_months':12},'not_applicable',None),
    ('pao_missing_opening','para',{'opening_state':'opened'}, {'date_type':'PAO','pao_months':12},'unknown','opening_date_missing'),
]:
    print(json.dumps(dict(name=name,facts=dict(category=category,attributes=attributes,quantity='1',unit='item',expiry=expiry),bucket=bucket,reason=reason)))
PY
while IFS= read -r case_json; do
  name=$(jq -r .name <<< "$case_json")
  jq -c '{facts:.facts}' <<< "$case_json" > "$WORK/body.json"
  key=$(python3 -c 'import uuid; print(uuid.uuid4())')
  status=$(printf 'header = "Authorization: Bearer %s"\n' "$DONOR_TOKEN" | curl --config - --silent --show-error --max-time 30 \
    --header 'Content-Type: application/json' --header "Idempotency-Key: $key" --data-binary "@$WORK/body.json" \
    --output "$WORK/response.json" --write-out '%{http_code}' "$BASE_URL/donations")
  [[ $status == 201 ]] || { echo "FAIL $name creation HTTP $status"; exit 1; }
  id=$(jq -er .data.id "$WORK/response.json")
  status=$(printf 'header = "Authorization: Bearer %s"\n' "$DONOR_TOKEN" | curl --config - --silent --show-error --max-time 30 \
    --output "$WORK/response.json" --write-out '%{http_code}' "$BASE_URL/donations/$id")
  [[ $status == 200 ]] || exit 1
  jq -e --argjson c "$case_json" '.data.computed.expiry as $v | $v.bucket==$c.bucket and (if $c|has("days") then $v.days_left==$c.days and $v.expired==$c.expired else $v.unknown_reason==$c.reason end)' "$WORK/response.json" >/dev/null || { echo "FAIL $name expiry projection"; exit 1; }
  echo "PASS $name"
done < "$WORK/cases.jsonl"
echo '17 API date cases passed. These draft items remain in the development project.'
