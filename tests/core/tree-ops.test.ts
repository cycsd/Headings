import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { allIds, collapseOthers, collapseSubtree, DROP_PLACEHOLDER_ID, expandPath, expandSubtree, filterTree, findNode, maxDepth, nodeAtOffset, pathTo, stepDepth, withDepth, withDropPlaceholder, followingSiblings, insertNodeAt, makeNewNode, NEW_NODE_ID } from "../../src/core/tree-ops";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: "heading",
    level: 1,
    title: id,
    range: { from: 0, to: 0 },
    sections: [],
    links: [],
    children,
});

// root
//   ├─ A
//   │   ├─ A1
//   │   │   └─ A1a
//   │   └─ A2
//   └─ B
//       └─ B1
const tree = (): TreeNode => node("root", [node("A", [node("A1", [node("A1a")]), node("A2")]), node("B", [node("B1")])]);

describe("findNode / pathTo / maxDepth", () => {
    it("找得到節點與路徑，找不到回傳 null / 空陣列", () => {
        expect(findNode(tree(), "A1a")?.id).toBe("A1a");
        expect(findNode(tree(), "nope")).toBeNull();
        expect(pathTo(tree(), "A1a").map((n) => n.id)).toEqual(["root", "A", "A1", "A1a"]);
        expect(pathTo(tree(), "nope")).toEqual([]);
    });

    it("root 為第 0 層", () => {
        expect(maxDepth(tree())).toBe(3);
        expect(maxDepth(node("solo"))).toBe(0);
    });
});

describe("withDepth", () => {
    it("depth 1 只留 root 展開", () => {
        expect([...withDepth(tree(), 1, new Set())].sort()).toEqual(["A", "A1", "B"]);
    });

    it("depth 2 收合第 2 層以下有子節點的", () => {
        expect([...withDepth(tree(), 2, new Set())]).toEqual(["A1"]);
    });

    it("depth 0 全部展開，並清掉子樹內原有的收合", () => {
        expect(withDepth(tree(), 0, new Set(["A", "B"])).size).toBe(0);
    });

    it("只動子樹內的節點，子樹外的收合保留", () => {
        const root = tree();
        const next = withDepth(findNode(root, "A")!, 1, new Set(["B"]));
        expect([...next].sort()).toEqual(["A1", "B"]);
    });
});

describe("collapseOthers", () => {
    it("路徑上展開、其他有子節點的收合", () => {
        const next = collapseOthers(tree(), "A1", new Set(["A", "A1"]));
        // A 是祖先、A1 是目標 → 展開；B 在路徑外 → 收合；A1a 是葉節點不用收
        expect([...next].sort()).toEqual(["B"]);
    });

    it("目標的後代也收合，只看到目標的直接子節點", () => {
        expect([...collapseOthers(tree(), "A", new Set())].sort()).toEqual(["A1", "B"]);
    });

    it("點 root 等於收合到第 1 層", () => {
        expect([...collapseOthers(tree(), "root", new Set())].sort()).toEqual(["A", "A1", "B"]);
    });

    it("目標不存在時原樣回傳", () => {
        expect([...collapseOthers(tree(), "nope", new Set(["A"]))]).toEqual(["A"]);
    });
});

describe("expandSubtree / collapseSubtree", () => {
    it("展開目標與後代，不碰其他", () => {
        const root = tree();
        const next = expandSubtree(findNode(root, "A")!, new Set(["A", "A1", "B"]));
        expect([...next]).toEqual(["B"]);
    });

    it("收合目標與有子節點的後代", () => {
        const root = tree();
        expect([...collapseSubtree(findNode(root, "A")!, new Set())].sort()).toEqual(["A", "A1"]);
    });
});

