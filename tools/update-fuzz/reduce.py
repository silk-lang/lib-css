#!/usr/bin/env python3
"""Shrinks a kept update request while a predicate holds.

usage: reduce.py <in.updates.json> <out.json> --bad BIN [--good BIN]

Holds when, under BIN `bad`, the retained (in place) output differs from a fresh one with both
exiting 0, and (with --good) under `good` they are equal. Destroy ops are turned into removes
first when that keeps it holding, so node ids stay sequential and nodes can be renumbered.
"""
import json, subprocess, sys, copy

def run(cli, doc):
    p = subprocess.run([cli], input=json.dumps(doc).encode(), capture_output=True)
    return json.loads(p.stdout) if p.returncode == 0 else None

def variant(doc, retain):
    d = copy.deepcopy(doc)
    if retain != "in-place":
        d["updates"]["retain"] = retain
    return d

args = sys.argv[1:]
src, dst = args[0], args[1]
bad = args[args.index("--bad") + 1]
good = args[args.index("--good") + 1] if "--good" in args else None

CRASH = "--crash" in args
def holds(doc):
    if CRASH:
        try:
            p = subprocess.run([bad], input=json.dumps(variant(doc, "in-place")).encode(), capture_output=True)
            return p.returncode != 0 and b"fatal trap" in p.stderr and run(bad, variant(doc, "fresh")) is not None
        except Exception:
            return False
    try:
        k = run(bad, variant(doc, "in-place")); f = run(bad, variant(doc, "fresh"))
        if k is None or f is None or k == f:
            return False
        if good:
            k2 = run(good, variant(doc, "in-place")); f2 = run(good, variant(doc, "fresh"))
            if k2 is None or k2 != f2:
                return False
        return True
    except Exception:
        return False

# Symbolic form: nodes by label; ops refer to labels.
def to_symbolic(doc):
    n = len(doc["nodes"])
    nodes = [dict(x, label=("n", i)) for i, x in enumerate(doc["nodes"])]
    for x in nodes:
        if x.get("parent") is not None:
            x["parent"] = ("n", x["parent"])
    ids = [("n", i) for i in range(n)]
    steps = copy.deepcopy(doc["updates"]["cycle"][: doc["updates"]["iterations"]])
    for s, step in enumerate(steps):
        for o, op in enumerate(step.get("ops", [])):
            for key in ("node", "parent", "before"):
                if op.get(key) is not None:
                    op[key] = ids[op[key]]
            if op["op"] == "insert":
                op["label"] = ("i", s, o)
                ids.append(op["label"])
        for ch in step.get("set", []):
            ch["node"] = ids[ch["node"]]
    rest = {k: v for k, v in doc.items() if k not in ("nodes", "updates")}
    upd = {k: v for k, v in doc["updates"].items() if k not in ("cycle", "iterations")}
    return {"rest": rest, "upd": upd, "nodes": nodes, "steps": steps}

def to_doc(sym):
    order = [x["label"] for x in sym["nodes"]]
    for step in sym["steps"]:
        for op in step.get("ops", []):
            if op["op"] == "insert":
                order.append(op["label"])
    ids = {l: i for i, l in enumerate(order)}
    nodes = []
    for x in sym["nodes"]:
        y = {k: v for k, v in x.items() if k != "label"}
        if y.get("parent") is not None:
            y["parent"] = ids[y["parent"]]
        nodes.append(y)
    cycle = []
    for step in sym["steps"]:
        st = {}
        if "ops" in step:
            ops = []
            for op in step["ops"]:
                y = {k: v for k, v in op.items() if k != "label"}
                for key in ("node", "parent", "before"):
                    if y.get(key) is not None:
                        y[key] = ids[y[key]]
                ops.append(y)
            st["ops"] = ops
        if "set" in step:
            st["set"] = [dict(c, node=ids[c["node"]]) for c in step["set"]]
        for k, v in step.items():
            if k not in ("ops", "set"):
                st[k] = v
        cycle.append(st)
    doc = dict(sym["rest"])
    doc["nodes"] = nodes
    doc["updates"] = dict(sym["upd"], iterations=len(cycle), cycle=cycle)
    return doc

