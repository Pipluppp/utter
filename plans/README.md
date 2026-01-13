# Plans Directory

> AI-assisted feature development workflow

---

## Workflow

```
1. Create plan     →  plans/{feature}/plan.md
2. Review plan     →  Iterate until approved
3. Execute plan    →  AI implements, checking off tasks
4. Document done   →  Update plan.md status
```

---

## Directory Structure

```
plans/
├── README.md                    # This file
├── 001-clone-voice/             # Feature: Voice cloning page
│   ├── plan.md                  # Implementation plan
│   ├── notes.md                 # Research, decisions, gotchas
│   └── changelog.md             # What changed during implementation
├── 002-generate-speech/         # Feature: Speech generation page
│   ├── plan.md
│   └── ...
└── 003-modal-deployment/        # Feature: GPU deployment
    ├── plan.md
    └── ...
```

---

## Naming Convention

```
{number}-{feature-name}/
```

- **Number**: 3-digit sequence (001, 002, ...)
- **Feature name**: Lowercase, hyphenated

---

## Plan Template

Each `plan.md` should follow this structure:

```markdown
# {Feature Name}

> One-line description

## Status

| Phase | Status |
|-------|--------|
| Planning | ✅ Complete |
| Implementation | 🔄 In Progress |
| Testing | ⬜ Not Started |

## Goal

What this feature accomplishes.

## Scope

### In Scope
- [ ] Task 1
- [ ] Task 2

### Out of Scope
- Thing we're explicitly not doing

## Technical Approach

How we'll implement it.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `path/to/file.py` | Create | Description |

## Checklist

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Notes

Decisions, gotchas, open questions.
```

---

## Workflow Commands

When starting a new feature:

```
"Create a plan for {feature} in plans/{number}-{name}/plan.md"
```

When implementing:

```
"Execute plans/{number}-{name}/plan.md"
```

When reviewing progress:

```
"Show status of plans/{number}-{name}/plan.md"
```

---

## Status Icons

| Icon | Meaning |
|------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Complete |
| ❌ | Blocked / Cancelled |

---

## Current Plans

| # | Feature | Status |
|---|---------|--------|
| 001 | Clone Voice Page | ⬜ Not Started |
| 002 | Generate Speech Page | ⬜ Not Started |
| 003 | Modal Deployment | ⬜ Not Started |
