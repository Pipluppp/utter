# Echo-TTS Performance Optimization Research

> Analysis of potential speed improvements for chunked audio generation, **grounded in official Echo-TTS documentation**.

## Current Performance Baseline

| Metric | Value |
|--------|-------|
| Text | ~150 words (2 chunks) |
| Audio output | ~48 seconds |
| Wall-clock time | ~12 seconds (2 × 6s) |
| Realtime factor | **4× faster than playback** |

---

## Sources

All claims below are cited from:
- **[Blog]** [Echo Blog Post](https://jordandarefsky.com/blog/2025/echo/)
- **[Repo]** [Echo-TTS GitHub README](https://github.com/jordandare/echo-tts)

---

## Optimization 1: Reduce Diffusion Steps

### Claim: 30 steps works well

**[Blog - Sampling]:**
> "Number of steps (30 generally works well)"

**[Repo - Tips]:**
> "Steps: Default `40`. Range `20` (fast) to `80` (high quality)."

### Recommendation

| Setting | Value | Expected Gain |
|---------|-------|---------------|
| Current | `num_steps=40` | Baseline |
| Recommended | `num_steps=30` | ~1.3× faster |
| Aggressive | `num_steps=25` | ~1.6× faster (test quality) |

---

## Optimization 2: Use Faster CFG Mode

### Claim: Alternative CFG modes use fewer evaluations

**[Blog - Sampling]:**
> "Joint unconditional (2× NFE) ... Independent guidance (3× NFE) ... Alternating guidance (2× NFE)"

**[Blog - Sampling]:**
> "In our experience, the 'Independent guidance' CFG option works well and has the benefit of decoupling the text and speaker guidance scales (though alternating guidance also decouples, and even joint unconditional CFG seems to work well in many cases)."

### Recommendation

| CFG Mode | NFE | Speed vs Baseline |
|----------|-----|-------------------|
| Independent (current) | 3× | 1.0× |
| **Alternating** | 2× | ~1.33× faster |
| Joint Unconditional | 2× | ~1.33× faster |

---

## Optimization 3: Shorter Sequence Length

### Claim: Model always processes full 640 latents

**[Blog - Block-wise diffusion]:**
> "It always will generate (zero-padded) 30-second chunks, even when the user anticipates the content will be much shorter (this still will generate proper-length content but spends more compute than necessary; consider time-to-first-byte (TTFB))."

**[Repo - Generation Length]:**
> "If 'Sample Latent Length' (in Custom Shapes in gradio)/sequence_length is set to less than 640, the model will attempt to generate the prefix corresponding to that length."

### Implication

Shorter `sequence_length` can reduce compute per chunk, but requires matching text length.

---

## Optimization 4: Blockwise Generation (Experimental)

### Claim: Blockwise enables streaming but is not stable

**[Repo - Blockwise Generation]:**
> "inference_blockwise.py includes blockwise sampling, which allows generating audio in smaller blocks as well as producing continuations of existing audio (where the prefix and continuation are up to 30 seconds combined)."

**[Repo - Blockwise Generation]:**
> "Blockwise functionality hasn't been thoroughly tested and may benefit from different (e.g., smaller) CFG scales."

**[Blog - Block-wise diffusion]:**
> "It is unlikely that we will include the block-wise fine-tuned weights in our initial release."

### Status

⚠️ **Not recommended for production** - experimental, may need different CFG scales.

---

## Optimization 5: Parallel Generation (Modal-Specific)

> [!NOTE]
> This optimization is specific to Modal.com infrastructure, not from Echo-TTS documentation.

### Options

1. **Multiple containers**: Spin up 2+ workers, generate chunks in parallel
   - Cost: ~2× GPU cost
   - Risk: None
   
2. **Concurrent inputs**: `allow_concurrent_inputs=2` on single A10G
   - Cost: Same
   - Risk: May OOM (A10G has 24GB, model uses 16-24GB)

---

## VRAM Constraints

**[Repo - Low VRAM]:**
> "FISH_AE_DTYPE = torch.bfloat16 # instead of float32
> DEFAULT_SAMPLE_LATENT_LENGTH = 576 # (< 640 depending on what fits)"

**[Local docs - echo-tts-model.md]:**
> "8GB: BF16 + reduced latents (576) → ~27 seconds"
> "16GB: Default settings → 30 seconds"
> "24GB+: Comfortable headroom → 30 seconds"

---

## Recommended Implementation Order

### Phase 1: Free Speed (No Quality Loss)

| Change | Location | Effort | Gain |
|--------|----------|--------|------|
| `num_steps=30` | `modal_app/echo_tts.py` | 1 line | ~1.3× |

### Phase 2: Test Quality Trade-offs

| Change | Location | Effort | Gain |
|--------|----------|--------|------|
| `num_steps=25` | `modal_app/echo_tts.py` | 1 line | ~1.6× |
| Alternating CFG | `modal_app/echo_tts.py` | Medium | ~1.3× |

### Phase 3: Infrastructure (Cost Increase)

| Change | Effort | Gain | Cost |
|--------|--------|------|------|
| Parallel Modal workers | Medium | ~2× | ~2× |

---

## References

1. [Echo Blog Post - Sampling](https://jordandarefsky.com/blog/2025/echo/)
2. [Echo-TTS GitHub README](https://github.com/jordandare/echo-tts)
3. [Local: echo-tts-model.md](../echo-tts-model.md)
