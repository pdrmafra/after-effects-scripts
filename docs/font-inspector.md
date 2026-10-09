# Font Inspector

Open a composition, or select a comp in the Project panel, then run `Font-Inspector.jsx`.

The script scans text layers in that comp and its nested comps. It reports each Source Text keyframe; for unkeyed text it reads the current evaluated value. Where AE exposes `characterRange()`, mixed-font text is inspected per character and grouped into font runs. Font names use PostScript identifiers.

Select an occurrence and choose **Reveal Layer**, or double-click it, to open the corresponding comp, select the layer and move to the sampled time. Inspection itself does not change text or fonts. Reveal changes viewer/timeline selection, not design data.

**Full Report…** opens selectable text. Click it and use Cmd/Ctrl+A, then Cmd/Ctrl+C. **Save Report…** writes only to a file you explicitly choose. Saving may require AE's “Allow Scripts to Write Files and Access Network” preference; the script does not access the network or invoke an external clipboard command.

## Scope

- On AE versions without character ranges, only the TextDocument font (usually the first character) can be reported. The report flags this fallback.
- Expression-driven changes over time and font-changing text animators are not exhaustively sampled. Source Text expressions and failed character ranges produce warnings.
- This is an inventory, not a missing-font detector, font replacement tool or packaging utility. No font files are copied.
- Reused precomps may appear once per occurrence path. Circular references are detected and skipped.
- Character ranges are UTF-16 offsets with an exclusive end, not user-perceived character counts.
- Reports can contain text snippets, comp names and layer names. Do not share confidential client copy accidentally.
