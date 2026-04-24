---
name: ascii-block-layout
description: Build and edit plain-text ASCII box diagrams in Markdown code fences. Use when the user asks for text-only boxed visuals, + | - style boxes, larger padding/width, horizontal or vertical alignment, with strict relationship constraints between boxes.
---

# ASCII Block Layout Skill

This skill standardizes text-only box mockups in Obsidian Markdown notes.
It is optimized for multi-constraint layouts where position relationships must remain stable across edits.

## When to use

Use this skill when the user asks for any of the following:

- "用文字呈現區塊效果"
- ASCII 方框、文字框、純文字 wireframe
- `+ | -` style boxes
- 調整框寬、內距、空白
- 讓多個框同一行對齊或上下排列
- 指定標籤位置（例如 HeadingA 在 HeadingB 上方）
- 指定某列文字水平對齊（例如 HeadingB 與 `Document Name` 對齊）
- 指定群組中心（例如「與 B 有關的區塊要在 B 附近」）
- 要求區塊間垂直 gap 一致

## Output rules

- Always use a fenced code block with `text` info string.
- Keep output in ASCII only.
- Use monospaced-safe characters: `+`, `-`, `|`, space.
- Preserve visual alignment by using fixed spacing.
- For side labels or tag blocks, default to `+ | -` style unless user asks for other styles.
- If alignment is requested, align by the content row (not only top/bottom border row).
- Do not merge multiple logical nodes into one box unless explicitly requested.

## Constraint-first workflow

Treat layout edits as a constraint-solving task, not visual tweaking.

### 1) Extract hard constraints first

Convert user intent into explicit constraints before editing:

- Column constraints: which node must stay in column 1/2/3.
- Vertical order constraints: e.g., A above B, C below B.
- Proximity constraints: e.g., B-related detail nodes must stay near B.
- Gap constraints: major node gaps must be uniform.
- Style constraints: all boxes use `+ | -`.

### 2) Define anchors

Set anchors and do not move them unless user asks:

- `primary-center`: the visual center node in the middle column.
- `primary-above` / `primary-below`: immediate neighbors of center node.
- `detail-near-primary`: detail boxes that must stay near center node.

### 3) Generate full block in one pass

Avoid step-by-step nudging. Rebuild the full ASCII block so all constraints are satisfied together.

### 4) Run post-edit checks

Validate before finalizing:

- Order check: above/center/below relationships are intact.
- Column check: each node remains in the expected column.
- Gap check: vertical gaps between major nodes are consistent.
- Proximity check: center-related details remain near center node, not drifting toward lower groups.
- Integrity check: no duplicate or broken box lines.

## Constraint priority

When constraints conflict, use this priority:

1. Latest explicit user instruction
2. Hard structure constraints (column + order)
3. Proximity constraints (near-center group)
4. Gap consistency
5. Existing visual shape

## Default box templates

### 1) Basic box

```text
+-------------------+
| Document Name     |
| yaml              |
+-------------------+
```

### 2) Main box + horizontal tags

```text
+-------------------+   +----------+   +----------+   +----------+
| Document Name     |   | HeadingA |   | HeadingB |   | HeadingC |
| yaml              |   +----------+   +----------+   +----------+
+-------------------+
```

### 3) Main box + vertical tags (center node aligned)

```text
                         +----------+
                         | HeadingA |
+-------------------+    +----------+
| Document Name     |    +----------+
| yaml              |    | HeadingB |
+-------------------+    +----------+
                         +----------+
                         | HeadingC |
                         +----------+
```

### 4) Three-column constrained layout (details near center)

```text
                                         +----------------+
                                         | paragraph_a1   |
                                         +----------------+
                        +------------+   +----------------+
                        | # HeadingA |   | ## Heading_A2  |
                        +------------+   +----------------+
+-------------------+   +------------+   +----------------+
| Document Name     |   | # HeadingB |   | #### Heading_B4|
| yaml              |   +------------+   +----------------+
+-------------------+   +------------+   +----------------+
                        | # HeadingC |   | ### Heding_B3  |
                        +------------+   +----------------+
                                         +----------------+
                                         | paragraph_C1   |
                                         +----------------+
```                                         
      

In this pattern:

- Center node is in column 2.
- Center-related detail nodes remain near center height in column 3.
- Lower group detail appears below the lower major node.

## Example-only mapping (for discussion)

Use concrete names when explaining a specific case, but keep rules generic.

Example names:

- Major nodes: `# HeadingA`, `# HeadingB`, `# HeadingC`
- Center-related details: `#### Heading_B4`, `### Heding_B3`
- Other details: `paragraph_a1`, `## Heading_A2`, `paragraph_C1`

Rules remain generic:

- major-above / major-center / major-below
- detail-near-center / detail-near-above / detail-near-below

## Common requested constraints

- 「只要縮小垂直 gap，不改左右關係」
- 「相關區塊要置中在某節點附近」
- 「第 3 欄要維持不變，但中心節點關聯內容不能往下漂」
- 「A/B/C 主節點間距要一致」

