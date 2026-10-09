# Shape to Stroke: applicability map

The useful question is not the shape's name, but whether its filled boundary describes **one unambiguous, non-overlapping stroke of constant width**. There are infinitely many drawings; this map covers geometric families, not every possible outline. This version is a bounded recognizer, not a universal vector skeletonizer.

## Implemented families

| Filled artwork | Recovered trajectory | Conditions / examples |
| --- | --- | --- |
| Straight bar | Open two-point line, butt ends | Long rectangular region, including rotated bars and normalized straight Bezier handles. |
| Straight capsule | Open two-point line, round ends | Uniform width, opposite straight sides, semicircular end caps. |
| Circular ring | Closed circular path | Two concentric circular boundaries with an actual hole. |
| Circular arc strip | Open circular path, butt ends | Concentric inner/outer arcs and straight radial ends. |
| Round-ended circular arc | Open circular path, round ends | Two concentric arc boundaries and two matching semicircular end caps; no overlaps. |
| Polygon frame | Closed polygon, miter joins | Parallel corresponding sides with the same perpendicular separation; matching corner topology. Rectangles, squares, triangles, diamonds, regular/irregular convex polygons. |
| Concave polygon frame | Closed polygon, miter joins | Same offset conditions, plus simple nested contours and no crossings/contacts. Hollow stars and L-shaped frames work when their offsets do not collapse. |
| Rounded frame | Closed line/circular-arc path | Tangent-continuous corners, paired concentric arcs and equal straight-side separation. Rounded rectangles, rounded squares and capsule/racetrack frames. |
| Angular connector | Open polyline, butt ends and miter joins | One filled outline consisting of two corresponding parallel side chains and perpendicular ends. L/V/Z/U shapes and non-overlapping zigzags. |
| Scaled/rotated/mirrored variants | Same local trajectory, existing transforms retained | Static group/layer transforms are preserved through duplication. A circular ring scaled into an oval is supported; unrelated ellipse contours are a different case. |

Frames require exactly two closed Bezier contours and one solid fill in the same leaf group. One nested group chain is supported; independent branches are not flattened. Non-Zero fill requires opposite winding to create a hole; Even-Odd permits either winding. A contour with AE's Reverse Path Direction switched on is refused, because it changes which area is filled. Polygon correspondence is searched cyclically, so inner contour order/start need not match the outer start.

Straight offsets are checked analytically. Conventional circular cubic segments are fitted and sampled, not assumed mathematically exact circles. Sharp polygon joins use explicit miter settings sized for the recovered corners, with a conservative extension bound. Safe normalization removes zero-length edges, redundant collinear vertices and ordered straight cubic handles without modifying the source arrays. If the outer start was redundant, normalization may move the generated seam.

Frames and angular connectors also accept near-uniform thickness: the stroke width is the middle of the thinnest and thickest measurement (side ends, curved-corner radius differences and connector cap lengths), and the spread between them may be at most `max(0.005, min(2, width × 0.1))` local units. Each edge of the constant-width stroke therefore moves at most 0.5 local units from the original edge, or 2.5% of the width on thin artwork (about half a pixel at 100% scale; scaling the layer scales this on screen). The result is a constant-width approximation; compare source and replacement before discarding the original. Angular correspondence, concentric curved corners, perpendicular caps, topology and containment remain strict. Dedicated bar/capsule/ring/arc recognizers retain their previous tolerances.

## Plausible further adapters, not implemented

| Family | What another adapter would need |
| --- | --- |
| Beveled/round polygon joins | Match different inner/outer vertex counts and infer the join type rather than treating every extra vertex as a centerline corner. |
| Filleted/round-ended polylines | Separate side chains from corner arcs and caps, including unequal segment counts. Current angular connectors have sharp miter joins and butt ends. |
| General uniform-width Bezier ribbons | Fit and verify normal offsets, reparameterize unequal boundary subdivisions, control approximation error and reject self-overlapping regions. Midpoints alone are insufficient. |
| True stroke outlines around ellipses | Distinguish genuine normal offsets from two nested ellipses; the latter generally have varying width. |
| Linearly tapered strokes (future idea) | Use the stroke's Taper for artwork whose width changes evenly and symmetrically from one end to the other, starting with a straight wedge (symmetric trapezoid). Taper cannot reproduce side-by-side width differences or one-sided slants, so it is not a fix for near-uniform frames. Check first in AE whether Taper stays fixed or stretches while Trim Paths draws on (start taper measured in pixels may avoid stretching). |
| Native rectangle/ellipse/polygon operators in frames | Read direction/topology safely and adapt without altering the original. For now, convert those frame paths to Bezier before running the tool. |
| Multiple compatible shape groups on one layer | Handle each group's coordinate space and styles without merging independent objects or changing render order. |
| More import topology variations | Merge compatible circular subdivisions and classify bridge-cut holes/compound paths from real exporter fixtures. |

These are possible engineering extensions, not compatibility promises. They need independent fixtures and native render validation before acceptance.

## No general single-stroke replacement

| Artwork | Why automatic replacement is inappropriate |
| --- | --- |
| Solid square, triangle, polygon, disk or blob | An outline is not its centerline. Usually no unique trajectory with the same filled silhouette. |
| Variable-width ribbon, arrowhead or calligraphic lettering | A uniform stroke changes thickness and/or shape. |
| Branches, crossings, plus signs, networks or merged connectors | Multiple paths and overlapping joins are needed; order and topology may be ambiguous. |
| Multi-hole symbols or complex logos | A single path does not represent the object reliably. |
| Shadows, textured fills, gradients, effects or existing shape operators | Converting geometry alone does not preserve their appearance; the current host rejects them. |

For those families, a different **assisted reveal** workflow could retain the original artwork and animate a user-supplied trajectory as a matte. That is not centerline recovery and is not part of this tool's current UI.

## Practical use cases

Imported outline icons; geometric badges; hollow stars/triangles; UI borders and progress indicators; rings, racetrack indicators and circular gauges; diagrams, flowchart connectors and angular circuit/map lines. The artwork must still meet the geometric and host restrictions above. A tool recognizing a synthetic shape does not prove that every Figma/Illustrator export of that shape has compatible topology.
