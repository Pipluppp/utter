# 2026-02-27 — UI/UX Polish Sprint

Visual and interaction improvements that directly affect what users see and feel.
All tasks are scoped to the frontend. No backend API changes, no infra work.

Full task spec: `ui-ux-tasks.md`

## Task Index

### State & Notification (Cross-Cutting)

1. **Persist last generation/design result**
   Spec: `ui-ux-tasks.md` task 1
   Files: `Generate.tsx:168`, `Design.tsx:242`, `TaskProvider.tsx:52`

2. **Task completion notification**
   Spec: `ui-ux-tasks.md` task 2
   Files: `TaskDock.tsx`, `TaskProvider.tsx`

3. **TaskDock click-through carries result**
   Spec: `ui-ux-tasks.md` task 3
   Files: `TaskDock.tsx:80-94`, `Generate.tsx:77-111`

4. **Task progress bar in TaskDock**
   Spec: `ui-ux-tasks.md` task 4
   Files: `TaskDock.tsx`

### New Pages

5. **404 page**
   Spec: `ui-ux-tasks.md` task 5
   Files: `router.tsx`

6. **Forgot password flow**
   Spec: `ui-ux-tasks.md` task 6
   Files: `Auth.tsx`

7. **Settings page**
   Spec: `ui-ux-tasks.md` task 7
   Files: `Profile.tsx`, `AccountLayout.tsx`

### New Components

8. **Toast notification system**
   Spec: `ui-ux-tasks.md` task 8
   Replaces: 11 `<Message>` instances across pages

9. **Modal / Dialog component**
   Spec: `ui-ux-tasks.md` task 9
   Replaces: `confirm()` in `Voices.tsx:152`, `History.tsx:170`

10. **Skeleton loader component**
    Spec: `ui-ux-tasks.md` task 10
    Replaces: 8 "Loading..." text instances

### Page-Level Fixes

11. **Generate: no-voices empty state**
12. **Clone: upload progress bar**
13. **Clone: mic permission guidance**
14. **Design: save retry button**
15. **Voices: styled delete confirmation**
16. **History: expandable error messages**
17. **Profile: avatar fallback**
18. **Profile: password change**

### Visual Polish

19. **Page transitions**
20. **List stagger animations**
21. **Landing scroll animations**
22. **Dark mode contrast fix**
23. **Mobile card action layout**

### SEO & Marketing

24. **Open Graph + Twitter meta tags**
25. **About page expansion**
26. **Footer expansion**
27. **Landing social proof section**
