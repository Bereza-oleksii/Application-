#!/bin/bash
# Chain: wait for the ru scrape -> spawns (ru) -> en scrape -> images (again, to pick up anything new)
cd /home/user/Application-
export NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1
while kill -0 3662 2>/dev/null; do sleep 20; done
echo "=== ru scrape finished $(date)" >> data/chain.log
node scraper/scrape.mjs --lang ru --stage spawns --concurrency 8 --out data/raw > data/scrape-ru-spawns.log 2>&1
echo "=== spawns finished $(date)" >> data/chain.log
node scraper/scrape.mjs --lang en --stage all --concurrency 8 --out data/raw > data/scrape-en.log 2>&1
echo "=== en scrape finished $(date)" >> data/chain.log
while pgrep -f download-images.mjs >/dev/null; do sleep 20; done
node scraper/download-images.mjs --concurrency 4 --raw data/raw --out data/images > data/images2.log 2>&1
echo "=== images finished $(date)" >> data/chain.log
