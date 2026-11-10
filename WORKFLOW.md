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
  checkout:
    kind: linked_worktree
    source: .
    base_branch: main
  storage_maintenance:
    enabled: true
    interval_ms: 86400000
    warm_pool_slots: 1
    max_pool_slots: 4
    max_cache_gib: 10
  strategy:
    implementation: pooled_isolated
    planning: durable_issue_workspace
    epic:
      stacked: durable_epic_workspace
      independent: pooled_isolated
hooks:
  after_create: |
    set -euo pipefail
    # Symphony creates and owns the linked checkout before repository hooks run.
    git rev-parse --show-toplevel >/dev/null
  before_run: |
    set -euo pipefail

    base_branch="${SYMPHONY_STACK_BASE_BRANCH:-main}"
    git fetch origin "$base_branch"
    git checkout --detach "origin/$base_branch"
    git reset --hard "origin/$base_branch"
    git clean -fdx -e .symphony/ -e node_modules/ -e .next/ -e .turbo/ -e .gradle/ -e .kotlin/ -e .cxx/ -e .build/ -e build/ -e dist/ -e coverage/ -e DerivedData/ -e .swiftpm/ -e local.properties

    exclude_file="$(git rev-parse --git-path info/exclude)"
    mkdir -p "$(dirname "$exclude_file")"
    touch "$exclude_file"
    grep -qxF '.symphony/' "$exclude_file" || echo '.symphony/' >> "$exclude_file"

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
    echo "PR finalization complete; code review is not required for this repository."
  timeout_ms: 1800000
review:
  enabled: false
  auto_fix_review_comments: false
  number_of_auto_fix_iterations: 1
  shepherd_pull_requests: false
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
      handoff_command: bash -lc 'set -o pipefail; codex exec --json -c default_permissions=symphony-readonly-network -c permissions.symphony-readonly-network.extends=:read-only -c permissions.symphony-readonly-network.network.enabled=true -c permissions.symphony-readonly-network.filesystem.:slash_tmp=write -c permissions.symphony-readonly-network.filesystem.:tmpdir=write -C . --output-last-message "$SYMPHONY_LAST_MESSAGE_PATH" - < "{{ symphony.prompt_path }}"'
      output_log: .symphony/codex.jsonl
      turn_timeout_ms: 3600000
      usage_limit_exit_codes:
        - 5
        - 29
      usage_limit_backoff_ms: 3600000
      usage_limit_check_command: |
        codexbar --provider codex --format json --json-only --no-color
    claude:
      provider_group: claude
      provider_kind: claude
      command: bash -lc 'set -o pipefail; claude -p --model claude-opus-5-5 --permission-mode bypassPermissions < "{{ symphony.prompt_path }}" | tee .symphony/claude.log "$SYMPHONY_LAST_MESSAGE_PATH"'
      handoff_command: bash -lc 'set -o pipefail; claude -p --model claude-opus-5-5 --permission-mode dontAsk --tools Read,Glob,Grep --allowedTools Read,Glob,Grep --setting-sources "" --strict-mcp-config < "{{ symphony.prompt_path }}" | tee .symphony/claude.log "$SYMPHONY_LAST_MESSAGE_PATH"'
      output_log: .symphony/claude.log
      turn_timeout_ms: 3600000
      max_concurrent: 1
      usage_limit_exit_codes: [5, 29]
      usage_limit_backoff_ms: 3600000
      usage_limit_check_command: |
        codexbar --provider claude --format json --json-only --no-color
  routes:
    - provider: codex
      any_labels: [agent:codex]
    - provider: claude
      any_labels: [agent:claude]
    - provider: claude
      any_labels: [user-experience, ui, ux, design]
    - provider: codex
      default: true