## Anti-patterns to avoid

- Fixing one node by drifting another group away.
- Solving by local patch only; always validate globally.
- Treating hard constraints as optional visual preferences.
- Leaving duplicated rows or half-broken boxes after edits.

## Common failure patterns and prevention rules

Use this section as generic QA guidance for any multi-column ASCII box layout.

### Pattern 1: Accidental shared borders

Symptoms:

- Two independent boxes appear visually fused because one border line is reused.

Prevention:

- Independent nodes must each have complete `top/content/bottom` rows.
- Reused borders are only valid when the user explicitly requests stacked/merged boxes.

### Pattern 2: Side-column fix breaks core proximity

Symptoms:

- Editing a side column (e.g., detail labels) unintentionally increases distance between core nodes.

Prevention:

- Protect core anchors first (`major-center`, `major-above`, `major-below`).
- Keep `detail-near-center` visually close to its paired major node unless a larger gap is requested.

### Pattern 3: Lower-group drift

Symptoms:

- Lower detail nodes drift too far below the lower major node after spacing changes.

Prevention:

- Re-check lower-group proximity after every layout edit.
- Keep `detail-near-below` attached to `major-below` by default.

## Mandatory validation checklist (generic)

1. Independence check: each independent box has full `top/content/bottom` rows.
2. Anchor check: `major-above/major-center/major-below` order and distance follow declared constraints.
3. Pairing check: each `detail-near-*` node stays near its target major node.
4. Gap policy check: inter-group spacing is consistent with the chosen policy (`minimal`, `uniform`, or user-defined).
5. Final integrity check: no accidental spacer rows, duplicate borders, or broken box lines.

If any check fails, regenerate the full diagram block in one pass instead of patching isolated rows.

## Generic template example (independent boxes + controlled gaps)

```text
                         +---------------+
                         | detail-above  |
                         +---------------+
      +-------------+    +---------------+    +---------------+
      | major-above |    | major-center  |    | detail-right1 |
      +-------------+    +---------------+    +---------------+

      +-------------+    +---------------+    +---------------+
      | major-below |    | detail-near-c |    | detail-right2 |
      +-------------+    +---------------+    +---------------+
                         +---------------+
                         | detail-below  |
                         +---------------+
```

---

## Multi-detail column template

Use this when one column contains multiple independent detail nodes that correspond to different major groups.

### Rules

- Each detail box is fully independent: 3 rows each (`top/content/bottom`), no shared borders.
- Each detail box aligns vertically with its paired major node (content row of the detail = content row of the major).
- Detail boxes that belong to different major groups must not touch each other — use `gap-between-groups` blank rows to separate them visually.

### Template

```text
      +-------------+    +---------------+    +---------------+
      | major-A     |    | detail-A-1    |    | detail-A-r1   |
      +-------------+    +---------------+    +---------------+
                         +---------------+    +---------------+
                         | detail-A-2    |    | detail-A-r2   |
                         +---------------+    +---------------+
<-- gap-between-groups: N blank rows -->
      +-------------+    +---------------+    +---------------+
      | major-B     |    | detail-B-1    |    | detail-B-r1   |
      +-------------+    +---------------+    +---------------+
                         +---------------+
                         | detail-B-2    |
                         +---------------+
```

### Placement rule per detail

```
detail-X-1  →  content row aligned with major-X content row
detail-X-2  →  starts immediately after detail-X-1 bottom border (no blank row within the same group)
```

---

## Uniform gap specification

When a gap policy is declared, use this as the contract for how many blank rows separate groups.

### Syntax

```
gap-between-groups = N   // N blank lines between the bottom border of one group and the top border of the next
gap-between-details = 0  // 0 blank lines within the same group's detail column (boxes are stacked immediately)
```

### Gap = 0 (minimal, boxes touch)

```text
      +-------------+    +---------------+
      | major-A     |    | detail-A      |
      +-------------+    +---------------+
      +-------------+    +---------------+
      | major-B     |    | detail-B      |
      +-------------+    +---------------+
```

### Gap = 1 (one blank row between groups)

```text
      +-------------+    +---------------+
      | major-A     |    | detail-A      |
      +-------------+    +---------------+

      +-------------+    +---------------+
      | major-B     |    | detail-B      |
      +-------------+    +---------------+
```

### Gap = 2 (two blank rows between groups)

```text
      +-------------+    +---------------+
      | major-A     |    | detail-A      |
      +-------------+    +---------------+


      +-------------+    +---------------+
      | major-B     |    | detail-B      |
      +-------------+    +---------------+
```

### Enforcement rules

- All group separators in the same diagram must use the same `gap-between-groups` value.
- A column that has no node at a given row must still respect the gap: leave blank space to match peer columns.
- If two columns require different local gaps (e.g., a detail column has more items than a major column), resolve by expanding both columns to the larger gap value.
