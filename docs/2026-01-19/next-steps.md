# Next Development Steps

> Features to work on in upcoming sessions

---

## Priority 1: UX Polish

- [ ] Add favicon (404 currently)
- [ ] Add loading spinner during generation
- [ ] Better error messages from Modal
- [ ] Add audio waveform visualization

---

## Priority 2: Voice Management

- [ ] Voice list page (view all cloned voices)
- [ ] Delete voice functionality
- [ ] Voice preview playback (play reference audio)

---

## Priority 3: Power Features

- [ ] Generation history (list past generations)
- [ ] Longer text support (chunking for >30s)
- [ ] Voice settings (cfg_scale sliders for control)

---

## Quick Wins

| Win | Effort | Impact |
|-----|--------|--------|
| Favicon | 5 min | No more 404 spam |
| Loading spinner | 15 min | Better UX during wait |
| Voice list page | 1 hr | See all voices |
| Delete voice | 30 min | Cleanup |
| Waveform viz | 2 hr | Looks cool |

---

## Known Issues

1. **Cold start latency** - First gen takes 30-60s
2. **Large WAV files** - ~2MB for 30s (could convert to MP3)
3. **No favicon** - 404 in logs
4. **Fixed rng_seed=0** - Could randomize for variation
