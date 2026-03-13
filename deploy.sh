#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Deploying Submission Evaluator to Railway ==="

# Check railway auth
if ! railway whoami 2>/dev/null; then
  echo "ERROR: Not logged in to Railway. Run: railway login"
  exit 1
fi

# Initialize project
echo "Initializing Railway project..."
railway init --name lucid-unnamed 2>/dev/null || echo "Project may already exist"

# Set environment variables
echo "Setting environment variables..."
railway variables set \
  PAYMENTS_RECEIVABLE_ADDRESS=0x93710f148a88d80B344BB1fEbB91DCBA9f80019F \
  FACILITATOR_URL=https://facilitator.daydreams.systems \
  NETWORK=eip155:8453

# Deploy
echo "Deploying..."
railway up --detach

# Wait for deploy
echo "Waiting for deployment..."
sleep 30

# Get domain
echo "Requesting domain..."
railway domain 2>/dev/null || echo "Domain may need to be set manually in Railway dashboard"

echo ""
echo "=== Deployment complete ==="
echo "Run 'railway domain' to get the public URL"
echo "Then update submission.md with the URL"
