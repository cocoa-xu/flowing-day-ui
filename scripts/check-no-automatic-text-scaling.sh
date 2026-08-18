#!/bin/sh
# A control that quietly rescales its own text renders at one size in a roomy panel and another in
# a tight one, and no caller can turn it off from outside. It reached three controls by being
# copied, and cost a long afternoon to find, because every measurement says the two panels are
# identical and only the pixels disagree.
#
# A label that does not fit should be given room, or be allowed to truncate where a reader can see
# it happening. It should not silently shrink.
set -eu

cd "$(dirname "$0")/.."

if matches=$(grep -rn "minimumScaleFactor" Sources --include="*.swift"); then
  echo "error: text in this library renders at its design size, never rescaled to fit." >&2
  echo "$matches" >&2
  exit 1
fi

echo "No automatic text scaling in Sources"
