#!/bin/bash

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

# https://vercel.com/guides/how-do-i-use-the-ignored-build-step-field-on-vercel
if [[ $VERCEL_GIT_COMMIT_REF == renovate/* ]]; then
  echo "🛑 - Build cancelled"
  exit 0
else
  echo "✅ - Build can proceed"
  exit 1
fi
