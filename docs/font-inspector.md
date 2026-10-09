# Font Inspector

Lists every font used in a comp and in all of its precomps, and takes you to each layer that uses it. It only reads your project; it never changes text or fonts.

## How to use

1. Open a comp, or select one in the Project panel.
2. Run **`Font-Inspector.jsx`**.
3. In the list, select an entry and click **Reveal Layer** (or double-click it). The comp opens at that moment with the layer selected.
4. **Full Report…** shows everything as text: click the text, then Cmd/Ctrl+A and Cmd/Ctrl+C to copy. In that window, **Save Report…** writes a `.txt` file where you choose.

Saving may need **Allow Scripts to Write Files and Access Network** (Settings or Preferences → Scripting & Expressions). The script never goes online.

## What it reads

- Every Source Text keyframe, or the current text when it is not animated.
- Text with several fonts is checked letter by letter and grouped into runs (where your AE version allows it).
- Fonts are listed by their PostScript names.

## Good to know

- Reports contain text snippets, comp names and layer names. Check before sharing, especially with client copy.
- Fonts changed by expressions over time or by text animators are not fully sampled; the report warns when Source Text has an expression or a letter could not be read.
- On AE versions without per-letter access, only the main font of each text (usually its first letter) is reported, and the report says so.
- A precomp used several times appears once per place it is used. Precomps that contain each other in a loop are detected and skipped.
- Letter positions in the report count UTF-16 units, end not included; emoji and some accented letters can count as two.
- This is an inventory, not a missing-font fixer or packaging tool. No font files are copied.
