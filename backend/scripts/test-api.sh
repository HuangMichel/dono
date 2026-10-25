#!/usr/bin/env bash
# Real HTTP API tests. Only use against a dedicated development project.
set +x
set -euo pipefail
umask 077
BASE_URL=${BASE_URL:-http://127.0.0.1:8000/api/v1}
BASE_URL=${BASE_URL%/}
for bin in curl jq python3; do command -v "$bin" >/dev/null || { echo "Missing: $bin" >&2; exit 2; }; done
for name in DONOR_TOKEN OTHER_DONOR_TOKEN ADMIN_TOKEN STAFF_TOKEN OTHER_ADMIN_TOKEN PLATFORM_TOKEN PHOTO; do
  [[ -n ${!name:-} ]] || { echo "Required environment variable: $name" >&2; exit 2; }
done
[[ -f $PHOTO ]] || { echo 'PHOTO must point to an existing JPEG/PNG/WebP.' >&2; exit 2; }
[[ ${TEST_TARGET:-} == development ]] || { echo 'Set TEST_TARGET=development for a dedicated test project.' >&2; exit 2; }
# Never source backend/.env: shell syntax is not the dotenv format.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
LAST=$WORK/response.json
PASS=0
SKIP=0
uuid() { python3 -c 'import uuid; print(uuid.uuid4())'; }
fail() { echo "FAIL: $*" >&2; exit 1; }
assert_json() { jq -e "$1" "$LAST" >/dev/null || fail "Assertion: $1"; }
value() { jq -er "$1" "$LAST"; }
# Supply Authorization through stdin to curl, never through its process arguments.
# Response bodies and multipart data stay in a private temporary directory.
request() {
  local who=$1 method=$2 path=$3 expected=$4 body=${5:-} key=${6:-} status token=''
  [[ -z $who ]] || token=${!who}
  [[ $token != *$'\n'* && $token != *$'\r'* && $token != *'"'* && $token != *'\'* ]] || fail 'Invalid token characters'
  local args=(--silent --show-error --connect-timeout 10 --max-time 150 --request "$method" --output "$LAST" --write-out '%{http_code}')
  if [[ -n $body ]]; then
    printf '%s' "$body" > "$WORK/body.json"
    args+=(--header 'Content-Type: application/json' --data-binary "@$WORK/body.json")
  fi
  [[ -z $key ]] || args+=(--header "Idempotency-Key: $key")
  status=$(printf 'header = "Authorization: Bearer %s"\n' "$token" | curl --config - "${args[@]}" "$BASE_URL$path") || fail "Transport: $method $path"
  if [[ ,$expected, != *,$status,* ]]; then
    echo "FAIL $method $path: HTTP $status, expected $expected; code=$(jq -r '.error.code // "non-JSON response"' "$LAST" 2>/dev/null || true)" >&2
    exit 1
  fi
  PASS=$((PASS+1)); printf 'PASS %s %s (%s)\n' "$method" "$path" "$status"
}
get() { request "$1" GET "$2" "${3:-200}"; }
post() {
  local body='{}'
  if (( $# >= 4 )); then body=$4; fi
  request "$1" POST "$2" "$3" "$body" "${5:-$(uuid)}"
}
patch() { request "$1" PATCH "$2" "$3" "$4" "$(uuid)"; }
rev() { get "$1" "$2"; REV=$(value '.data.revision'); }
skip() { SKIP=$((SKIP+1)); echo "NOT RUN: $*"; }
upload() {
  local token=$DONOR_TOKEN status mime=${2:-image/png} photo=${3:-$PHOTO}
  status=$(printf 'header = "Authorization: Bearer %s"\n' "$token" | curl --config - --silent --show-error --max-time 60 \
    --output "$LAST" --write-out '%{http_code}' --header "Idempotency-Key: $(uuid)" \
    --form "file=@$photo;type=$mime" --form kind=item "$BASE_URL/donations/$ITEM/photos")
  [[ $status == "$1" ]] || fail "Upload HTTP $status, expected $1"
  PASS=$((PASS+1)); echo "PASS upload ($status)"
}
MIME=$(python3 - "$PHOTO" <<'PY'
import mimetypes,sys
print(mimetypes.guess_type(sys.argv[1])[0] or 'application/octet-stream')
PY
)
# Use the same deterministic human facts for each fresh item.
FACTS='{"category":"clothes","attributes":{"type":"coat"},"quantity":"1","unit":"item"}'
new_item() {
  post DONOR_TOKEN /donations 201 "$(jq -cn --argjson f "$FACTS" '{facts:$f}')"
  ITEM=$(value '.data.id')
  upload 201 "$MIME"
  PHOTO_ID=$(value '.data.id')
}
publish() {
  rev DONOR_TOKEN "/donations/$ITEM"
  post DONOR_TOKEN "/donations/$ITEM/publication" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r}')"
}
submit() {
  rev DONOR_TOKEN "/donations/$ITEM"
  post DONOR_TOKEN "/donations/$ITEM/offers" 201 "$(jq -cn --arg r "$REV" --arg a "$ASSOC" --arg n "$NEED" '{expected_donation_revision:$r,association_id:$a,need_id:$n}')"
  OFFER=$(value '.data.id')
}
# Identity and ordinary authorization.
get '' /account/profile 401
request DONOR_TOKEN GET /account/profile 200,403
for actor in DONOR_TOKEN OTHER_DONOR_TOKEN ADMIN_TOKEN STAFF_TOKEN OTHER_ADMIN_TOKEN PLATFORM_TOKEN; do
  post "$actor" /account/profile 201 '{}'
  get "$actor" /account/profile
  case $actor in
    DONOR_TOKEN) DONOR_ID=$(value '.data.id');;
    OTHER_DONOR_TOKEN) OTHER_ID=$(value '.data.id');;
    STAFF_TOKEN) STAFF_ID=$(value '.data.id');;
  esac
  get "$actor" /account/memberships
 done
[[ $DONOR_ID != "$OTHER_ID" ]] || fail 'D1 and D2 must be different accounts'
get DONOR_TOKEN /admin/associations 403
get PLATFORM_TOKEN /admin/associations
# Fresh associations isolate repeated runs from prior quota/slot/history.
for actor in ADMIN_TOKEN OTHER_ADMIN_TOKEN; do
  RNA=$(python3 -c 'import secrets; print("W"+str(secrets.randbelow(10**9)).zfill(9))')
  post "$actor" /associations 201 "$(jq -cn --arg r "$RNA" '{name:"Dono API test",rna:$r,timezone:"Europe/Paris"}')"
  tenant=$(value '.data.id'); revision=$(value '.data.revision')
  get "$actor" "/associations/$tenant/needs" 403
  post PLATFORM_TOKEN "/admin/associations/$tenant/approval" 200 "$(jq -cn --arg r "$revision" '{expected_revision:$r}')"
  if [[ $actor == ADMIN_TOKEN ]]; then ASSOC=$tenant; else OTHER_ASSOC=$tenant; fi
 done
post ADMIN_TOKEN "/associations/$ASSOC/members" 201 "$(jq -cn --arg p "$STAFF_ID" '{profile_id:$p,role:"assoc_staff"}')"
get OTHER_ADMIN_TOKEN "/associations/$ASSOC/members" 403
get ADMIN_TOKEN "/associations/$ASSOC/members"
get ADMIN_TOKEN "/associations/$ASSOC/membership-events"
# Site geocoding outside locks; broad hours for a short live receipt test.
rev ADMIN_TOKEN "/associations/$ASSOC"
HOURS=$(python3 -c 'import json; print(json.dumps([dict(weekday=i,start_local="00:00",end_local="23:59") for i in range(1,8)]))')
patch ADMIN_TOKEN "/associations/$ASSOC" 200 "$(jq -cn --arg r "$REV" --argjson h "$HOURS" '{expected_revision:$r,address:"8 boulevard du Port, Amiens",opening_hours:$h}')"
post ADMIN_TOKEN "/associations/$ASSOC/needs" 201 '{"category":"clothes","attributes":{},"seasons":[],"target_quantity":"20","unit":"item","storage_units_per_item":1,"active":true}'
NEED=$(value '.data.id')
request ADMIN_TOKEN PUT "/associations/$ASSOC/capacity/clothes" 200 '{"storage_unit":"item_slot","limit_storage_units":20}' "$(uuid)"
request STAFF_TOKEN PUT "/associations/$ASSOC/capacity/clothes" 403 '{"storage_unit":"item_slot","limit_storage_units":20}' "$(uuid)"
# Dates are computed in code. Fail near local midnight rather than silently invalidating a slot.
python3 - "$WORK/times.json" <<'PY'
import json,sys,os
from datetime import datetime,UTC,timedelta
from zoneinfo import ZoneInfo
now=datetime.now(UTC); start=now+timedelta(seconds=int(os.environ.get("TEST_SLOT_DELAY_SECONDS","180"))); end=start+timedelta(minutes=5)
z=ZoneInfo('Europe/Paris')
if start.astimezone(z).date()!=end.astimezone(z).date() or end.astimezone(z).strftime('%H:%M')>='23:59':
    sys.exit('Restart this live test after local midnight.')
with open(sys.argv[1],'w') as f: json.dump(dict(start=start.isoformat(),end=end.isoformat(),day=start.astimezone(z).date().isoformat()),f)
PY
DAY=$(jq -r .day "$WORK/times.json")
request ADMIN_TOKEN PUT "/associations/$ASSOC/intake-quotas/clothes/$DAY" 200 '{"unit":"item","limit_quantity":"20"}' "$(uuid)"
post ADMIN_TOKEN "/associations/$ASSOC/slots" 201 "$(jq -c '{starts_at:.start,ends_at:.end,max_bookings:20}' "$WORK/times.json")"
SLOT=$(value '.data.id')
# Main donor/photo flow, invalid upload and private content checks.
new_item
get OTHER_DONOR_TOKEN "/donations/$ITEM" 404
get OTHER_DONOR_TOKEN "/photos/$PHOTO_ID/content" 404
get DONOR_TOKEN "/donations/$ITEM/photos"
get DONOR_TOKEN "/photos/$PHOTO_ID/content"
printf 'invalid image' > "$WORK/invalid.png"
upload 415 image/png "$WORK/invalid.png"
# Real OpenAI is opt-in so this executable does not silently incur charges.
if [[ ${RUN_OPENAI:-0} == 1 ]]; then
  post DONOR_TOKEN "/donations/$ITEM/analyses" 201 "$(jq -cn --arg p "$PHOTO_ID" '{photo_ids:[$p]}')"
  ANALYSIS=$(jq -cS '.data.analysis | {id,category,extracted,indicators:(.indicators|sort_by(.key)),confidence,provider,model}' "$LAST")
else skip 'Real OpenAI calls: set RUN_OPENAI=1 (billable).'; fi
rev DONOR_TOKEN "/donations/$ITEM"
patch DONOR_TOKEN "/donations/$ITEM" 200 "$(jq -cn --arg r "$REV" --argjson f "$FACTS" '{expected_revision:$r,facts:$f}')"
patch DONOR_TOKEN "/donations/$ITEM" 409 "$(jq -cn --argjson f "$FACTS" '{expected_revision:"1",facts:$f}')"
get DONOR_TOKEN "/donations/$ITEM/analyses"
if [[ ${RUN_OPENAI:-0} == 1 ]]; then
  observed=$(jq -cS '.data[0] | {id,category,extracted,indicators:(.indicators|sort_by(.key)),confidence,provider,model}' "$LAST")
  [[ $observed == "$ANALYSIS" ]] || fail 'Original analysis changed after human edit'
fi
get DONOR_TOKEN "/donations/$ITEM/edits"
publish
post DONOR_TOKEN "/donations/$ITEM/matches" 200 '{"origin":{"latitude":48.85,"longitude":2.35}}'
assert_json ".data | any(.association.id == \"$ASSOC\")"
post DONOR_TOKEN "/donations/$ITEM/matches" 200 '{"address":"8 boulevard du Port, Amiens"}'
submit
get STAFF_TOKEN "/offers/$OFFER/evidence"
get OTHER_ADMIN_TOKEN "/offers/$OFFER" 404
post DONOR_TOKEN "/offers/$OFFER/decision" 403 '{"expected_revision":"1","decision":"refused"}'
# Staff review: a correction assertion is only legal when original strict evidence exists.
get STAFF_TOKEN "/offers/$OFFER/evidence"
STRICT=$(jq '[.. | objects | select(has("dates")) | .dates | select(.date_type=="DLC" or .date_type=="expiry" or .date_type=="PAO" or .pao_months!=null)] | length>0' "$LAST")
rev STAFF_TOKEN "/offers/$OFFER"
CHECKS=$(jq -cn --argjson strict "$STRICT" '{not_medicine:true,analysis_unavailable_ack:true} + (if $strict then {date_label_correction_confirmed:true} else {} end)')
post STAFF_TOKEN "/offers/$OFFER/decision" 200 "$(jq -cn --arg r "$REV" --argjson c "$CHECKS" '{expected_revision:$r,decision:"approved",intake_checks:$c,reason:"Physical test clothing confirmed; original label reviewed"}')"
get DONOR_TOKEN "/offers/$OFFER/slots"
assert_json ".data | any(.id == \"$SLOT\")"
rev DONOR_TOKEN "/offers/$OFFER"
BOOK_BODY=$(jq -cn --arg r "$REV" --arg s "$SLOT" '{expected_offer_revision:$r,slot_id:$s}')
BOOK_KEY=$(uuid)
post DONOR_TOKEN "/offers/$OFFER/bookings" 201 "$BOOK_BODY" "$BOOK_KEY"
BOOKING=$(value '.data.id')
post DONOR_TOKEN "/offers/$OFFER/bookings" 201 "$BOOK_BODY" "$BOOK_KEY"
assert_json ".data.id == \"$BOOKING\""
post DONOR_TOKEN "/offers/$OFFER/bookings" 409 "$(jq -cn --arg s "$SLOT" '{expected_offer_revision:"1",slot_id:$s}')" "$BOOK_KEY"
get DONOR_TOKEN "/bookings/$BOOKING/qr"
QR=$(value '.data.payload')
post STAFF_TOKEN "/associations/$ASSOC/qr/resolve" 200 "$(jq -cn --arg q "$QR" '{payload:$q}')"
post STAFF_TOKEN "/associations/$ASSOC/qr/resolve" 422 '{"payload":"forged"}'
# Wait only when necessary. Do not bypass the reception window or alter database time.
echo 'Waiting for the booked slot (up to 3 minutes); Ctrl-C leaves test history intact.'
python3 - "$WORK/times.json" <<'PY'
import json,sys,time
from datetime import datetime,UTC
start=datetime.fromisoformat(json.load(open(sys.argv[1]))['start'])
while (remaining:=(start-datetime.now(UTC)).total_seconds())>0:
    print(f'  reception opens in {remaining:.0f}s',flush=True); time.sleep(min(remaining,30))
PY
rev DONOR_TOKEN "/bookings/$BOOKING"
DATE_CHECKS=$(jq -cn --argjson strict "$STRICT" 'if $strict then {date_label_correction_confirmed:true} else {} end')
RECEIVE_BODY=$(jq -cn --arg r "$REV" --arg q "$QR" --argjson c "$DATE_CHECKS" '{expected_revision:$r,payload:$q,confirm_full_received:true,date_checks:$c,reason:"Physical test clothing received in full"}')
RECEIVE_KEY=$(uuid)
post STAFF_TOKEN "/bookings/$BOOKING/reception" 200 "$RECEIVE_BODY" "$RECEIVE_KEY"
RECEIPT=$(value '.data.receipt.id')
assert_json '.data.donation_state=="transferred" and .data.booking.status=="received"'
post STAFF_TOKEN "/bookings/$BOOKING/reception" 200 "$RECEIVE_BODY" "$RECEIVE_KEY"
assert_json ".data.receipt.id == \"$RECEIPT\""
for suffix in inventory 'expiry?view=distribute_first' expiry-counts images "arrivals?date=$DAY" offers needs capacity; do
  get STAFF_TOKEN "/associations/$ASSOC/$suffix"
done
DISTRIBUTION=$(jq -cn --argjson c "$DATE_CHECKS" '{confirm_full_distribution:true,date_checks:$c,reason:"Test full distribution"}')
DIST_KEY=$(uuid)
post STAFF_TOKEN "/inventory/$RECEIPT/distributions" 201 "$DISTRIBUTION" "$DIST_KEY"
MOVEMENT=$(value '.data.id')
post STAFF_TOKEN "/inventory/$RECEIPT/distributions" 201 "$DISTRIBUTION" "$DIST_KEY"
assert_json ".data.id == \"$MOVEMENT\""
post STAFF_TOKEN "/inventory/$RECEIPT/distributions" 409 "$DISTRIBUTION"
get STAFF_TOKEN "/associations/$ASSOC/inventory?inventory_state=distributed"
# Another future appointment allows cancellation after the first slot has started.
SLOT_BODY=$(python3 - "$WORK/times.json" <<'PYTIME'
import json,sys
from datetime import datetime,timedelta
v=json.load(open(sys.argv[1])); start=datetime.fromisoformat(v['end'])+timedelta(minutes=1)
print(json.dumps(dict(starts_at=start.isoformat(),ends_at=(start+timedelta(minutes=1)).isoformat(),max_bookings=2)))
PYTIME
)
post ADMIN_TOKEN "/associations/$ASSOC/slots" 201 "$SLOT_BODY"
CANCEL_SLOT=$(value '.data.id')
# Reuse after refusal; withdrawal/restoration; booking cancellation; role revocation.
new_item; publish; submit
rev STAFF_TOKEN "/offers/$OFFER"
post STAFF_TOKEN "/offers/$OFFER/decision" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r,decision:"refused",reason:"Test refusal"}')"
OLD_OFFER=$OFFER
submit
[[ $OFFER != "$OLD_OFFER" ]] || fail 'Re-offer reused an old offer ID'
rev DONOR_TOKEN "/donations/$ITEM"
post DONOR_TOKEN "/donations/$ITEM/withdrawal" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r,reason:"Test withdrawal"}')"
rev DONOR_TOKEN "/donations/$ITEM"
post DONOR_TOKEN "/donations/$ITEM/restoration" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r}')"
get DONOR_TOKEN "/donations/$ITEM/offers"
# Upload limits on the reusable unreceived item (no live offer).
upload 201 "$MIME"
upload 201 "$MIME"
upload 422 "$MIME"
python3 - "$WORK" <<'PYIMAGE'
import sys,zlib,struct
from pathlib import Path
root=Path(sys.argv[1]); (root/'too-large.png').write_bytes(b'X'*(5*1024*1024+1))
def chunk(kind,data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
w=20_000_001
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',w,1,1,0,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00'+b'\x00'*((w+7)//8)))+chunk(b'IEND',b'')
(root/'too-many-pixels.png').write_bytes(png)
PYIMAGE
upload 413 image/png "$WORK/too-large.png"
upload 413 image/png "$WORK/too-many-pixels.png"
new_item; publish; submit
rev STAFF_TOKEN "/offers/$OFFER"
post STAFF_TOKEN "/offers/$OFFER/decision" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r,decision:"approved",intake_checks:{not_medicine:true,analysis_unavailable_ack:true},reason:"Test manual clothing review"}')"
rev DONOR_TOKEN "/offers/$OFFER"
post DONOR_TOKEN "/offers/$OFFER/bookings" 201 "$(jq -cn --arg r "$REV" --arg s "$CANCEL_SLOT" '{expected_offer_revision:$r,slot_id:$s}')"
CANCEL_BOOKING=$(value '.data.id')
rev DONOR_TOKEN "/bookings/$CANCEL_BOOKING"
post DONOR_TOKEN "/bookings/$CANCEL_BOOKING/cancellation" 200 "$(jq -cn --arg r "$REV" '{expected_revision:$r,reason:"Test booking cancellation"}')"
assert_json '.data.booking.status=="cancelled" and .data.offer.status=="cancelled"'
# The single association administrator cannot revoke themself.
get ADMIN_TOKEN /account/profile
ADMIN_ID=$(value '.data.id')
get ADMIN_TOKEN "/associations/$ASSOC/members"
ADMIN_REV=$(jq -er --arg p "$ADMIN_ID" '.data[]|select(.profile_id==$p)|.revision' "$LAST")
patch ADMIN_TOKEN "/associations/$ASSOC/members/$ADMIN_ID" 409 "$(jq -cn --arg r "$ADMIN_REV" '{expected_revision:$r,active:false,reason:"Last admin protection test"}')"
get DONOR_TOKEN '/donations?limit=1'
CURSOR=$(jq -r '.page.next_cursor // empty' "$LAST")
if [[ -n $CURSOR ]]; then get DONOR_TOKEN "/donations?limit=1&cursor=$CURSOR"; fi
get ADMIN_TOKEN "/associations/$ASSOC/members"
MEMBER_REV=$(jq -er --arg p "$STAFF_ID" '.data[] | select(.profile_id==$p) | .revision' "$LAST")
patch ADMIN_TOKEN "/associations/$ASSOC/members/$STAFF_ID" 200 "$(jq -cn --arg r "$MEMBER_REV" '{expected_revision:$r,active:false,reason:"Test revocation"}')"
get STAFF_TOKEN "/associations/$ASSOC/inventory" 403
get ADMIN_TOKEN "/associations/$ASSOC/membership-events"
post ADMIN_TOKEN "/associations/$ASSOC/expiration-reconciliation" 200 '{}'
skip 'Long review/approval/no-show deadlines, race scheduling, midnight/FEFO date matrix: deterministic pytest suite; see curl guide for limits.'
skip 'Photo quality/medicine/food review: requires annotated 25–35 real images, not inferred from this clothing smoke test.'
echo "API run complete: $PASS successful HTTP assertions; $SKIP groups not executed. Test entities retained on dedicated project."
