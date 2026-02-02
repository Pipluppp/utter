# Utter React 19 + Tailwind V4 Refactor Plan

> **Date**: 2026-02-02  
> **Scope**: Complete frontend rewrite from Jinja2/Vanilla JS to React 19 + Tailwind V4  
> **Goal**: Full feature parity with improved DX, maintainability, and mobile experience

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Component Hierarchy](#6-component-hierarchy)
7. [Page-by-Page Migration Plan](#7-page-by-page-migration-plan)
8. [Shared Components Library](#8-shared-components-library)
9. [State Management](#9-state-management)
10. [API Integration Layer](#10-api-integration-layer)
11. [Styling Strategy](#11-styling-strategy)
12. [Mobile-First Responsive Design](#12-mobile-first-responsive-design)
13. [Task Tracking System Migration](#13-task-tracking-system-migration)
14. [Testing Strategy](#14-testing-strategy)
15. [Migration Phases](#15-migration-phases)
16. [Risk Assessment](#16-risk-assessment)

---

## 1. Executive Summary

### Why Refactor?

| Current Pain Point | React 19 + Tailwind V4 Solution |
|-------------------|--------------------------------|
| Jinja2 templates with inline JS | Component-based architecture with clear separation |
| Global state via localStorage hacks | React Context + hooks for state management |
| Duplicated code across pages | Reusable component library |
| Manual DOM manipulation | Declarative UI updates |
| CSS in single monolithic file | Tailwind utility classes + component-scoped styles |
| No type safety | TypeScript integration |
| Hard to test | Component isolation enables unit testing |

### What We're Keeping

- **Backend**: FastAPI remains unchanged (API-first approach)
- **Features**: 100% feature parity required
- **Design Language**: IBM Plex Mono, monochrome aesthetic
- **Task System**: Full retention of async task tracking with polling

### What's Changing

- **Rendering**: Server-side Jinja2 → Client-side React SPA
- **Routing**: Full page reloads → React Router client-side navigation
- **Styling**: Custom CSS → Tailwind V4 utility classes
- **State**: localStorage + vanilla JS → React Context + TanStack Query
- **Build**: None → Vite

---

## 2. Current Architecture Analysis

### Existing Pages Inventory

| Page | Route | Template | Key Features |
|------|-------|----------|--------------|
| Landing | `/` | `index.html` | Hero, feature cards, CTA |
| Clone | `/clone` | `clone.html` | Dropzone, form, progress tracker |
| Design | `/design` | `design.html` | Voice description, preview, save |
| Generate | `/generate` | `generate.html` | Voice select, text input, audio player |
| Voices | `/voices` | `voices.html` | Voice grid, preview, delete |
| History | `/history` | `history.html` | Generation history, playback, delete |
| About | `/about` | `about.html` | Feature docs, language list |

### Existing API Endpoints

```
POST   /api/clone                    → Clone voice from audio
GET    /api/voices                   → List all voices
DELETE /api/voices/{id}              → Delete voice
GET    /api/voices/{id}/preview      → Get voice preview audio

POST   /api/generate                 → Start generation task (returns task_id)
GET    /api/tasks/{id}               → Poll task status
DELETE /api/tasks/{id}               → Cancel task

POST   /api/voices/design/preview    → Start design preview task
POST   /api/voices/design            → Save designed voice

GET    /api/generations              → List generation history
DELETE /api/generations/{id}         → Delete generation

GET    /api/languages                → Get supported languages
```

### Existing JavaScript Modules

| File | Purpose | React Equivalent |
|------|---------|------------------|
| `app.js` | Page initialization, form handlers | Page components + hooks |
| `task-manager.js` | Global task state, polling, modal | TaskContext + useTask hook |
| `waveform-manager.js` | WaveSurfer integration | useWaveform hook |

### Existing CSS Structure

| Section | Lines | Tailwind Migration |
|---------|-------|-------------------|
| CSS Variables | 1-20 | `tailwind.config.js` theme |
| Base/Reset | 21-50 | Tailwind preflight |
| Typography | 51-100 | Text utilities |
| Layout | 101-200 | Flex/Grid utilities |
| Components | 201-700 | Component classes |
| Task Modal | 701-850 | TaskModal component |
| Landing Page | 851-1000 | Landing component |
| Utilities | 1001-1180 | Utility classes |

---

## 3. Target Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React 19 SPA                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Router    │  │   Context   │  │ TanStack    │  │  Components │    │
│  │  (v7)       │  │  Providers  │  │   Query     │  │   Library   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│         │                │                │                │            │
│         ▼                ▼                ▼                ▼            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Page Components                           │   │
│  │  Landing │ Clone │ Design │ Generate │ Voices │ History │ About │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API Client (fetch)                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend (unchanged)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Component Event Handler
                    │
                    ▼
            React Hook (useTask, useVoices, etc.)
                    │
                    ▼
            TanStack Query Mutation/Query
                    │
                    ▼
            API Client (fetch with error handling)
                    │
                    ▼
            FastAPI Backend
                    │
                    ▼
            Response → Query Cache Update
                    │
                    ▼
            React Re-render → UI Update
```

---

## 4. Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "wavesurfer.js": "^7.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

### Why These Choices?

| Package | Rationale |
|---------|-----------|
| **React 19** | Server Components ready, improved hooks, Actions API |
| **React Router 7** | Data loading, form actions, nested routes |
| **TanStack Query** | Server state management, caching, polling built-in |
| **Tailwind V4** | CSS-first config, faster builds, better DX |
| **Vite 6** | Fast HMR, native ESM, excellent React plugin |
| **TypeScript** | Type safety, better IDE support, self-documenting |
| **clsx + tailwind-merge** | Conditional classes, deduplication |

---

## 5. Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── public/
│   └── favicon.ico
│
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component with providers
│   ├── index.css                # Tailwind imports + custom CSS
│   │
│   ├── api/                     # API client layer
│   │   ├── client.ts            # Base fetch wrapper
│   │   ├── voices.ts            # Voice API functions
│   │   ├── generations.ts       # Generation API functions
│   │   ├── tasks.ts             # Task polling API
│   │   └── types.ts             # API response types
│   │
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # Primitive components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Label.tsx
│   │   │   ├── Message.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/              # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Container.tsx
│   │   │   ├── PageTitle.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── audio/               # Audio-related components
│   │   │   ├── AudioPlayer.tsx
│   │   │   ├── Waveform.tsx
│   │   │   ├── Dropzone.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── task/                # Task tracking components
│   │   │   ├── TaskModal.tsx
│   │   │   ├── ProgressSection.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── cards/               # Card components
│   │       ├── VoiceCard.tsx
│   │       ├── HistoryCard.tsx
│   │       ├── FeatureCard.tsx
│   │       └── index.ts
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useTask.ts           # Task polling + state
│   │   ├── useWaveform.ts       # WaveSurfer integration
│   │   ├── useVoices.ts         # Voice queries
│   │   ├── useGenerations.ts    # Generation queries
│   │   ├── useElapsedTime.ts    # Timer hook
│   │   └── useLocalStorage.ts   # localStorage sync
│   │
│   ├── context/                 # React Context providers
│   │   ├── TaskContext.tsx      # Global task state
│   │   └── AudioContext.tsx     # Global audio player state
│   │
│   ├── pages/                   # Route page components
│   │   ├── Landing.tsx
│   │   ├── Clone.tsx
│   │   ├── Design.tsx
│   │   ├── Generate.tsx
│   │   ├── Voices.tsx
│   │   ├── History.tsx
│   │   ├── About.tsx
│   │   └── NotFound.tsx
│   │
│   ├── lib/                     # Utility functions
│   │   ├── cn.ts                # clsx + tailwind-merge
│   │   ├── formatTime.ts        # Time formatting
│   │   ├── validateAudio.ts     # Audio validation
│   │   └── constants.ts         # App constants
│   │
│   └── types/                   # TypeScript types
│       ├── voice.ts
│       ├── generation.ts
│       ├── task.ts
│       └── api.ts
```

---

## 6. Component Hierarchy

### App Root Structure

```tsx
<React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <TaskProvider>
      <AudioProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AudioProvider>
    </TaskProvider>
  </QueryClientProvider>
</React.StrictMode>
```

### App Component

```tsx
function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/clone" element={<Clone />} />
          <Route path="/design" element={<Design />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/voices" element={<Voices />} />
          <Route path="/history" element={<History />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <TaskModal />
    </>
  );
}
```

### Component Tree by Page

#### Landing Page
```
Landing
├── Hero
│   ├── HeroTitle
│   ├── HeroSubtitle
│   └── Button (CTA)
└── FeatureGrid
    └── FeatureCard (×3)
        ├── FeatureIcon
        ├── FeatureTitle
        ├── FeatureDesc
        └── FeatureLink
```

#### Clone Page
```
Clone
├── PageTitle
├── PageGuide (collapsible)
├── CloneForm
│   ├── Message (error/success)
│   ├── TryExampleButton
│   ├── Dropzone
│   │   ├── DropzoneIcon
│   │   ├── DropzoneText
│   │   └── FileInfo
│   ├── FormGroup
│   │   ├── Label
│   │   └── Input (voice name)
│   ├── FormGroup
│   │   ├── Label
│   │   ├── Textarea (transcript)
│   │   └── CharCounter
│   ├── FormGroup
│   │   ├── Label
│   │   └── Select (language)
│   └── Button (submit)
└── ProgressSection (conditional)
    ├── Spinner
    ├── ProgressTitle
    ├── ElapsedTime
    └── ProgressHint
```

#### Design Page
```
Design
├── PageTitle
├── Subtitle
├── PageGuide (collapsible)
├── DesignForm
│   ├── Message (error/success)
│   ├── FormGroup (voice name)
│   ├── FormGroup (description + counter)
│   ├── FormGroup (preview text + counter)
│   ├── FormGroup (language select)
│   ├── PreviewSection (conditional)
│   │   ├── Divider
│   │   ├── Label
│   │   └── AudioPlayer
│   └── ButtonGroup
│       ├── Button (Generate Preview)
│       └── Button (Save Voice)
├── ProgressSection (conditional)
└── ExamplesSection
    └── ExampleCard (×6)
```

#### Generate Page
```
Generate
├── PageTitle
├── PageGuide (collapsible)
├── GenerateForm
│   ├── Message (error/info)
│   ├── FormGroup (voice select)
│   ├── FormGroup (language select)
│   ├── FormGroup (text + counter)
│   ├── TipsMessage
│   └── Button (submit)
├── ProgressSection (conditional)
└── ResultSection (conditional)
    ├── Divider
    └── AudioPlayer
        ├── PlayButton
        ├── Waveform
        ├── TimeDisplay
        └── DownloadButton
```

#### Voices Page
```
Voices
├── PageTitle
├── VoicesGrid | VoicesEmpty
│   └── VoiceCard (×n)
│       ├── VoiceCardHeader
│       │   ├── VoiceName
│       │   └── VoiceDate
│       └── VoiceCardActions
│           ├── Button (Preview)
│           └── Button (Delete)
└── LoadingPlaceholder (conditional)
```

#### History Page
```
History
├── PageTitle
├── HistoryGrid | HistoryEmpty
│   └── HistoryCard (×n)
│       ├── HistoryCardHeader
│       │   ├── VoiceName
│       │   └── Date
│       ├── HistoryCardText
│       ├── HistoryCardMeta
│       ├── AudioPlayer (mini)
│       └── HistoryCardActions
│           ├── Button (Play)
│           └── Button (Delete)
└── LoadingPlaceholder (conditional)
```

#### About Page
```
About
├── PageTitle
└── AboutContent
    └── AboutSection (×4)
        ├── SectionTitle
        ├── SectionParagraph
        ├── AboutTable (features)
        └── AboutList (privacy)
```

---

## 7. Page-by-Page Migration Plan

### 7.1 Landing Page (`/`)

#### Current Implementation
- Hero section with title and tagline
- 3 feature cards with icons
- Links to Clone, Design, Generate

#### React Component

```tsx
// src/pages/Landing.tsx
import { Link } from 'react-router';
import { FeatureCard } from '@/components/cards';
import { CloneIcon, DesignIcon, GenerateIcon } from '@/components/icons';

export function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <h1 className="hero-title">
          Clone Any Voice.<br />
          Design New Ones.<br />
          Generate Speech.
        </h1>
        <p className="hero-subtitle">
          AI voice cloning and generation.<br />
          10 languages supported.
        </p>
        <Link to="/clone" className="btn btn-hero">
          Get Started →
        </Link>
      </section>

      <section className="features">
        <FeatureCard
          icon={<CloneIcon />}
          title="Clone"
          description="Upload a voice clip (10s–5min) to create a digital replica of any voice."
          href="/clone"
        />
        <FeatureCard
          icon={<DesignIcon />}
          title="Design"
          description="Describe a voice in plain text. No audio upload needed—just imagination."
          href="/design"
        />
        <FeatureCard
          icon={<GenerateIcon />}
          title="Generate"
          description="Type up to 5,000 characters. Hear it spoken in any of your saved voices."
          href="/generate"
        />
      </section>
    </div>
  );
}
```

#### Tailwind Classes

```tsx
// Hero section
className="text-center py-20 md:py-24"

// Hero title
className="text-3xl md:text-5xl font-semibold uppercase tracking-wider leading-tight max-w-4xl mx-auto mb-8"

// Hero subtitle
className="text-muted text-sm md:text-base mb-12 max-w-md mx-auto"

// Features grid
className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pb-20"

// Feature card
className="flex flex-col items-center p-12 bg-white border border-border text-center hover:border-text hover:-translate-y-1 transition-all"
```

---

### 7.2 Clone Page (`/clone`)

#### Current Implementation
- Dropzone for audio file upload
- Form fields: name, transcript, language
- Progress section during cloning
- Example voice button

#### React Component Structure

```tsx
// src/pages/Clone.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { PageTitle, PageGuide, Container } from '@/components/layout';
import { Dropzone, ProgressSection } from '@/components/audio';
import { Button, Input, Textarea, Select, Label, Message } from '@/components/ui';
import { useTask } from '@/hooks/useTask';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import { cloneVoice } from '@/api/voices';

export function Clone() {
  const navigate = useNavigate();
  const { startTask, completeTask } = useTask();
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    transcript: '',
    language: 'Auto',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { elapsed, start: startTimer, stop: stopTimer, reset: resetTimer } = useElapsedTime();

  const mutation = useMutation({
    mutationFn: cloneVoice,
    onMutate: () => {
      setError(null);
      startTimer();
      startTask('clone', '/clone', `Cloning "${formData.name}"`);
    },
    onSuccess: (data) => {
      stopTimer();
      completeTask();
      setSuccess(`Voice "${data.name}" created successfully!`);
      setTimeout(() => navigate('/voices'), 1500);
    },
    onError: (err: Error) => {
      stopTimer();
      completeTask();
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an audio file');
      return;
    }
    mutation.mutate({ ...formData, file });
  };

  const handleFileDrop = useCallback((acceptedFile: File) => {
    setFile(acceptedFile);
    setError(null);
  }, []);

  return (
    <Container>
      <PageTitle>Clone Your Voice</PageTitle>
      
      <PageGuide title="Tips for Best Results">
        <ul>
          <li><strong>Audio length:</strong> 10 seconds to 5 minutes</li>
          <li><strong>Quality:</strong> Clear audio with minimal background noise</li>
          <li><strong>Transcript:</strong> Accurate transcript improves voice matching</li>
          <li><strong>Processing time:</strong> 10–30 seconds typically</li>
        </ul>
        <p><strong>Supported formats:</strong> WAV, MP3, M4A (max 50MB)</p>
      </PageGuide>

      <form onSubmit={handleSubmit}>
        {error && <Message variant="error">{error}</Message>}
        {success && <Message variant="success">{success}</Message>}

        <TryExampleButton onSelect={handleExampleSelect} />

        <Dropzone
          file={file}
          onDrop={handleFileDrop}
          accept={['audio/wav', 'audio/mpeg', 'audio/mp4']}
        />

        <FormGroup>
          <Label htmlFor="voice-name">Voice Name</Label>
          <Input
            id="voice-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My Custom Voice"
            maxLength={100}
            required
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="transcript">Reference Transcript</Label>
          <Textarea
            id="transcript"
            value={formData.transcript}
            onChange={(e) => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
            placeholder="Type or paste what is being said in the audio file..."
            required
          />
          <CharCounter current={formData.transcript.length} />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="language">Language</Label>
          <LanguageSelect
            value={formData.language}
            onChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
          />
        </FormGroup>

        <Button
          type="submit"
          variant="primary"
          block
          loading={mutation.isPending}
        >
          {mutation.isPending ? `Creating... ${formatTime(elapsed)}` : 'Create Voice Clone'}
        </Button>
      </form>

      {mutation.isPending && (
        <ProgressSection
          title="Creating voice clone..."
          elapsed={elapsed}
          hint="This typically takes 10–30 seconds"
        />
      )}
    </Container>
  );
}
```

#### Key Features to Migrate
- [x] Drag & drop file upload
- [x] File validation (type, size)
- [x] Character counter for transcript
- [x] Language selection dropdown
- [x] Progress section with elapsed time
- [x] Try Example Voice button
- [x] Task tracking integration
- [x] Success redirect to /voices

---

### 7.3 Design Page (`/design`)

#### Current Implementation
- Voice description textarea
- Preview text input
- Language selection
- Generate preview → Audio player
- Save voice functionality
- Example prompt cards

#### React Component Structure

```tsx
// src/pages/Design.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageTitle, PageGuide, Container } from '@/components/layout';
import { AudioPlayer, ProgressSection } from '@/components/audio';
import { Button, Textarea, Select, Label, Message } from '@/components/ui';
import { useTask } from '@/hooks/useTask';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { startDesignPreview, saveDesignedVoice } from '@/api/voices';

export function Design() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startTask } = useTask();
  
  const [formData, setFormData] = useState({
    name: '',
    instruct: '',
    text: 'Hello! I\'m so glad you\'re here. Let me help you with anything you need today.',
    language: 'English',
  });
  
  const [previewAudio, setPreviewAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Start preview generation task
  const previewMutation = useMutation({
    mutationFn: startDesignPreview,
    onSuccess: (data) => {
      // Start polling for task completion
      startTask(data.task_id, 'design', '/design', 'Generating voice preview...');
      startPolling(data.task_id);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Poll for task completion
  const { startPolling, isPolling, elapsed } = useTaskPolling({
    onComplete: (result) => {
      // Convert base64 to Blob
      const audioBlob = base64ToBlob(result.audio_base64, 'audio/wav');
      setPreviewAudio(audioBlob);
      setSuccess('Preview generated! Listen and save if you like it.');
    },
    onError: (error) => setError(error),
  });

  // Save voice mutation
  const saveMutation = useMutation({
    mutationFn: saveDesignedVoice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['voices'] });
      setSuccess(`Voice "${data.name}" saved successfully!`);
      setTimeout(() => navigate('/voices'), 1500);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleGeneratePreview = () => {
    setError(null);
    setPreviewAudio(null);
    previewMutation.mutate({
      text: formData.text,
      language: formData.language,
      instruct: formData.instruct,
    });
  };

  const handleSaveVoice = () => {
    if (!previewAudio) return;
    saveMutation.mutate({
      ...formData,
      audio: previewAudio,
    });
  };

  const handleExampleClick = (example: { title: string; description: string }) => {
    setFormData(prev => ({
      ...prev,
      name: example.title,
      instruct: example.description,
    }));
  };

  return (
    <Container>
      <PageTitle>Design a New Voice</PageTitle>
      <p className="subtitle">
        Create a custom voice by describing how you want it to sound. No audio upload needed.
      </p>

      <PageGuide title="Tips for Best Results">
        <ul>
          <li><strong>Description:</strong> Be specific about tone, gender, age, and accent</li>
          <li><strong>Preview text:</strong> Keep it short (under 500 chars) for faster previews</li>
          <li><strong>Processing time:</strong> 15–45 seconds per preview</li>
          <li><strong>Saving:</strong> The preview audio becomes the reference for long-form generation</li>
        </ul>
        <p><strong>Good example:</strong> "A warm, friendly female voice with a gentle British accent"</p>
      </PageGuide>

      <form onSubmit={(e) => e.preventDefault()}>
        {error && <Message variant="error">{error}</Message>}
        {success && <Message variant="success">{success}</Message>}

        <FormGroup>
          <Label htmlFor="voice-name">Voice Name</Label>
          <Input
            id="voice-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My Custom Voice"
            required
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="voice-description">Voice Description</Label>
          <Textarea
            id="voice-description"
            value={formData.instruct}
            onChange={(e) => setFormData(prev => ({ ...prev, instruct: e.target.value }))}
            placeholder="Describe the voice characteristics..."
            maxLength={500}
            required
          />
          <CharCounter current={formData.instruct.length} max={500} />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="preview-text">Preview Text</Label>
          <Textarea
            id="preview-text"
            value={formData.text}
            onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
            maxLength={500}
            required
          />
          <CharCounter current={formData.text.length} max={500} />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="language">Language</Label>
          <LanguageSelect
            value={formData.language}
            onChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
            includeAuto={false}
          />
        </FormGroup>

        {previewAudio && (
          <PreviewSection>
            <AudioPlayer src={URL.createObjectURL(previewAudio)} />
          </PreviewSection>
        )}

        <ButtonGroup>
          <Button
            type="button"
            variant="secondary"
            onClick={handleGeneratePreview}
            loading={isPolling}
            disabled={!formData.instruct || !formData.text}
          >
            {isPolling ? `Generating... ${formatTime(elapsed)}` : 'Generate Preview'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveVoice}
            loading={saveMutation.isPending}
            disabled={!previewAudio || !formData.name}
          >
            Save Voice
          </Button>
        </ButtonGroup>
      </form>

      {isPolling && (
        <ProgressSection
          title="Designing voice..."
          elapsed={elapsed}
          hint="Voice design typically takes 15–45 seconds"
        />
      )}

      <ExamplesSection>
        <h3>Example Voice Descriptions</h3>
        <div className="example-cards">
          {EXAMPLE_VOICES.map((example) => (
            <ExampleCard
              key={example.title}
              title={example.title}
              description={example.description}
              onClick={() => handleExampleClick(example)}
            />
          ))}
        </div>
      </ExamplesSection>
    </Container>
  );
}

const EXAMPLE_VOICES = [
  { title: 'Warm Narrator', description: 'A warm, soothing male voice with a calm demeanor, perfect for storytelling' },
  { title: 'Energetic Host', description: 'An enthusiastic, upbeat female voice with clear articulation for presentations' },
  { title: 'British Butler', description: 'A refined, proper British male voice with slight formality' },
  { title: 'Friendly Assistant', description: 'A helpful, approachable voice with a natural conversational tone' },
  { title: 'News Anchor', description: 'A professional, authoritative voice with measured pacing' },
  { title: 'Gentle Teacher', description: 'A patient, encouraging female voice ideal for educational content' },
];
```

#### Key Features to Migrate
- [x] Voice description with examples
- [x] Preview text input
- [x] Character counters
- [x] Async preview generation with polling
- [x] Audio player for preview
- [x] Save voice with audio blob
- [x] Example voice cards
- [x] Task tracking integration

---

### 7.4 Generate Page (`/generate`)

#### Current Implementation
- Voice selection dropdown
- Text input with character counter
- Async generation with task polling
- Audio player with waveform
- Download button

#### React Component Structure

```tsx
// src/pages/Generate.tsx
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageTitle, PageGuide, Container } from '@/components/layout';
import { AudioPlayer, ProgressSection } from '@/components/audio';
import { Button, Textarea, Select, Label, Message } from '@/components/ui';
import { useTask } from '@/hooks/useTask';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { fetchVoices } from '@/api/voices';
import { startGeneration } from '@/api/generations';

export function Generate() {
  const { activeTask, startTask, clearTask } = useTask();
  
  const [formData, setFormData] = useState({
    voiceId: '',
    text: '',
    language: 'Auto',
  });
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch voices for dropdown
  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: ['voices'],
    queryFn: fetchVoices,
  });

  // Start generation task
  const generateMutation = useMutation({
    mutationFn: startGeneration,
    onSuccess: (data) => {
      startTask(
        data.task_id,
        'generate',
        '/generate',
        `Generating "${formData.text.slice(0, 30)}..."`,
        formData // Store form state for restoration
      );
      startPolling(data.task_id);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Poll for task completion
  const { startPolling, isPolling, elapsed, reset: resetPolling } = useTaskPolling({
    onComplete: (result) => {
      setAudioUrl(result.audio_url);
      clearTask();
    },
    onError: (error) => {
      setError(error);
      clearTask();
    },
  });

  // Restore state if returning to page with active task
  useEffect(() => {
    if (activeTask?.type === 'generate' && activeTask.originPage === '/generate') {
      // Restore form state
      if (activeTask.formState) {
        setFormData(activeTask.formState);
      }
      
      // If task completed, show result
      if (activeTask.status === 'completed' && activeTask.result) {
        setAudioUrl(activeTask.result.audio_url);
        clearTask();
      } else if (activeTask.status === 'failed') {
        setError(activeTask.error || 'Generation failed');
        clearTask();
      } else {
        // Resume polling
        startPolling(activeTask.taskId);
      }
    }
  }, [activeTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAudioUrl(null);
    
    if (!formData.voiceId) {
      setError('Please select a voice');
      return;
    }
    if (!formData.text.trim()) {
      setError('Please enter some text');
      return;
    }

    generateMutation.mutate({
      voice_id: formData.voiceId,
      text: formData.text,
      language: formData.language,
      model: '0.6B',
    });
  };

  return (
    <Container>
      <PageTitle>Generate Speech</PageTitle>

      <PageGuide title="Tips for Best Results">
        <ul>
          <li><strong>Max text:</strong> 5,000 characters per generation</li>
          <li><strong>Punctuation:</strong> Use periods for pauses, commas for brief breaks</li>
          <li><strong>First generation:</strong> May take longer while the system warms up</li>
          <li><strong>Subsequent:</strong> Faster after the first generation</li>
        </ul>
      </PageGuide>

      <form onSubmit={handleSubmit}>
        {error && <Message variant="error">{error}</Message>}

        <FormGroup>
          <Label htmlFor="voice-select">Voice</Label>
          <Select
            id="voice-select"
            value={formData.voiceId}
            onChange={(e) => setFormData(prev => ({ ...prev, voiceId: e.target.value }))}
            disabled={voicesLoading}
            required
          >
            <option value="">Select a voice...</option>
            {voices?.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="language-select">Language</Label>
          <LanguageSelect
            value={formData.language}
            onChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="text-input">Text</Label>
          <Textarea
            id="text-input"
            value={formData.text}
            onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
            placeholder="Enter text to speak..."
            maxLength={5000}
            required
          />
          <CharCounter current={formData.text.length} max={5000} />
        </FormGroup>

        <Message variant="info">
          Tips: Use commas for pauses. End sentences with periods.
        </Message>

        <Button
          type="submit"
          variant="primary"
          block
          loading={isPolling}
          disabled={generateMutation.isPending}
        >
          {isPolling ? `Generating... ${formatTime(elapsed)}` : 'Generate Speech'}
        </Button>
      </form>

      {isPolling && (
        <ProgressSection
          title="Generating speech..."
          elapsed={elapsed}
          hint="First generation may take 30–90s while the GPU warms up"
        />
      )}

      {audioUrl && (
        <ResultSection>
          <AudioPlayer
            src={audioUrl}
            showWaveform
            showDownload
            downloadFilename="speech.mp3"
          />
        </ResultSection>
      )}
    </Container>
  );
}
```

#### Key Features to Migrate
- [x] Voice selection from API
- [x] Text input with character counter
- [x] Language selection
- [x] Async generation with task polling
- [x] Form state persistence across navigation
- [x] Result restoration on page return
- [x] Audio player with waveform
- [x] Download functionality
- [x] Task tracking integration

---

### 7.5 Voices Page (`/voices`)

#### Current Implementation
- Grid of voice cards
- Preview playback
- Delete functionality
- Empty state

#### React Component Structure

```tsx
// src/pages/Voices.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageTitle, Container } from '@/components/layout';
import { VoiceCard } from '@/components/cards';
import { fetchVoices, deleteVoice, previewVoice } from '@/api/voices';

export function Voices() {
  const queryClient = useQueryClient();
  
  const { data: voices, isLoading, error } = useQuery({
    queryKey: ['voices'],
    queryFn: fetchVoices,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voices'] });
    },
  });

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  const handlePreview = async (voiceId: string) => {
    // Stop any current preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }

    if (previewingId === voiceId) {
      setPreviewingId(null);
      return;
    }

    setPreviewingId(voiceId);
    const audioUrl = await previewVoice(voiceId);
    const audio = new Audio(audioUrl);
    audio.onended = () => setPreviewingId(null);
    audio.play();
    setPreviewAudio(audio);
  };

  const handleDelete = (voiceId: string, voiceName: string) => {
    if (confirm(`Delete voice "${voiceName}"?`)) {
      deleteMutation.mutate(voiceId);
    }
  };

  if (isLoading) {
    return (
      <Container>
        <PageTitle>My Voices</PageTitle>
        <LoadingGrid />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <PageTitle>My Voices</PageTitle>
        <Message variant="error">Failed to load voices</Message>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle>My Voices</PageTitle>

      {voices?.length === 0 ? (
        <EmptyState
          title="No voices yet"
          description="Clone or design your first voice to get started."
          actions={
            <>
              <Link to="/clone">Clone a voice →</Link>
              <Link to="/design">Design a voice →</Link>
            </>
          }
        />
      ) : (
        <div className="voices-grid">
          {voices?.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              isPreviewing={previewingId === voice.id}
              onPreview={() => handlePreview(voice.id)}
              onDelete={() => handleDelete(voice.id, voice.name)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === voice.id}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
```

#### Key Features to Migrate
- [x] Voice list from API
- [x] Voice card display
- [x] Preview playback with toggle
- [x] Delete with confirmation
- [x] Empty state with CTAs
- [x] Loading state
- [x] Error handling

---

### 7.6 History Page (`/history`)

#### Current Implementation
- Grid of generation history cards
- Audio playback
- Delete functionality
- Empty state

#### React Component Structure

```tsx
// src/pages/History.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageTitle, Container } from '@/components/layout';
import { HistoryCard } from '@/components/cards';
import { fetchGenerations, deleteGeneration } from '@/api/generations';

export function History() {
  const queryClient = useQueryClient();
  
  const { data: generations, isLoading, error } = useQuery({
    queryKey: ['generations'],
    queryFn: fetchGenerations,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGeneration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generations'] });
    },
  });

  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlay = (generationId: string, audioUrl: string) => {
    // Audio player logic
  };

  const handleDelete = (generationId: string) => {
    if (confirm('Delete this generation?')) {
      deleteMutation.mutate(generationId);
    }
  };

  if (isLoading) {
    return (
      <Container>
        <PageTitle>Generation History</PageTitle>
        <LoadingGrid />
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle>Generation History</PageTitle>

      {generations?.length === 0 ? (
        <EmptyState
          title="No generations yet"
          description="Generate some speech to see your history here."
          actions={<Link to="/generate">Generate speech →</Link>}
        />
      ) : (
        <div className="history-grid">
          {generations?.map((generation) => (
            <HistoryCard
              key={generation.id}
              generation={generation}
              isPlaying={playingId === generation.id}
              onPlay={() => handlePlay(generation.id, generation.audio_url)}
              onDelete={() => handleDelete(generation.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </Container>
  );
}
```

#### Key Features to Migrate
- [x] Generation history from API
- [x] History card display
- [x] Audio playback
- [x] Text preview (truncated)
- [x] Duration and date display
- [x] Delete functionality
- [x] Empty state
- [x] Loading state

---

### 7.7 About Page (`/about`)

#### Current Implementation
- Feature documentation
- Supported languages
- Privacy information

#### React Component

```tsx
// src/pages/About.tsx
import { PageTitle, Container } from '@/components/layout';

export function About() {
  return (
    <Container>
      <PageTitle>About Utter</PageTitle>

      <div className="about-content">
        <AboutSection title="What is Utter?">
          <p>
            Utter is an AI-powered voice platform that lets you clone existing voices
            and design entirely new ones. Generate natural-sounding speech in 10 languages.
          </p>
        </AboutSection>

        <AboutSection title="Features">
          <table className="about-table">
            <tbody>
              <tr>
                <td><strong>Clone</strong></td>
                <td>Upload 10s–5min of audio to create a voice replica. Requires transcript.</td>
              </tr>
              <tr>
                <td><strong>Design</strong></td>
                <td>Describe a voice in plain text—no audio needed. Great for creating new personas.</td>
              </tr>
              <tr>
                <td><strong>Generate</strong></td>
                <td>Convert up to 5,000 characters of text to speech using any saved voice.</td>
              </tr>
            </tbody>
          </table>
        </AboutSection>

        <AboutSection title="Supported Languages">
          <p>English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian</p>
          <p>Language auto-detection is available, or you can specify explicitly for best results.</p>
        </AboutSection>

        <AboutSection title="Privacy & Ethics">
          <p>Voice cloning technology should be used responsibly:</p>
          <ul>
            <li>Only clone voices you have explicit permission to use</li>
            <li>Audio files are stored securely for your use only</li>
            <li>Your data is not used to train our models</li>
          </ul>
        </AboutSection>
      </div>
    </Container>
  );
}
```

---

## 8. Shared Components Library

### 8.1 UI Primitives

#### Button Component

```tsx
// src/components/ui/Button.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', block, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'font-mono font-medium uppercase tracking-wide border transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-black text-white border-black hover:bg-white hover:text-black': variant === 'primary',
            'bg-white text-black border-border hover:border-black': variant === 'secondary',
            'px-4 py-2 text-xs': size === 'sm',
            'px-6 py-3 text-sm': size === 'md',
            'px-8 py-4 text-base': size === 'lg',
            'w-full': block,
            'cursor-wait': loading,
          },
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner className="mr-2 h-4 w-4" />}
        {children}
      </button>
    );
  }
);
```

#### Input Component

```tsx
// src/components/ui/Input.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-3 font-mono text-sm',
          'bg-white border border-border',
          'focus:outline-none focus:border-black',
          'placeholder:text-muted',
          className
        )}
        {...props}
      />
    );
  }
);
```

#### Textarea Component

```tsx
// src/components/ui/Textarea.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-4 py-3 font-mono text-sm min-h-[150px] resize-y',
          'bg-white border border-border',
          'focus:outline-none focus:border-black',
          'placeholder:text-muted',
          className
        )}
        {...props}
      />
    );
  }
);
```

#### Select Component

```tsx
// src/components/ui/Select.tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full px-4 py-3 font-mono text-sm appearance-none cursor-pointer',
          'bg-white border border-border pr-10',
          'focus:outline-none focus:border-black',
          'bg-no-repeat bg-right-4',
          className
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23555' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 16px center',
        }}
        {...props}
      >
        {children}
      </select>
    );
  }
);
```

#### Message Component

```tsx
// src/components/ui/Message.tsx
import { cn } from '@/lib/cn';

interface MessageProps {
  variant?: 'info' | 'error' | 'success';
  children: React.ReactNode;
  className?: string;
}

export function Message({ variant = 'info', children, className }: MessageProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 border-l-3 text-xs mb-4',
        {
          'bg-subtle border-border-strong text-muted': variant === 'info',
          'bg-red-50 border-red-500 text-red-700': variant === 'error',
          'bg-green-50 border-green-500 text-green-700': variant === 'success',
        },
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 8.2 Layout Components

#### Header Component

```tsx
// src/components/layout/Header.tsx
import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

const navItems = [
  { path: '/clone', label: 'Clone' },
  { path: '/design', label: 'Design' },
  { path: '/voices', label: 'Voices' },
  { path: '/generate', label: 'Generate' },
  { path: '/history', label: 'History' },
  { path: '/about', label: 'About' },
];

export function Header() {
  return (
    <header className="flex justify-between items-center px-6 py-4 border-b border-border bg-white relative z-10">
      <NavLink to="/" className="font-mono font-semibold text-lg tracking-wider">
        UTTER
      </NavLink>
      
      <nav className="hidden md:flex gap-6">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'font-mono text-xs uppercase tracking-wide transition-colors',
                isActive ? 'text-black font-medium' : 'text-muted hover:text-black'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <MobileMenuButton />
    </header>
  );
}
```

#### Container Component

```tsx
// src/components/layout/Container.tsx
import { cn } from '@/lib/cn';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn('w-full max-w-[640px] mx-auto px-6 py-12', className)}>
      {children}
    </div>
  );
}
```

#### PageTitle Component

```tsx
// src/components/layout/PageTitle.tsx
interface PageTitleProps {
  children: React.ReactNode;
}

export function PageTitle({ children }: PageTitleProps) {
  return (
    <h1 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-center mb-8">
      {children}
    </h1>
  );
}
```

#### PageGuide Component

```tsx
// src/components/layout/PageGuide.tsx
import { useState } from 'react';
import { cn } from '@/lib/cn';

interface PageGuideProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PageGuide({ title, children, defaultOpen = false }: PageGuideProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className="mb-6 bg-subtle border border-border"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="flex justify-between items-center px-4 py-3 cursor-pointer select-none text-xs text-muted hover:bg-muted hover:text-black list-none">
        <span>ℹ️ {title}</span>
        <span
          className={cn(
            'text-[10px] transition-transform',
            isOpen && 'rotate-180'
          )}
        >
          ▼
        </span>
      </summary>
      <div className="px-4 py-3 border-t border-border text-xs text-muted">
        {children}
      </div>
    </details>
  );
}
```

### 8.3 Audio Components

#### Dropzone Component

```tsx
// src/components/audio/Dropzone.tsx
import { useCallback } from 'react';
import { cn } from '@/lib/cn';

interface DropzoneProps {
  file: File | null;
  onDrop: (file: File) => void;
  accept?: string[];
  maxSize?: number;
  className?: string;
}

export function Dropzone({ 
  file, 
  onDrop, 
  accept = ['audio/wav', 'audio/mpeg', 'audio/mp4'],
  maxSize = 50 * 1024 * 1024,
  className 
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile, accept, maxSize)) {
      onDrop(droppedFile);
    }
  }, [accept, maxSize, onDrop]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile, accept, maxSize)) {
      onDrop(selectedFile);
    }
  }, [accept, maxSize, onDrop]);

  return (
    <div
      className={cn(
        'w-full py-12 px-6 bg-subtle border border-dashed border-border text-center cursor-pointer transition-colors',
        isDragOver && 'border-black bg-muted',
        file && 'border-solid border-black',
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept={accept.join(',')}
        onChange={handleFileSelect}
        hidden
      />
      
      {file ? (
        <div className="text-sm">
          <div className="text-2xl mb-2">✓</div>
          <div className="font-medium">{file.name}</div>
          <div className="text-muted mt-1">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </div>
        </div>
      ) : (
        <>
          <div className="text-2xl mb-2">↑</div>
          <div className="text-sm font-medium">
            Drop audio file here or click to browse
          </div>
          <div className="text-xs text-muted mt-2">
            WAV, MP3, M4A • 10 seconds to 5 minutes
          </div>
        </>
      )}
    </div>
  );
}
```

#### AudioPlayer Component

```tsx
// src/components/audio/AudioPlayer.tsx
import { useRef, useState, useEffect } from 'react';
import { useWaveform } from '@/hooks/useWaveform';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/formatTime';

interface AudioPlayerProps {
  src: string;
  showWaveform?: boolean;
  showDownload?: boolean;
  downloadFilename?: string;
  className?: string;
}

export function AudioPlayer({
  src,
  showWaveform = true,
  showDownload = false,
  downloadFilename = 'audio.mp3',
  className,
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { wavesurfer, isReady } = useWaveform({
    container: containerRef,
    url: src,
    onReady: (ws) => {
      setDuration(ws.getDuration());
    },
    onAudioprocess: (time) => {
      setCurrentTime(time);
    },
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onFinish: () => setIsPlaying(false),
  });

  const togglePlay = () => {
    wavesurfer?.playPause();
  };

  return (
    <div className={cn('flex items-center gap-4 p-4 bg-subtle border border-border', className)}>
      <button
        type="button"
        className="w-10 h-10 flex items-center justify-center border border-black hover:bg-black hover:text-white transition-colors"
        onClick={togglePlay}
        disabled={!isReady}
      >
        {isPlaying ? (
          <PauseIcon className="w-4 h-4" />
        ) : (
          <PlayIcon className="w-4 h-4" />
        )}
      </button>

      {showWaveform && (
        <div ref={containerRef} className="flex-1 min-w-0" />
      )}

      <div className="text-xs font-mono text-muted whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      {showDownload && (
        <a
          href={src}
          download={downloadFilename}
          className="px-4 py-2 text-xs font-mono uppercase border border-border hover:border-black transition-colors"
        >
          Download
        </a>
      )}
    </div>
  );
}
```

#### ProgressSection Component

```tsx
// src/components/audio/ProgressSection.tsx
import { formatTime } from '@/lib/formatTime';

interface ProgressSectionProps {
  title: string;
  elapsed: number;
  hint?: string;
}

export function ProgressSection({ title, elapsed, hint }: ProgressSectionProps) {
  return (
    <div className="flex items-center gap-4 p-6 bg-subtle border border-border mt-6">
      <div className="w-8 h-8 border-2 border-border border-t-black rounded-full animate-spin flex-shrink-0" />
      
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide">
          {title}
        </div>
        <div className="mt-1">
          <span className="text-2xl font-semibold">
            {formatTime(elapsed)}
          </span>
          <span className="text-xs text-muted ml-2">elapsed</span>
        </div>
        {hint && (
          <div className="text-[11px] text-muted/70 mt-1">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 8.4 Task Components

#### TaskModal Component

```tsx
// src/components/task/TaskModal.tsx
import { useTask } from '@/hooks/useTask';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/formatTime';

const taskIcons = {
  generate: '▶',
  clone: '🎤',
  design: '✨',
};

export function TaskModal() {
  const navigate = useNavigate();
  const { activeTask, isVisible, elapsed, clearTask } = useTask();

  if (!activeTask || !isVisible) return null;

  const isComplete = activeTask.status === 'completed';
  const isFailed = activeTask.status === 'failed';

  const handleClick = () => {
    if (activeTask.originPage) {
      navigate(activeTask.originPage);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearTask();
  };

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 bg-white border-2 border-black p-3 z-50 cursor-pointer max-w-[280px]',
        'shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all',
        isComplete && 'bg-black text-white',
        isFailed && 'border-red-500'
      )}
      onClick={handleClick}
    >
      {/* Pulse indicator */}
      <div
        className={cn(
          'absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full',
          isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-black animate-pulse'
        )}
      />

      <div className="flex items-center gap-3">
        <div className="text-xl flex-shrink-0">
          {taskIcons[activeTask.type] || '⏳'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide truncate">
            {isComplete ? 'Complete! Click to view' : activeTask.description}
          </div>
          <div className="flex gap-2 text-[11px] text-muted mt-0.5">
            <span className="font-medium">
              {isComplete ? 'Ready' : isFailed ? 'Failed' : 'Processing...'}
            </span>
            <span>{formatTime(elapsed)} elapsed</span>
          </div>
        </div>

        <button
          className={cn(
            'text-xl text-muted hover:text-black transition-colors p-1',
            isComplete && 'text-white/70 hover:text-white'
          )}
          onClick={handleDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

---

## 9. State Management

### 9.1 Context Providers

#### TaskContext

```tsx
// src/context/TaskContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';

interface Task {
  taskId: string;
  type: 'generate' | 'clone' | 'design';
  originPage: string;
  description: string;
  formState?: Record<string, any>;
  startedAt: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface TaskContextValue {
  activeTask: Task | null;
  isVisible: boolean;
  elapsed: number;
  startTask: (taskId: string, type: Task['type'], originPage: string, description: string, formState?: Record<string, any>) => void;
  updateTask: (updates: Partial<Task>) => void;
  clearTask: () => void;
}

const TaskContext = createContext<TaskContextValue | null>(null);

const STORAGE_KEY = 'utter_active_task';

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [activeTask, setActiveTask] = useState<Task | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [elapsed, setElapsed] = useState(0);

  // Sync to localStorage
  useEffect(() => {
    if (activeTask) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTask));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeTask]);

  // Elapsed time timer
  useEffect(() => {
    if (!activeTask) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeTask.startedAt) / 1000));
    }, 1000);

    // Initial update
    setElapsed(Math.floor((Date.now() - activeTask.startedAt) / 1000));

    return () => clearInterval(interval);
  }, [activeTask?.startedAt]);

  // Check if modal should be visible (not on origin page)
  const isVisible = activeTask ? location.pathname !== activeTask.originPage : false;

  const startTask = useCallback((
    taskId: string,
    type: Task['type'],
    originPage: string,
    description: string,
    formState?: Record<string, any>
  ) => {
    setActiveTask({
      taskId,
      type,
      originPage,
      description,
      formState,
      startedAt: Date.now(),
      status: 'pending',
    });
  }, []);

  const updateTask = useCallback((updates: Partial<Task>) => {
    setActiveTask(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const clearTask = useCallback(() => {
    setActiveTask(null);
  }, []);

  return (
    <TaskContext.Provider value={{
      activeTask,
      isVisible,
      elapsed,
      startTask,
      updateTask,
      clearTask,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTask() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within TaskProvider');
  }
  return context;
}
```

### 9.2 Custom Hooks

#### useTaskPolling Hook

```tsx
// src/hooks/useTaskPolling.ts
import { useState, useRef, useCallback } from 'react';
import { useTask } from '@/context/TaskContext';
import { fetchTaskStatus } from '@/api/tasks';

interface UseTaskPollingOptions {
  onComplete: (result: any) => void;
  onError: (error: string) => void;
  interval?: number;
}

export function useTaskPolling({ onComplete, onError, interval = 1000 }: UseTaskPollingOptions) {
  const { updateTask, clearTask } = useTask();
  const [isPolling, setIsPolling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback((taskId: string) => {
    setIsPolling(true);
    startTimeRef.current = Date.now();
    setElapsed(0);

    // Start elapsed timer
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Start polling
    const poll = async () => {
      try {
        const task = await fetchTaskStatus(taskId);
        
        updateTask({
          status: task.status,
          result: task.result,
          error: task.error,
        });

        if (task.status === 'completed') {
          stopPolling();
          onComplete(task.result);
        } else if (task.status === 'failed') {
          stopPolling();
          onError(task.error || 'Task failed');
        }
      } catch (err) {
        // Continue polling on network error
        console.error('Poll error:', err);
      }
    };

    // Initial poll
    poll();

    // Continue polling
    intervalRef.current = window.setInterval(poll, interval);
  }, [interval, onComplete, onError, stopPolling, updateTask]);

  const reset = useCallback(() => {
    stopPolling();
    setElapsed(0);
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    isPolling,
    elapsed,
    reset,
  };
}
```

#### useWaveform Hook

```tsx
// src/hooks/useWaveform.ts
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface UseWaveformOptions {
  container: React.RefObject<HTMLDivElement>;
  url?: string;
  onReady?: (wavesurfer: WaveSurfer) => void;
  onAudioprocess?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onFinish?: () => void;
}

export function useWaveform({
  container,
  url,
  onReady,
  onAudioprocess,
  onPlay,
  onPause,
  onFinish,
}: UseWaveformOptions) {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!container.current || !url) return;

    const ws = WaveSurfer.create({
      container: container.current,
      waveColor: '#a0a0a0',
      progressColor: '#111111',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 0,
      height: 48,
      normalize: true,
    });

    ws.load(url);

    ws.on('ready', () => {
      setIsReady(true);
      onReady?.(ws);
    });

    ws.on('audioprocess', () => {
      onAudioprocess?.(ws.getCurrentTime());
    });

    ws.on('play', () => onPlay?.());
    ws.on('pause', () => onPause?.());
    ws.on('finish', () => onFinish?.());

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      setIsReady(false);
    };
  }, [url, container]);

  return {
    wavesurfer: wavesurferRef.current,
    isReady,
  };
}
```

#### useElapsedTime Hook

```tsx
// src/hooks/useElapsedTime.ts
import { useState, useRef, useCallback } from 'react';

export function useElapsedTime() {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsed(0);

    intervalRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
  }, [stop]);

  return { elapsed, start, stop, reset };
}
```

---

## 10. API Integration Layer

### 10.1 Base Client

```tsx
// src/api/client.ts
const API_BASE = '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...init } = options;
  
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    url += '?' + new URLSearchParams(params).toString();
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Upload failed');
    }

    return response.json();
  },
};
```

### 10.2 API Modules

```tsx
// src/api/voices.ts
import { api } from './client';
import type { Voice, VoiceCreateInput, DesignPreviewInput, DesignSaveInput } from '@/types';

