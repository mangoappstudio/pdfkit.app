# Issue bodies and native relationships

Scale the body to the work; omit empty sections. Preserve the repository's established issue template when one exists.

## Implementation task

```markdown
## Problem and desired behavior
[Concrete trigger, current outcome, intended outcome; link the source or evidence.]

## Scope
[Relevant code areas, bounded change and non-goals.]

## Acceptance criteria
- [Observable behavior that establishes completion.]
- [Relevant failure/error or degraded behavior.]

## Observable verification
- Run/flow: [Actual repo command or browser/device/manual procedure.]
- Expected result: [What should visibly happen.]
- Evidence: [Test output, screenshot, device trace, API response, etc.]
- Merge independence: [Independent, or blocked by named issue/native dependency.]

## Dependencies and decisions
[Issue links, native dependency direction, and unresolved decisions if any.]
```

For a bug, add reproduction conditions, expected/actual behavior, and measured evidence. Avoid including tokens, private customer records, or raw sensitive logs. For a planning-only task, use `planning`/`task:spec`; ask for problem analysis, relevant architecture, alternatives/tradeoffs, proposed approach, verification plan, risks and implementation slices. Do not require code edits or a PR for planning completion.

## Native GitHub epics

See the [GitHub sub-issues REST reference](https://docs.github.com/en/rest/issues/sub-issues) for the native relationship API. Prefer supported connector relationship operations. If unavailable, `gh api` supports native sub-issue endpoints. Use verified owner/repo and numbers; pass structured JSON or safely quoted arguments, not issue-body text interpolated into shell commands.

1. Fetch a child's database `id` from `GET /repos/{owner}/{repo}/issues/{child_number}`. This is not its issue number or GraphQL node ID.
2. Inspect `GET /repos/{owner}/{repo}/issues/{child_number}/parent` when reusing an existing issue. Do not silently reparent it.
3. Attach with `POST /repos/{owner}/{repo}/issues/{parent_number}/sub_issues`, JSON `{ "sub_issue_id": <numeric_database_id> }`.
4. Read back `GET /repos/{owner}/{repo}/issues/{parent_number}/sub_issues` and confirm each expected child. Treat partial API failures as partial completion.

Use existing `epic`, `epic:independent`, or `epic:stacked` labels according to the workflow and the actual dependency model. Stacked work requires an intentional sequence; independent children should each be independently verifiable. Put cross-repo work into its actual destination; Symphony's coordinator may skip cross-repo children, so do not claim such relationships automatically queue them.

A ready epic parent can cause automatic child queuing when `auto_label_children` is true. Keep readiness off the parent and children when the user requested drafts or issue creation without execution. Ensure necessary decisions and enforced dependencies are in place before applying readiness.
