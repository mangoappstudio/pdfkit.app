---
tracker:
  kind: github
  owner: mangoappstudio
  repo: pdfkit.app
  token: $GITHUB_TOKEN
  active_states:
    - open
  terminal_states:
    - closed
  required_labels:
    - ready-for-agent
  ignored_labels:
    - blocked
    - interactive
    - needs-info
    - ready-for-human
    - wontfix
    - symphony-failed
  candidate_order: ready_for_agent_labeled_at
  epics:
    enabled: true
    relationship_source: native_subissues
    auto_label_children: false
    parent_mode: coordinator_only
    execution_mode: independent
    max_depth: 8
  priority_labels:
    "priority: urgent": 1
    "priority: high": 2
    "priority: medium": 3
    "priority: low": 4
  branch_prefix: symphony
  request_timeout_ms: 120000
polling:
  interval_ms: 300000
workspace:
  root: ~/.symphony/workspaces/pdfkit.app
  clean_on_terminal: true
  strategy:
    implementation: pooled_isolated
    planning: durable_issue_workspace
    epic:
      stacked: durable_epic_workspace
      independent: pooled_isolated
hooks:
  after_create: |
    set -euo pipefail
    git clone git@github.com:mangoappstudio/pdfkit.app.git .
    mkdir -p .git/info
    touch .git/info/exclude
    grep -qxF '.symphony/' .git/info/exclude || echo '.symphony/' >> .git/info/exclude
  before_run: |
    set -euo pipefail

    base_branch="${SYMPHONY_STACK_BASE_BRANCH:-main}"
    git fetch origin "$base_branch"
    git checkout -B "$base_branch" "origin/$base_branch"
    git reset --hard "origin/$base_branch"
    git clean -fdx -e .symphony/

    mkdir -p .git/info
    touch .git/info/exclude
    grep -qxF '.symphony/' .git/info/exclude || echo '.symphony/' >> .git/info/exclude

    if ! git config user.email >/dev/null; then git config user.email "symphony@localhost"; fi
    if ! git config user.name >/dev/null; then git config user.name "Symphony"; fi

    gh auth status -h github.com

    if git ls-remote --exit-code --heads origin "{{ issue.branch_name }}" >/dev/null 2>&1; then
      git fetch origin "{{ issue.branch_name }}"
      git checkout -B "{{ issue.branch_name }}" FETCH_HEAD
    else
      git checkout -B "{{ issue.branch_name }}"
    fi
  after_run: |
    set -euo pipefail
    last_message_path="${SYMPHONY_LAST_MESSAGE_PATH:-.symphony/last_message.md}"
    if [ -f "$last_message_path" ] && grep -qx 'SYMPHONY_PAUSE' "$last_message_path"; then
      echo "Skipping PR validation for a human pause."
      exit 0
    fi
    base_branch="${SYMPHONY_STACK_BASE_BRANCH:-main}"
    pr_ref="${SYMPHONY_REVIEW_PR_NUMBER:-{{ issue.branch_name }}}"
    pr_json="$(gh pr view "$pr_ref" --json url,body,number,baseRefName,headRefName)"
    pr_url="$(printf '%s\n' "$pr_json" | jq -r '.url')"
    if [ "${SYMPHONY_REVIEW_ENABLED:-1}" != "1" ]; then
      echo "Symphony post-run AI code review is disabled; PR validation completed without running the repository review hook."
      exit 0
    fi

    pr_number="$(printf '%s\n' "$pr_json" | jq -r '.number')"
    pr_base_branch="$(printf '%s\n' "$pr_json" | jq -r '.baseRefName // empty')"
    pr_head_branch="$(printf '%s\n' "$pr_json" | jq -r '.headRefName // empty')"
    review_base_branch="${pr_base_branch:-$base_branch}"
    review_fixed_point="origin/$review_base_branch"

    echo "Preparing AI code review for PR #$pr_number against $review_fixed_point."
    git fetch origin "$review_base_branch"
    if ! git rev-parse --verify "$review_fixed_point" >/dev/null; then
      echo "ERROR: unable to resolve review fixed point $review_fixed_point."
      exit 1
    fi

    if git diff --quiet "$review_fixed_point"...HEAD; then
      echo "No diff between $review_fixed_point and HEAD; skipping AI code review."
      exit 0
    fi

    if [ -z "${SYMPHONY_REVIEW_PROMPT_PATH:-}" ] || [ ! -f "$SYMPHONY_REVIEW_PROMPT_PATH" ]; then
      echo "ERROR: SYMPHONY_REVIEW_PROMPT_PATH was not provided or does not exist."
      exit 1
    fi

    artifact_dir="${SYMPHONY_RUN_ARTIFACT_DIR:-.symphony}"
    mkdir -p "$artifact_dir"
    review_output="$artifact_dir/code-review.md"
    review_log="$artifact_dir/code-review.jsonl"

    set +e
    codex exec --json -s read-only -C . --output-last-message "$review_output" - < "$SYMPHONY_REVIEW_PROMPT_PATH" > "$review_log"
    review_exit="$?"
    set -e
    cat "$review_log"
    review_session_id="$(jq -r 'select(.type == "thread.started") | .thread_id // empty' "$review_log" 2>/dev/null | tail -n 1)"
    if [ -z "$review_session_id" ]; then
      review_session_id="review-$pr_number-$(date +%s)-$$"
    fi
    printf 'SYMPHONY_REVIEWER: %s\n' "$(jq -cn --arg execution_id "$review_session_id" --arg lens "${SYMPHONY_REVIEW_LENS:-staff-engineer}" '{execution_id:$execution_id,provider:"codex",model:null,lens:$lens}')"

    if [ "$review_exit" -ne 0 ]; then
      echo "ERROR: AI code review failed with exit code $review_exit."
      exit "$review_exit"
    fi

    review_result="$(sed -n 's/^SYMPHONY_REVIEW_RESULT: //p' "$review_output" | tail -n 1)"
    if [ -z "$review_result" ] || ! printf '%s\n' "$review_result" | jq -e '(.verdict == "pass" or .verdict == "block" or .verdict == "retry") and (.summary | type == "string") and (.findings | type == "array")' >/dev/null; then
      echo "ERROR: AI code review did not include a valid SYMPHONY_REVIEW_RESULT payload."
      exit 1
    fi
    review_verdict="$(printf '%s\n' "$review_result" | jq -r '.verdict')"

    cat "$review_output"
    originating_issue_number="${SYMPHONY_REVIEW_ISSUE_NUMBER:-{{ issue.number }}}"
    review_marker="<!-- symphony-review:${SYMPHONY_REVIEW_EXECUTION_KEY:-${SYMPHONY_REVIEW_PR_HEAD_SHA:-unknown}:${SYMPHONY_REVIEW_PR_BASE_SHA:-unknown}:${SYMPHONY_REVIEW_LENS:-staff-engineer}} -->"
    review_comment="$artifact_dir/code-review-comment.md"
    {
      echo "$review_marker"
      cat "$review_output"
    } > "$review_comment"
    if ! gh pr view "$pr_number" --json comments --jq '.comments[].body' | grep -Fq -- "$review_marker"; then
      gh pr comment "$pr_number" --body-file "$review_comment"
    fi
    if [ -n "$originating_issue_number" ] && [ "$originating_issue_number" != "$pr_number" ]; then
      if ! gh issue view "$originating_issue_number" --json comments --jq '.comments[].body' | grep -Fq -- "$review_marker"; then
        gh issue comment "$originating_issue_number" --body-file "$review_comment"
      fi
    fi

    if [ "$review_verdict" = "retry" ]; then
      echo "ERROR: AI code review requested a retry."
      exit 1
    fi

    if [ "$review_verdict" = "block" ]; then
      echo "ERROR: AI code review returned a blocking result."
      exit 1
    fi

    echo "AI code review passed for $pr_url."
  timeout_ms: 1800000