def without_labels(sym, dead):
    """Drops nodes with labels in `dead`, their initial descendants, and every op or set naming them."""
    dead = set(dead)
    changed = True
    while changed:
        changed = False
        for x in sym["nodes"]:
            if x["label"] not in dead and x.get("parent") in dead:
                dead.add(x["label"]); changed = True
        for step in sym["steps"]:
            for op in step.get("ops", []):
                if op["op"] == "insert" and op["label"] not in dead and op.get("parent") in dead:
                    dead.add(op["label"]); changed = True
    s = copy.deepcopy(sym)
    s["nodes"] = [x for x in s["nodes"] if x["label"] not in dead]
    if not s["nodes"] or s["nodes"][0]["label"] != ("n", 0):
        return None
    for step in s["steps"]:
        if "ops" in step:
            ops = []
            for op in step["ops"]:
                if op.get("label") in dead or op.get("node") in dead or op.get("parent") in dead:
                    continue
                if op.get("before") in dead:
                    op["before"] = None
                ops.append(op)
            step["ops"] = ops
        if "set" in step:
            step["set"] = [c for c in step["set"] if c["node"] not in dead]
    return s

def check(sym):
    if sym is None:
        return False
    try:
        return holds(to_doc(sym))
    except (KeyError, IndexError):
        return False

doc = json.load(open(src))
# Cut to the first failing step count.
for steps in range(1, doc["updates"]["iterations"] + 1):
    d = copy.deepcopy(doc); d["updates"]["iterations"] = steps
    if holds(d):
        doc = d; break
else:
    sys.exit("predicate does not hold")
# Inline the cycle so steps can be edited one by one.
doc["updates"]["cycle"] = [copy.deepcopy(doc["updates"]["cycle"][i % len(doc["updates"]["cycle"])]) for i in range(doc["updates"]["iterations"])]
# Destroys to removes.
d = copy.deepcopy(doc)
for step in d["updates"]["cycle"]:
    for op in step.get("ops", []):
        if op["op"] == "destroy":
            op["op"] = "remove"
if holds(d):
    doc = d
if any(op["op"] == "destroy" for st in doc["updates"]["cycle"] for op in st.get("ops", [])):
    print("note: destroy ops kept; node removal disabled", file=sys.stderr)
    nodes_ok = False
else:
    nodes_ok = True
sym = to_symbolic(doc)
assert holds(to_doc(sym))

def save(s):
    json.dump(to_doc(s), open(dst, "w"), indent=1)

progress = True
while progress:
    progress = False
    # Steps.
    i = 0
    while len(sym["steps"]) > 1 and i < len(sym["steps"]):
        s = copy.deepcopy(sym); del s["steps"][i]
        # A dropped step's inserts are gone: drop what names them.
        dead = [op["label"] for op in sym["steps"][i].get("ops", []) if op["op"] == "insert"]
        s = without_labels(s, dead) if dead else s
        if check(s):
            sym = s; progress = True; save(sym); print("step", len(sym["steps"]), file=sys.stderr)
        else:
            i += 1
    # Ops and sets.
    for si in range(len(sym["steps"])):
        for key in ("ops", "set"):
            j = 0
            while si < len(sym["steps"]) and j < len(sym["steps"][si].get(key, [])):
                s = copy.deepcopy(sym)
                item = s["steps"][si][key].pop(j)
                if key == "ops" and item["op"] == "insert":
                    s = without_labels(s, [item["label"]])
                if check(s):
                    sym = s; progress = True; save(sym); print(key, file=sys.stderr)
                else:
                    j += 1
    # Nodes, from the end, whole subtrees.
    if nodes_ok:
        i = len(sym["nodes"]) - 1
        while i >= 1:
            if i >= len(sym["nodes"]):
                i = len(sym["nodes"]) - 1; continue
            s = without_labels(sym, [sym["nodes"][i]["label"]])
            if check(s):
                sym = s; progress = True; save(sym); print("nodes", len(sym["nodes"]), file=sys.stderr)
            i -= 1
    # Style properties, of nodes and of inserts and sets.
    def styles(s):
        for x in s["nodes"]:
            if "style" in x: yield x["style"]
        for step in s["steps"]:
            for op in step.get("ops", []):
                if "style" in op: yield op["style"]
            for c in step.get("set", []):
                if "style" in c: yield c["style"]
    count = sum(1 for _ in styles(sym))
    for k in range(count):
        keys = list(list(styles(sym))[k].keys())
        for key in keys:
            s = copy.deepcopy(sym)
            st = list(styles(s))[k]
            if key not in st: continue
            del st[key]
            if check(s):
                sym = s; progress = True; save(sym)
    # Texts shorter.
    for x in sym["nodes"]:
        pass
save(sym)
d = to_doc(sym)
print(json.dumps({"nodes": len(d["nodes"]), "steps": len(d["updates"]["cycle"]), "ops": sum(len(st.get("ops", [])) for st in d["updates"]["cycle"])}))
