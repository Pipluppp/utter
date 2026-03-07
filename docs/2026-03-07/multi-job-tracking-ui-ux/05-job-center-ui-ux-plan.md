# Plan 05: Job Center UI/UX (Beyond History)

## Goal

Deliver a dedicated, robust jobs UX available across the app, not just in History.

## UX components

1. Global job indicator:
- active count in top nav
- clear states (idle, active, attention-needed)

2. Job Dock (compact):
- keep current dock concept
- show multiple rows with grouping/sorting
- support quick cancel/dismiss/open

3. Job Center (new):
- dedicated route (suggest `/jobs`) or drawer panel
- sections: Active, Recently completed, Failed/Cancelled
- filters: type, status, time range
- bulk actions: dismiss completed, retry shortcut where supported

4. Context linking:
- each job links back to originating page/context
- each completed generation links to playable/downloadable artifact

## UX behavior requirements

1. Jobs persist through route changes and reloads.
2. Terminal jobs remain visible for configurable window.
3. Failure states are actionable (clear error, retry guidance).
4. Mobile UX remains usable (dock collapse, jobs page fallback).

## Accessibility requirements

1. Screen-reader friendly status updates.
2. Keyboard navigation for dock and job center actions.
3. Color/status indicators not color-only.

## Acceptance criteria

1. Users can monitor all running jobs from anywhere.
2. Users can perform cancellation/dismiss actions without navigating to History.
3. Job Center becomes primary operational view for async work.