review:
  enabled: true
  auto_fix_review_comments: true
  number_of_auto_fix_iterations: 1
  shepherd_pull_requests: true
  max_feedback_rounds: 3
  non_blocking_feedback_priorities:
    - p2
    - p3
  lenses:
    - staff-engineer
agent:
  max_concurrent_agents: 1
  max_retry_backoff_ms: 300000
  max_attempts: 3
  max_concurrent_agents_by_state:
    open: 1
agents:
  default: codex
  providers:
    codex:
      provider_group: codex
      provider_kind: codex
      command: bash -lc 'set -o pipefail; codex exec --json --dangerously-bypass-approvals-and-sandbox -C . --output-last-message "$SYMPHONY_LAST_MESSAGE_PATH" - < "{{ symphony.prompt_path }}"'
      resume_command: bash -lc 'set -o pipefail; codex exec resume --json --dangerously-bypass-approvals-and-sandbox --output-last-message "$SYMPHONY_LAST_MESSAGE_PATH" "{{ symphony.agent_thread_id }}" - < "{{ symphony.prompt_path }}"'
      handoff_command: bash -lc 'set -o pipefail; codex exec --json -s read-only -C . --output-last-message "$SYMPHONY_LAST_MESSAGE_PATH" - < "{{ symphony.prompt_path }}"'
      output_log: .symphony/codex.jsonl
      turn_timeout_ms: 3600000
      usage_limit_exit_codes:
        - 5
        - 29
      usage_limit_backoff_ms: 3600000
      usage_limit_check_command: |
        codexbar --provider codex --format json --json-only --no-color
  routes:
    - provider: codex
      default: true
