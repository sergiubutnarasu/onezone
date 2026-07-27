#!/bin/sh
# Starts the Garage server and, on a fresh (never-initialized) cluster,
# performs the one-time bootstrap that Garage doesn't do on its own:
# assigning the cluster layout, importing the configured S3 access key,
# and creating/allowing the default bucket. All steps are idempotent so
# re-running this on an already-bootstrapped volume is a no-op.
set -e

BUCKET_NAME="${GARAGE_DEFAULT_BUCKET:-onezone}"
ACCESS_KEY="${GARAGE_DEFAULT_ACCESS_KEY:-GKonezone}"
SECRET_KEY="${GARAGE_DEFAULT_SECRET_KEY:?GARAGE_DEFAULT_SECRET_KEY is required}"

/garage server &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null' TERM INT

echo "[bootstrap] waiting for garage admin API..."
i=0
until /garage status >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[bootstrap] garage did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

if /garage status 2>/dev/null | grep -q "NO ROLE ASSIGNED"; then
  NODE_ID=$(/garage node id 2>/dev/null | head -1 | cut -d@ -f1)
  echo "[bootstrap] assigning cluster layout to node $NODE_ID"
  /garage layout assign -z dc1 -c 1G "$NODE_ID"
  /garage layout apply --version 1
else
  echo "[bootstrap] cluster layout already assigned"
fi

if ! /garage key info "$ACCESS_KEY" >/dev/null 2>&1; then
  echo "[bootstrap] importing access key $ACCESS_KEY"
  /garage key import "$ACCESS_KEY" "$SECRET_KEY" -n onezone --yes
else
  echo "[bootstrap] access key $ACCESS_KEY already exists"
fi

if ! /garage bucket info "$BUCKET_NAME" >/dev/null 2>&1; then
  echo "[bootstrap] creating bucket $BUCKET_NAME"
  /garage bucket create "$BUCKET_NAME"
else
  echo "[bootstrap] bucket $BUCKET_NAME already exists"
fi

/garage bucket allow --read --write --key "$ACCESS_KEY" "$BUCKET_NAME" >/dev/null 2>&1 || true

echo "[bootstrap] ready"
wait "$SERVER_PID"