describe("stepDepth", () => {
    it("往上到最大深度即為全部", () => {
        expect(stepDepth(1, 1, 3)).toBe(2);
        expect(stepDepth(2, 1, 3)).toBe(0);
        expect(stepDepth(0, 1, 3)).toBe(0);
    });

    it("往下最少到 1，從全部往下是最大深度減 1", () => {
        expect(stepDepth(0, -1, 3)).toBe(2);
        expect(stepDepth(2, -1, 3)).toBe(1);
        expect(stepDepth(1, -1, 3)).toBe(1);
    });

    it("樹只有一層時永遠是全部", () => {
        expect(stepDepth(0, -1, 1)).toBe(0);
        expect(stepDepth(0, 1, 0)).toBe(0);
    });
});

describe("expandPath", () => {
    it("祖先全部展開，目標自己與其他節點不變", () => {
        const next = expandPath(tree(), "A1a", new Set(["A", "A1", "B"]));
        expect([...next]).toEqual(["B"]);
        const keep = expandPath(tree(), "A1", new Set(["A1", "B"]));
        expect([...keep].sort()).toEqual(["A1", "B"]);
    });

    it("目標不存在時原樣回傳", () => {
        expect([...expandPath(tree(), "nope", new Set(["A"]))]).toEqual(["A"]);
    });
});

describe("withDropPlaceholder", () => {
    it("在目標 children 最後加佔位節點，路徑外的節點共用同一個物件", () => {
        const root = tree();
        const preview = withDropPlaceholder(root, "A1");
        const a = preview.children[0]!;
        const a1 = a.children[0]!;
        expect(a1.children.map((n) => n.id)).toEqual(["A1a", DROP_PLACEHOLDER_ID]);
        expect(root.children[0]!.children[0]!.children.length).toBe(1);
        expect(preview.children[1]).toBe(root.children[1]);
        expect(withDropPlaceholder(root, "nope")).toBe(root);
    });

    it("before / after 把佔位插在目標父節點 children 裡目標的前 / 後；root 不能插前後", () => {
        const root = tree();
        const before = withDropPlaceholder(root, "A2", "before");
        expect(before.children[0]!.children.map((n) => n.id)).toEqual(["A1", DROP_PLACEHOLDER_ID, "A2"]);
        const after = withDropPlaceholder(root, "A", "after");
        expect(after.children.map((n) => n.id)).toEqual(["A", DROP_PLACEHOLDER_ID, "B"]);
        expect(after.children[0]).toBe(root.children[0]);
        expect(withDropPlaceholder(root, "root", "before")).toBe(root);
    });
});

describe("nodeAtOffset", () => {
    const ranged = (id: string, from: number, to: number, children: TreeNode[] = []): TreeNode => ({ ...node(id, children), range: { from, to } });
    // root
    //   ├─ A 標題 10-20，內容區的段落 20-40
    //   │   └─ A1 50-60
    //   └─ B 70-80
    const tree = (): TreeNode => {
        const a = ranged("A", 10, 20, [ranged("A1", 50, 60)]);
        a.sections = [{ kind: "section", id: "A-p", type: "paragraph", range: { from: 20, to: 40 }, children: [] }];
        return ranged("root", 0, 0, [a, ranged("B", 70, 80)]);
    };

    it("標題行、內容區與子節點都找得到，子節點優先", () => {
        expect(nodeAtOffset(tree(), 10)?.id).toBe("A");
        expect(nodeAtOffset(tree(), 30)?.id).toBe("A");
        expect(nodeAtOffset(tree(), 55)?.id).toBe("A1");
        expect(nodeAtOffset(tree(), 70)?.id).toBe("B");
    });

    it("不在任何節點範圍內回傳 null；區間右端不算，只有 root 的空區間例外", () => {
        expect(nodeAtOffset(tree(), 45)).toBeNull();
        expect(nodeAtOffset(tree(), 80)).toBeNull();
        expect(nodeAtOffset(tree(), 0)?.id).toBe("root");
    });
});