merge:
  enabled: false
  require_independent_reviews: true
  require_checks: false
  method: squash
---

You are working on a GitHub issue for PDFKit.app.

Issue:
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- URL: {{ issue.url }}
- Labels: {{ issue.labels | join: ", " }}

Description:

{{ issue.description }}

Instructions:

1. Understand the issue and inspect the repository.
2. Read `AGENTS.md`, `README.md`, and relevant docs under `docs/` before editing.
3. Make the smallest safe change that solves the issue.
4. Add or update tests when behavior changes.
5. Run the strongest local checks that are practical for the touched area. Preserve browser-only document processing. Use yarn install --frozen-lockfile, yarn lint, yarn test:seo, and yarn build as appropriate. Read AGENTS.md, including installed Next.js docs requirements.
6. If you are blocked by a product, architecture, security, data-loss, cost, or irreversible decision, do not guess. End your final response with the `SYMPHONY_PAUSE` block shown below.
7. Commit changes to branch `{{ issue.branch_name }}` (already checked out).
8. Push the branch to origin.
9. Open or update a pull request:
   - PR title should match the issue title.
   - PR body MUST contain `Fixes #{{ issue.number }}` so GitHub auto-closes the issue after the PR is merged.
   - PR body should include:
     - What changed
     - Why this approach was chosen
     - User-visible behavior changes
     - Implementation notes and important tradeoffs
     - Tests/checks run, with exact commands
     - Screenshots or recordings for UI changes when practical
     - Risks, limitations, or follow-ups
10. Comment on the GitHub issue with:
   - Summary of changes
   - Tests/checks run
   - PR link
   - Any follow-up needed
11. Do not add, remove, or replace lifecycle labels (`ready-for-agent`, `agent-running`, `needs-info`, `ready-for-human`, `blocked`, `interactive`). Symphony owns lifecycle labels.

Pause protocol:

When you need user input before continuing, end with this exact block and do not open a PR:

```text
SYMPHONY_PAUSE
reason: <short reason>
question: <specific question for the user>
options:
- <option 1>
- <option 2>
END_SYMPHONY_PAUSE
```

Expected tooling:

- Use the `gh` CLI for issue comments and PR creation.
- Create PRs with a comprehensive body including `Fixes #{{ issue.number }}`.
- If you cannot create or push a PR because of auth, permissions, CI, or another external blocker, comment on the issue with the blocking reason. Do not change lifecycle labels; Symphony will update or retry based on run state.

Do not close the issue unless the workflow explicitly says to.

Do not merge or deploy automatically. Leave the reviewed PR for delivery under the repository's existing policy. Never run overlapping existing autopilot work or change its schedules.
