#!/bin/bash
echo "=== ANGRYDROID AI LAB — Backend Setup ==="
cd "$(dirname "$0")"
npm install
mkdir -p routes utils ws public
echo "✅ Setup complete. Run with: npm run dev"