describe("allIds / filterTree", () => {
    it("allIds 含 root 與所有後代", () => {
        expect([...allIds(tree())].sort()).toEqual(["A", "A1", "A1a", "A2", "B", "B1", "root"]);
    });

    it("只留命中與祖先，hits 依前序；沒命中的子樹整個拿掉", () => {
        const root = tree();
        const { tree: filtered, hits } = filterTree(root, (node) => node.id === "A1a" || node.id === "B1");
        expect(hits).toEqual(["A1a", "B1"]);
        expect(filtered.children.map((n) => n.id)).toEqual(["A", "B"]);
        expect(filtered.children[0]!.children.map((n) => n.id)).toEqual(["A1"]);
        expect(filtered.children[0]!.children[0]!.children.map((n) => n.id)).toEqual(["A1a"]);
        // B 整棵沒變（B1 命中、沒有別的子節點被拿掉），沿用原物件；A 底下少了 A2，是新物件
        expect(filtered.children[1]).toBe(root.children[1]);
        expect(filtered.children[0]).not.toBe(root.children[0]);
    });

    it("全部沒命中只剩 root；root 自己不算命中", () => {
        const { tree: filtered, hits } = filterTree(tree(), (node) => node.id === "root");
        expect(hits).toEqual([]);
        expect(filtered.id).toBe("root");
        expect(filtered.children).toEqual([]);
    });

    it("全部命中時回傳同一棵樹", () => {
        const root = tree();
        expect(filterTree(root, () => true).tree).toBe(root);
    });
});

describe("followingSiblings", () => {
    const item = (id: string): TreeNode => ({ ...node(id), kind: "listItem", title: null });

    it("只取同一份清單（id 去掉最後一段的前綴相同）、連續相鄰、排在後面的兄弟，遇到別份清單就停", () => {
        const root = node("root", [item("H:list:0:0"), item("H:list:0:1"), item("H:list:0:2"), item("H:list:1:0"), item("H:list:1:1")]);
        expect(followingSiblings(root, "H:list:0:0").map((n) => n.id)).toEqual(["H:list:0:1", "H:list:0:2"]);
        expect(followingSiblings(root, "H:list:0:2")).toEqual([]);
        expect(followingSiblings(root, "H:list:1:0").map((n) => n.id)).toEqual(["H:list:1:1"]);
        expect(followingSiblings(root, "root")).toEqual([]);
    });
});

describe("insertNodeAt / makeNewNode", () => {
    it("after 放在目標後面、into 放在目標 children 最後，原樹不變", () => {
        const root = tree();
        const virtual = makeNewNode(findNode(root, "A")!, "after", "## ");
        expect(insertNodeAt(root, "A", "after", virtual).children.map((n) => n.id)).toEqual(["A", NEW_NODE_ID, "B"]);
        expect(insertNodeAt(root, "A", "into", virtual).children[0]!.children.map((n) => n.id)).toEqual(["A1", "A2", NEW_NODE_ID]);
        expect(root.children.map((n) => n.id)).toEqual(["A", "B"]);
        expect(insertNodeAt(root, "nope", "after", virtual)).toBe(root);
    });

    it("虛擬節點的種類：標題同層 / 加一層（最多 6）、清單項、段落", () => {
        const heading = { ...node("H"), level: 2 };
        expect(makeNewNode(heading, "after", "## ")).toMatchObject({ kind: "heading", level: 2, title: "" });
        expect(makeNewNode(heading, "into", "### ")).toMatchObject({ kind: "heading", level: 3 });
        expect(makeNewNode({ ...heading, level: 6 }, "into", "")).toMatchObject({ level: 6 });
        expect(makeNewNode({ ...node("root"), kind: "root", level: 0 }, "into", "# ")).toMatchObject({ kind: "heading", level: 1 });
        expect(makeNewNode({ ...node("L"), kind: "listItem" }, "after", "- ")).toMatchObject({ kind: "listItem", text: "- ", title: null });
        expect(makeNewNode({ ...node("S"), kind: "section" }, "after", "新段落")).toMatchObject({ kind: "section", sectionType: "paragraph" });
    });
});
