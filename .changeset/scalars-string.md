---
'@nxgt/graphql-scalars': minor
---

`Emoji`, in the `string` category: exactly one emoji, as one user-perceived character. Skin tones, ZWJ sequences, flags and keycaps all count as one (`👍🏽`, `👨‍👩‍👧`, `🇫🇷`, `1️⃣`). Two emoji side by side, text around one, a lone joiner or skin tone, or more than 32 code points is refused. It needs `Intl.Segmenter` (Firefox 125, Safari 14.1), built on first use, so a runtime without it fails `Emoji` alone.