merge:
  enabled: true
  require_independent_reviews: false
  require_checks: false
  method: squash
  dry_run: false
  required_reviews: 0
  policy_version: pdfkit.app-available-checks-v3
  required_evidence:
    standard:
      - validation
    elevated:
      - validation
  validation_command: |
    base="${SYMPHONY_VALIDATION_BASE_SHA:-origin/${SYMPHONY_VALIDATION_BASE_REF:-main}}"
    git diff --check "$base"...HEAD
    changed_paths="$(git diff --name-only "$base"...HEAD)"
    if grep -Eq '^(app/|components/|lib/|scripts/|public/|package\.json$|yarn\.lock$|[^/]+\.config\.|tsconfig\.json$|wrangler\.)' <<< "$changed_paths"; then
      node "$SYMPHONY_DEPENDENCY_HELPER" -- yarn install --frozen-lockfile --non-interactive --prefer-offline
      yarn lint
      yarn tsc --noEmit
      if grep -Eq '^(app/.*(page|layout|sitemap|robots)\.|scripts/|package\.json$|yarn\.lock$|[^/]+\.config\.|wrangler\.)' <<< "$changed_paths"; then
        yarn build
        yarn test:seo
      fi
    fi
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
4. Add a regression test when it protects changed behavior that existing checks would miss.
5. Use the smallest relevant check while developing when it helps prove the change. Symphony runs the path-based merge checks on the final PR, so leave those suites to Symphony unless you need one to reproduce or diagnose a problem. Preserve browser-only document processing.
6. If you are blocked by a product, architecture, security, data-loss, cost, or irreversible decision, do not guess. End your final response with the `SYMPHONY_PAUSE` block shown below.
7. Commit changes to branch `{{ issue.branch_name }}` (already checked out).
8. Push the branch to origin.
9. Open or update a pull request:
   - PR title should match the issue title.
   - PR body MUST contain `Fixes #{{ issue.number }}` so GitHub auto-closes the issue after the PR is merged.
   - Briefly state what changed and any checks or material risks. Add screenshots when they demonstrate a relevant visual change.
10. Post the PR link on the issue with a short outcome or blocker.
11. Do not add, remove, or replace lifecycle labels (`ready-for-agent`, `agent-running`, `needs-info`, `ready-for-human`, `blocked`, `interactive`). Symphony owns lifecycle labels.

Pause protocol:

When you need user input before continuing, end with this exact block. If implementation exists, first push it and open/update a draft PR with the blocker:

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
- Create PRs with a concise body including `Fixes #{{ issue.number }}`.
- If you cannot create or push a PR because of auth, permissions, CI, or another external blocker, comment on the issue with the blocking reason. Do not change lifecycle labels; Symphony will update or retry based on run state.

Do not close the issue unless the workflow explicitly says to.

Symphony runs the configured local validation and automatically merges the PR after it passes. Do not merge from the coding agent or run a competing autopilot merge job. Do not change existing automation schedules.

Delivery policy: code review is not required. Prioritize shipping these side projects: run focused development checks as needed, push the issue branch, and open a non-draft PR with Fixes #{{ issue.number }}. Symphony performs final local validation and merging. Missing native SDKs, Java/Xcode, devices/emulators, development builds, native dependencies or native-only Firebase/signing credentials are authorized test skips, never reasons to pause or withhold a PR. This policy supersedes older issue/grooming requirements for native evidence. Record relevant skips once in the PR. Run relevant checks for the paths and risks involved. Actual code/build/test failures with available prerequisites still block completion. Deployment and native release remain separate. Pause only for unresolved product/security/data-loss/cost decisions or credentials needed to implement or validate non-native behavior.

Publish the implementation branch and PR as soon as implementation and available checks finish. For a genuine human decision that still blocks delivery, publish a draft PR with completed work and the blocker before pausing; omit a PR only when no implementation exists. Do not wait an entire agent turn trying to repair the environment.

For dependency installation, use the shared helper exposed in the agent environment: `node "$SYMPHONY_DEPENDENCY_HELPER" -- npm ci` or `node "$SYMPHONY_DEPENDENCY_HELPER" -- yarn install --frozen-lockfile --non-interactive --prefer-offline`, matching this repository's package manager. It reuses a validated install and reruns when dependency inputs change. Install only if a check needs dependencies and use the same helper arguments as the merge gate so the install is reusable. Do not delete node_modules, clear package caches or force reinstall as routine setup. A cold pool slot needs its first install; inspect the helper cache-miss reason before retrying a slow install. Preserve warm dependencies and caches; never share a mutable node_modules directory between concurrent workspaces.