export const fetchVoices = () =>
  api.get<Voice[]>('/voices');

export const deleteVoice = (id: string) =>
  api.delete<{ deleted: boolean }>(`/voices/${id}`);

export const previewVoice = (id: string) =>
  `/api/voices/${id}/preview`; // Returns URL for audio

export const cloneVoice = async (input: VoiceCreateInput) => {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('audio', input.file);
  formData.append('transcript', input.transcript);
  formData.append('language', input.language);
  return api.upload<Voice>('/clone', formData);
};

export const startDesignPreview = (input: DesignPreviewInput) =>
  api.post<{ task_id: string; status: string }>('/voices/design/preview', input);

export const saveDesignedVoice = async (input: DesignSaveInput) => {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('text', input.text);
  formData.append('language', input.language);
  formData.append('instruct', input.instruct);
  formData.append('audio', input.audio, 'preview.wav');
  return api.upload<Voice>('/voices/design', formData);
};
```

```tsx
// src/api/generations.ts
import { api } from './client';
import type { Generation, GenerateInput } from '@/types';

export const fetchGenerations = () =>
  api.get<Generation[]>('/generations');

export const deleteGeneration = (id: string) =>
  api.delete<{ deleted: boolean }>(`/generations/${id}`);

export const startGeneration = (input: GenerateInput) =>
  api.post<{ task_id: string; status: string }>('/generate', input);
```

```tsx
// src/api/tasks.ts
import { api } from './client';
import type { Task } from '@/types';

export const fetchTaskStatus = (taskId: string) =>
  api.get<Task>(`/tasks/${taskId}`);

export const cancelTask = (taskId: string) =>
  api.delete<{ deleted: boolean }>(`/tasks/${taskId}`);
```

---

## 11. Styling Strategy

### 11.1 Tailwind V4 Configuration

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#ffffff',
          subtle: '#fafafa',
          muted: '#f0f0f0',
        },
        text: {
          DEFAULT: '#111111',
          muted: '#555555',
          faint: '#888888',
        },
        border: {
          DEFAULT: '#cccccc',
          strong: '#999999',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
      },
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '6': '48px',
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 11.2 CSS Custom Properties (for complex styles)

```css
/* src/index.css */
@import 'tailwindcss';

@layer base {
  body {
    @apply font-mono text-sm leading-relaxed bg-bg text-text min-h-screen;
  }

  /* Halftone background pattern */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
    background-size: 16px 16px;
    pointer-events: none;
    z-index: -1;
  }
}

@layer components {
  .btn {
    @apply font-mono font-medium uppercase tracking-wide border transition-colors;
    @apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-primary {
    @apply bg-black text-white border-black;
    @apply hover:bg-white hover:text-black;
  }

  .btn-secondary {
    @apply bg-white text-black border-border;
    @apply hover:border-black;
  }

  .input {
    @apply w-full px-4 py-3 font-mono text-sm;
    @apply bg-white border border-border;
    @apply focus:outline-none focus:border-black;
    @apply placeholder:text-text-muted;
  }
}
```

### 11.3 Utility Function

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 12. Mobile-First Responsive Design

### 12.1 Breakpoint Strategy

| Breakpoint | Width | Target |
|------------|-------|--------|
| Base | 0-639px | Mobile phones |
| `sm` | 640px+ | Large phones, small tablets |
| `md` | 768px+ | Tablets |
| `lg` | 1024px+ | Laptops |
| `xl` | 1280px+ | Desktops |

### 12.2 Mobile Navigation

```tsx
// src/components/layout/MobileNav.tsx
import { useState } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        className="p-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <div className="w-6 h-0.5 bg-black mb-1.5" />
        <div className="w-6 h-0.5 bg-black mb-1.5" />
        <div className="w-6 h-0.5 bg-black" />
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex justify-end p-4">
            <button onClick={() => setIsOpen(false)} className="text-2xl">
              ×
            </button>
          </div>
          <nav className="flex flex-col items-center gap-6 pt-12">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'text-lg font-mono uppercase tracking-wider',
                    isActive ? 'text-black font-semibold' : 'text-muted'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
```

### 12.3 Responsive Component Examples

```tsx
// Hero section
<section className="text-center py-16 md:py-24 px-4">
  <h1 className="text-2xl sm:text-3xl md:text-5xl font-semibold uppercase tracking-wider leading-tight">
    Clone Any Voice.<br />
    Design New Ones.<br />
    Generate Speech.
  </h1>
</section>

// Feature grid
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
  {/* Feature cards */}
</div>

// Voice/History grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>

// Audio player - stack on mobile
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4">
  <button className="w-full sm:w-auto">Play</button>
  <div className="flex-1 min-h-[48px]">Waveform</div>
  <div className="flex justify-between sm:block">
    <span>Time</span>
    <a className="sm:ml-4">Download</a>
  </div>
</div>

// Form - full width on mobile
<div className="w-full max-w-lg mx-auto px-4 sm:px-0">
  <form>{/* Form fields */}</form>
</div>
```

### 12.4 Touch Considerations

```tsx
// Larger touch targets on mobile
<button className="min-h-[44px] min-w-[44px] p-3 sm:p-2">
  {/* Icon */}
</button>

// Increased spacing for touch
<div className="space-y-4 sm:space-y-3">
  {/* Form groups */}
</div>

// Dropzone - larger on mobile
<div className="py-16 sm:py-12 px-6">
  {/* Dropzone content */}
</div>
```

---

## 13. Task Tracking System Migration

### 13.1 Current Implementation Analysis

| Aspect | Current (Vanilla JS) | React Migration |
|--------|---------------------|-----------------|
| State Storage | localStorage + class | TaskContext + localStorage sync |
| Polling | setInterval in class | useTaskPolling hook |
| Modal | DOM manipulation | TaskModal component |
| Events | CustomEvent dispatch | React state updates |
| Timer | setInterval | useElapsedTime hook |

### 13.2 Feature Parity Checklist

- [x] Start task with metadata (type, origin, description)
- [x] Store form state for restoration
- [x] Poll backend `/api/tasks/{id}` every 1 second
- [x] Show modal when on different page than origin
- [x] Display elapsed time in modal
- [x] Handle completed/failed states with visual indicators
- [x] Click modal to navigate back to origin page
- [x] Dismiss button to clear task
- [x] Restore state when returning to origin page
- [x] Cross-tab synchronization via localStorage
- [x] Auto-cleanup stale tasks (10 min TTL)

### 13.3 Migration Steps

1. **Create TaskContext** with state and localStorage sync
2. **Create useTaskPolling hook** for API polling
3. **Create TaskModal component** matching current styles
4. **Update each page** to use task system:
   - Generate: Full task tracking with form restoration
   - Design: Preview generation with polling
   - Clone: Simple task tracking (no async backend)
5. **Test cross-page navigation** during active tasks
6. **Test form state restoration** on page return

---

## 14. Testing Strategy

### 14.1 Unit Tests

```tsx
// src/components/ui/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### 14.2 Integration Tests

```tsx
// src/pages/__tests__/Generate.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { TaskProvider } from '@/context/TaskContext';
import { Generate } from '../Generate';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    <TaskProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </TaskProvider>
  </QueryClientProvider>
);

describe('Generate page', () => {
  it('loads voices on mount', async () => {
    render(<Generate />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Select a voice...')).toBeInTheDocument();
    });
  });

  it('shows error for empty text', async () => {
    render(<Generate />, { wrapper });
    await userEvent.click(screen.getByText('Generate Speech'));
    expect(screen.getByText('Please enter some text')).toBeInTheDocument();
  });
});
```

### 14.3 E2E Tests (Playwright)

```ts
// e2e/generate.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Generate page', () => {
  test('generates speech successfully', async ({ page }) => {
    await page.goto('/generate');
    
    // Select voice
    await page.selectOption('#voice-select', { index: 1 });
    
    // Enter text
    await page.fill('#text-input', 'Hello world');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for result
    await expect(page.locator('.result-section')).toBeVisible({ timeout: 120000 });
    
    // Check audio player exists
    await expect(page.locator('audio')).toBeVisible();
  });

  test('shows task modal when navigating away', async ({ page }) => {
    await page.goto('/generate');
    await page.selectOption('#voice-select', { index: 1 });
    await page.fill('#text-input', 'Hello world');
    await page.click('button[type="submit"]');
    
    // Navigate away
    await page.click('a[href="/voices"]');
    
    // Task modal should appear
    await expect(page.locator('.task-modal')).toBeVisible();
  });
});
```

---

## 15. Migration Phases

### Phase 1: Foundation (Week 1)

**Goal**: Set up project structure, core components, routing

| Task | Effort | Dependencies |
|------|--------|--------------|
| Initialize Vite + React 19 + TypeScript | 2h | None |
| Configure Tailwind V4 | 1h | Vite setup |
| Set up React Router | 2h | Vite setup |
| Create base layout (Header, Container) | 3h | Router |
| Create UI primitives (Button, Input, etc.) | 4h | Tailwind |
| Set up TanStack Query | 1h | None |
| Create API client layer | 2h | None |

**Deliverable**: Empty shell app with routing and basic layout

### Phase 2: Static Pages (Week 1-2)

**Goal**: Migrate pages without complex interactivity

| Task | Effort | Dependencies |
|------|--------|--------------|
| Landing page | 3h | Layout, UI primitives |
| About page | 1h | Layout |
| Voices page (list + delete) | 4h | API client, Card component |
| History page (list + delete) | 4h | API client, Card component |

**Deliverable**: Static pages functional with API integration

### Phase 3: Core Features (Week 2-3)

**Goal**: Migrate complex interactive pages

| Task | Effort | Dependencies |
|------|--------|--------------|
| TaskContext + useTaskPolling | 4h | None |
| TaskModal component | 3h | TaskContext |
| AudioPlayer + useWaveform | 4h | WaveSurfer |
| Dropzone component | 3h | None |
| Clone page | 6h | Dropzone, TaskContext |
| Generate page | 8h | AudioPlayer, TaskContext, useTaskPolling |
| Design page | 8h | AudioPlayer, TaskContext, useTaskPolling |

**Deliverable**: Full feature parity

### Phase 4: Polish & Testing (Week 3-4)

**Goal**: Mobile optimization, testing, bug fixes

| Task | Effort | Dependencies |
|------|--------|--------------|
| Mobile navigation | 3h | Header |
| Responsive refinements | 4h | All pages |
| Unit tests for components | 4h | Components |
| Integration tests | 4h | Pages |
| E2E tests | 4h | Full app |
| Performance optimization | 3h | Full app |
| Accessibility audit | 2h | Full app |

**Deliverable**: Production-ready React app

### Phase 5: Deployment (Week 4)

**Goal**: Deploy and switch over

| Task | Effort | Dependencies |
|------|--------|--------------|
| Build optimization | 2h | Full app |
| Configure backend to serve React | 2h | Build |
| Deploy to staging | 1h | Backend config |
| User acceptance testing | 4h | Staging deploy |
| Production deployment | 1h | UAT pass |
| Remove old Jinja templates | 1h | Prod deploy |

**Deliverable**: React app live in production

---

## 16. Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Task system state bugs | Lost results | Comprehensive testing, localStorage fallback |
| WaveSurfer integration issues | No audio playback | Test early, keep fallback audio element |
| Mobile performance | Poor UX | Lazy loading, code splitting, profiling |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| API type mismatches | Runtime errors | TypeScript strict mode, API response validation |
| Form state loss | User frustration | Task formState persistence, localStorage backup |
| CSS specificity conflicts | Styling bugs | Tailwind-first approach, minimal custom CSS |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bundle size increase | Slower load | Code splitting, tree shaking, lazy routes |
| Browser compatibility | Some users affected | Vite modern target, polyfills if needed |

---

## Appendix A: File Mapping

| Current File | React Equivalent |
|--------------|------------------|
| `templates/base.html` | `App.tsx`, `Header.tsx`, `TaskModal.tsx` |
| `templates/index.html` | `pages/Landing.tsx` |
| `templates/clone.html` | `pages/Clone.tsx` |
| `templates/design.html` | `pages/Design.tsx` |
| `templates/generate.html` | `pages/Generate.tsx` |
| `templates/voices.html` | `pages/Voices.tsx` |
| `templates/history.html` | `pages/History.tsx` |
| `templates/about.html` | `pages/About.tsx` |
| `static/js/app.js` | Page components + hooks |
| `static/js/task-manager.js` | `context/TaskContext.tsx`, `hooks/useTaskPolling.ts` |
| `static/js/waveform-manager.js` | `hooks/useWaveform.ts` |
| `static/css/style.css` | `index.css` + Tailwind utilities |

---

## Appendix B: Component Inventory

### Total Components: 35

**UI Primitives (7)**
- Button, Input, Textarea, Select, Label, Message, CharCounter

**Layout (5)**
- Header, Container, PageTitle, PageGuide, FormGroup

**Audio (4)**
- AudioPlayer, Waveform, Dropzone, ProgressSection

**Task (2)**
- TaskModal, TaskIndicator

**Cards (4)**
- VoiceCard, HistoryCard, FeatureCard, ExampleCard

**Pages (8)**
- Landing, Clone, Design, Generate, Voices, History, About, NotFound

**Shared (5)**
- LanguageSelect, EmptyState, LoadingGrid, Spinner, Icons

---

## Appendix C: Hooks Inventory

| Hook | Purpose |
|------|---------|
| `useTask` | Access TaskContext |
| `useTaskPolling` | Poll backend for task status |
| `useWaveform` | WaveSurfer integration |
| `useElapsedTime` | Timer for progress display |
| `useVoices` | TanStack Query wrapper for voices |
| `useGenerations` | TanStack Query wrapper for generations |
| `useLocalStorage` | Sync state to localStorage |

---

## Appendix D: Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Foundation | 3 days | 3 days |
| Static Pages | 3 days | 6 days |
| Core Features | 7 days | 13 days |
| Polish & Testing | 5 days | 18 days |
| Deployment | 2 days | 20 days |

**Total: ~4 weeks** (assuming 1 developer, full-time)

---

*Document prepared: 2026-02-02*
*Last updated: 2026-02-02*
