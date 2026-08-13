# QoQ workflows — diagrams

**Human reference, not the spec.** Every rule these diagrams show is written out
in prose in `SKILL.md` and the command references, and the prose is what an agent
reads and what wins where the two ever disagree. These are here so a person can
see the shape of a command at a glance without reading it end to end — nothing
routes off them.

**They stay in sync in both directions, in the same change.** Editing a diagram
without editing the prose it maps to below is how this file turns into a
confident lie about a workflow that no longer exists — and prose edited without
the diagram is the same lie pointed the other way. The prose still wins on a
disagreement, so a change that starts here isn't finished until it's argued out
in the reference file too.

| Diagram                                     | Prose it reflects                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Entry and discovery](#entry-and-discovery) | [skill](../skills/qoq/SKILL.md), [discovery.md](../skills/qoq/references/discovery.md) |
| [`fix`](#fix)                               | [fix.md](../skills/qoq/references/fix.md)                                              |
| [`refactor`](#refactor)                     | [refactor.md](../skills/qoq/references/refactor.md)                                    |
| [`bump`](#bump)                             | [bump.md](../skills/qoq/references/bump.md)                                            |
| [`plan`](#plan)                             | [plan.md](../skills/qoq/references/plan.md)                                            |
| [`execute`](#execute)                       | [execute.md](../skills/qoq/references/execute.md)                                      |
| [`test`](#test)                             | [test.md](../skills/qoq/references/test.md)                                            |
| [`compress`](#compress)                     | [compress.md](../skills/qoq/references/compress.md)                                    |

**Legend, shared by all eight.** Purple = a subagent and everything it does.
Amber dashed = a command run directly. Cyan = the user. Red = a qoq command
invoked from inside another.

**One syntax trap worth knowing before you edit a node:** a label must not _start_
with a backtick. `X["` + backtick puts Mermaid into markdown-string mode, and
anything following the closing backtick is a lexer error — the whole diagram then
renders as nothing at all, with no hint as to which node did it. Backticks
anywhere else in a label are fine, so lead with a word: `X["run \`test:one\` on …"]`.

---

## Entry and discovery

```mermaid
flowchart TD
    Q["/qoq [command]"] --> ISC{"command =<br/>compress?"}
    ISC -->|"yes"| RCOMP["**qoq compress**<br/>*no discovery — no line of the<br/>record describes a markdown file*"]
    ISC -->|"no"| DISP

    DISP["dispatch **qoq-discovery**<br/>(Haiku, one per top-level run)<br/>caller passes the project root<br/>**+ the resolved skills: line**<br/>*the available-skills list is the<br/>caller's context, not the agent's*"]

    subgraph DISCO["qoq-discovery flow *(everything the agent does)*"]
        direction TB
        HAS{"record<br/>exists?"}
        HAS -->|yes| VER{"verify it<br/>still holds"}
        VER -->|valid| DONE["return record<br/>unchanged"]
        VER -->|stale| D0["re-derive the<br/>failed lines only"]
        HAS -->|no| D0

        D0 --> DOCS["**read the project's docs first** —<br/>CLAUDE.md / AGENTS.md / README.md.<br/>*a written answer outranks a guess*"]
        DOCS --> D1["**1. qoq installed?**<br/>@ladamczyk/qoq-cli + qoq.config.js<br/>→ **no = the run stops**,<br/>with the install command"]
        D1 --> D2["**2. the two lenses**<br/>*copy the dispatched skills: line<br/>verbatim — never search the<br/>filesystem for a lens; a plugin<br/>one is invisible there*"]
        D2 --> D3["**3. project commands?**<br/>test — full suite · test — single file · build<br/>*the project's own scripts —<br/>npx is qoq's alone*"]
        D3 --> D4["**4. test conventions?**<br/>runner · globals on or off ·<br/>React? · a testing-gate.md<br/>at the root"]
        D4 --> REC["write record →<br/>node_modules/@ladamczyk/qoq-cli/bin/<br/>qoq-skill-discovery.md<br/>(docs: ../AGENTS.md)"]

        BLOCK(["**agent stops**<br/>reports the open question,<br/>writes nothing"])
        D1 -.->|anything unclear| BLOCK
        D2 -.->|anything unclear| BLOCK
        D3 -.->|anything unclear| BLOCK
        D4 -.->|anything unclear| BLOCK
    end

    DISP --> HAS

    BLOCK -.-> ASK(["**caller ASKS THE USER**<br/>never assume a default"])
    ASK -.-> WRITE["**write the answer into the<br/>project's docs** — CLAUDE.md /<br/>AGENTS.md / README.md.<br/>*survives the next reinstall*"]
    WRITE -.-> DISP

    REC --> OPT
    DONE --> OPT

    OPT{"which<br/>command?"}
    OPT -->|"none given"| OASK(["**ASK THE USER**<br/>which command?"])
    OASK -.-> OPT
    OPT -->|fix| RFIX["**qoq fix**<br/>the check/fix loop"]
    OPT -->|refactor| RREF["**qoq refactor**<br/>green base, four assessments"]
    OPT -->|bump| RBUMP["**qoq bump**<br/>analyse, choose, apply"]
    OPT -->|plan| RPLAN["**qoq plan**<br/>requirements → approved plan file"]
    OPT -->|execute| REXEC["**qoq execute**<br/>approved plan file → delivered"]
    OPT -->|test| RTEST["**qoq test**<br/>coverage for code that exists"]

    RFIX --> NOTE
    RREF --> NOTE
    RBUMP --> NOTE
    RPLAN --> NOTE
    REXEC --> NOTE
    RTEST --> NOTE
    NOTE(["**end of run: notice to user**<br/>what discovery repaired,<br/>one line each"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef command fill:#f59e0b1a,stroke:#f59e0b,stroke-width:2px,stroke-dasharray:4 3
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px

    class DISCO agent
    class RFIX,RREF,RBUMP,RPLAN,REXEC,RTEST,RCOMP command
    class ASK,OASK,NOTE user
```

---

## `fix`

```mermaid
flowchart TD
    CHK["dispatch **qoq-checker**<br/>(Haiku, one instance)"]

    subgraph CHECKER["qoq-checker flow *(everything the agent does)*"]
        direction TB
        C0["**read the record** — `run:` and<br/>`docs:`. *first move, before<br/>it looks at anything else*"]
        C0 --> S{"run `reports-current.mjs<br/>&lt;report dir&gt; &lt;scope&gt;`<br/>exit 0 or 1?"}
        S -->|"1 — stale or missing"| RUN["the check: `&lt;run:&gt; --check --json`<br/>*--json is what writes the<br/>reports at all*"]
        S -->|"0 — current"| DIG
        RUN --> DIG["the digest: `node &lt;summarize path&gt;<br/>&lt;report dir&gt;` — both script<br/>paths and the report dir<br/>are handed in at dispatch"]
        DIG --> SUM["return the **digest**<br/>tool → rule → files<br/>(never the raw reports)"]
    end

    CHK --> C0
    SUM --> ANY{"findings?"}
    ANY -->|none| OUT(["**done**<br/>summarise every loop's fixes"])
    ANY -->|yes| FIX["fix the findings"]

    FIX --> VERT["verify **against the owning tool only**<br/>eslint finding → re-run eslint,<br/>not the whole suite"]
    VERT --> VT["then the **scoped** check —<br/>`test:one` on the touched files<br/>*(the ones that have tests)* + `build`"]
    VT -->|fails| VREV["revert that fix,<br/>carry it as unfixable"]
    VT -->|passes| PROG
    VREV --> PROG["**notify user**<br/>loop N: fixed X, N left"]
    PROG --> STUCK{"count went down?"}
    STUCK -->|no| OUT
    STUCK -->|yes| BUDGET{"3 loops<br/>since last ask?"}
    BUDGET -->|no| CHK
    BUDGET -->|yes| PERM(["**ASK THE USER**<br/>keep going?"])
    PERM -.->|"yes — counter resets"| CHK
    PERM -.->|no| OUT

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px

    class CHECKER agent
    class PERM,PROG user
```

### Where the scoped gate runs

```mermaid
flowchart TD
    G0["a command dispatches a writer<br/>*(qoq-developer, qoq-tester)*"]
    G0 --> G1["the agent writes, then proves it<br/>runs with the **project's own**<br/>`test:one` / `test` / `build`<br/>*— never the qoq CLI*"]
    G1 --> G2["hands back **the file list**"]
    G2 --> G3["**caller** dispatches<br/>**qoq fix** over that list"]
    G3 -->|FAIL| G4{"budget<br/>spent?"}
    G4 -->|"no — re-dispatch<br/>with the digest"| G1
    G4 -->|yes| G5(["**blocked** — bring the<br/>user the report"])
    G3 -->|PASS| G6(["gate passed —<br/>caller commits"])

    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px
    class G5 user
    class G3 skill
```

---

## `refactor`

```mermaid
flowchart TD
    SCOPE["**scope** = positional paths,<br/>else `qoq.config`'s `srcPath`"]
    SCOPE --> GB
    GB["dispatch **qoq fix** —<br/>establish a green base"]
    GB --> GBQ{"green?"}
    GBQ -->|no| GBSTOP(["**stop** — nothing to refactor<br/>against a red base"])
    GBQ -->|yes| SEQ

    SEQ["**one at a time, in order**<br/>1. JSCPD — honest read<br/>2. this project's own conventions<br/>3. ponytail<br/>4. design-pattern-review"]
    SEQ --> ASSESS["run assessment *N*"]
    ASSESS -.->|"3 and 4 only"| LENS["dispatch the lens skill —<br/>**ponytail-review** /<br/>**design-pattern-review**"]
    LENS -.-> AQ
    ASSESS --> AQ{"findings?"}
    AQ -->|none| NEXT
    AQ -->|yes| APPR(["**ASK THE USER**<br/>apply these?"])
    APPR -.->|no| NEXT
    APPR -.->|yes| APPLY["apply the fixes"]
    APPLY --> REGREEN["dispatch **qoq fix**<br/>re-green before the next one"]
    REGREEN --> NEXT{"assessments left?"}
    NEXT -->|yes| ASSESS
    NEXT -->|no| RDONE(["**done** — what each<br/>assessment changed"])

    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class APPR user
    class GB,REGREEN,LENS skill
```

---

## `bump`

```mermaid
flowchart TD
    CLEAN{"worktree<br/>clean?"}
    CLEAN -->|no| BSTOP(["**stop** — commit or<br/>stash first"])
    CLEAN -->|yes| PLAN["**impact analysis** — what's outdated,<br/>minor/patch grouped,<br/>**one major step per package**<br/>*(nothing written, no patches yet)*"]
    PLAN --> MAJ{"majors, or queued<br/>failures, among them?"}
    MAJ -->|yes| BUMPER["dispatch **qoq-bumper**<br/>(Sonnet, one per package)<br/>*(name, current version)*"]
    MAJ -->|no| BAPPR

    subgraph BUMPFLOW["qoq-bumper flow *(everything the agent does)*"]
        direction TB
        MB0{"a newer major<br/>than current?"}
        MB0 -->|yes| MB1
        MB0 -->|"no — already on the<br/>latest major line"| MBL["target = **latest stable**<br/>within it"]
        MBL --> MB1
        MB1["read the changelog / release notes /<br/>migration docs for **current → target**"]
        MB1 --> MB2["grep **this codebase** for the<br/>APIs that actually changed"]
        MB2 --> MB3["return: breaking changes that<br/>land here, migration steps, risk<br/>— *no edits*"]
    end

    BUMPER --> MB0
    MB3 --> BAPPR(["**ASK THE USER**<br/>here's the impact —<br/>**pick / exclude**, then approve"])

    BAPPR -.->|"nothing picked"| BSTOP
    BAPPR -.->|"the chosen set"| MAKE["**now** write the git patches —<br/>one per bump, selected only"]
    MAKE --> BAPPLY

    BAPPLY["apply next patch<br/>+ reinstall"]
    BAPPLY --> BVAL["**validate** — all three, in order<br/>`qoq fix` · `test` full suite · `build`<br/>*(commands from the record)*"]
    BVAL -->|passes| PREF["**qoq refactor --decisions auto**<br/>scope = this patch's files —<br/>*applies the safe tier,<br/>advises the rest*"]
    PREF -->|"changed nothing"| BMORE{"patches left?"}
    PREF -->|"changed something"| BREVAL["**re-validate** — test + build<br/>*(the refactor's own fix already ran)*"]
    BREVAL -->|passes| BMORE
    BREVAL -->|fails| BSPLIT
    BVAL -->|fails| BSPLIT{"can this patch<br/>split further?"}
    BSPLIT -->|"yes — grouped → **minor** / **patch**,<br/>then → **one per package**"| BRECUT["revert it,<br/>re-cut at the next level down"]
    BRECUT --> BAPPLY
    BSPLIT -->|"no — one package left"| BSEEN{"already been through<br/>**qoq-bumper**?"}
    BSEEN -->|no| BQ["revert it, **queue the package<br/>for qoq-bumper**<br/>*(next round)*"]
    BSEEN -->|yes| BREV["revert it, carry the package<br/>as unbumpable + why"]
    BQ --> BMORE
    BREV --> BMORE
    BMORE -->|yes| BAPPLY
    BMORE -->|no| BEHIND{"a major still behind,<br/>or a queued failure?"}
    BEHIND -->|"yes — re-plan,<br/>re-approve"| PLAN
    BEHIND -->|no| BDONE(["**done** — applied,<br/>reverted, skipped"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class BUMPFLOW agent
    class BAPPR user
    class PREF,BVAL skill
```

---

## `plan`

```mermaid
flowchart TD
    REQ["requirements — spec, PRD,<br/>or a rough description<br/>*(read the file itself, never a paraphrase)*"]
    REQ --> EXIST{"already a plan<br/>under ./plans/?"}
    EXIST -->|"yes — resume / execute"| EG2["hand to **qoq execute**<br/>*(not this command's job)*"]
    EXIST -->|no| SMALL{"one ticket's<br/>worth of work?"}
    SMALL -->|yes| PSTOP(["**stop** — no plan file.<br/>straight to the code —<br/>the gate alone is the bar"])
    SMALL -->|no| PEXP["dispatch **Explore**<br/>deps · existing patterns · test conventions<br/>*(paths only, no edits)*"]

    PEXP --> PSCOPE{"independent<br/>subsystems?"}
    PSCOPE -->|yes| PSPLIT(["**say so** — separate plans,<br/>one each. never one plan<br/>with both"])
    PSCOPE -->|no| PDEC["**decompose** — per ticket:<br/>size XS/S/M *(never bigger)*<br/>complexity → agent tier, nothing else<br/>Context that stands alone<br/>**criteria written as assertions**"]

    PDEC --> PXL{"a milestone<br/>coming out XL?"}
    PXL -->|yes| PSPLIT
    PXL -->|no| PREV["**self-review** — requirement coverage ·<br/>no placeholders · cross-ticket interfaces ·<br/>Depends on that's real ·<br/>**every criterion a spec can assert**"]

    PREV --> PSAVE["save → ./plans/YYYY-MM-DD-[feature].md"]
    PSAVE --> PAPPR(["**ASK THE USER** — approve.<br/>surfaced here: new deps<br/>and the model ceiling"])
    PAPPR -.->|"changes"| PDEC
    PAPPR -.->|"approved"| PMARK["**Plan status: approved**<br/>+ Commands header,<br/>copied from the record"]
    PMARK --> PHAND["offer **qoq execute** —<br/>run it on a yes,<br/>dispatch nothing from here"]

    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class PAPPR user
    class EG2,PHAND skill
```

---

## `execute`

```mermaid
flowchart TD
    EARG["plan path — ./plans/[file].md"]
    EARG --> ELOAD["**load the plan, fresh from disk**<br/>every time, resume or not"]
    ELOAD --> EDRAFT{"Plan status<br/>approved?"}
    EDRAFT -->|draft| EBACK["back to **qoq plan** —<br/>it was never signed off"]
    EDRAFT -->|approved| EPROG{"any ticket<br/>in-progress?"}
    EPROG -->|"yes — a dead run"| ERECON["reconcile against git log:<br/>committed → done,<br/>otherwise re-dispatch"]
    EPROG -->|no| EBRANCH
    ERECON --> EBRANCH{"on the default<br/>branch?"}
    EBRANCH -->|yes| EASK(["**ASK THE USER**<br/>branch first? plan/[name]"])
    EASK -.-> EWAVE
    EBRANCH -->|no| EWAVE

    EWAVE["**next ticket** — the first whose<br/>deps are all done, in plan order"]
    EWAVE --> EDISP["dispatch **one qoq-developer** —<br/>model = the ticket's tier,<br/>*(the plan already assigned it)*"]

    subgraph EDEV["qoq-developer flow — TDD *(everything the agent does)*"]
        direction TB
        T0["**read the record** — runner · globals ·<br/>React? · conventions file · commands ·<br/>how to invoke qoq. *first move*"]
        T0 --> T1["**red** — write plain assertions<br/>straight from the acceptance criteria,<br/>**in the project's dialect**"]
        T1 --> T2["**green** — implement the ticket<br/>until those assertions pass"]
        T2 --> TRAISE["**raise them to the bar itself** —<br/>test-conventions.md: mocking,<br/>the edge cases a first pass skips.<br/>*no dispatch — a subagent<br/>can't spawn one*"]
        TRAISE --> T4["**prove it runs** — the project's<br/>own `test:one` + `build`.<br/>*never the qoq CLI: the gate<br/>is the caller's move*"]
        T4 -->|"red"| T5{"3 attempts<br/>spent?"}
        T5 -->|no| T2
        T5 -->|"yes"| THAND(["**handoff report** —<br/>never narrow the ticket,<br/>never weaken the gate"])
        T4 -->|"green"| TRET["hand back: **every file changed**,<br/>what the specs cover, advisories"]
    end

    EDISP --> T0
    TRET --> EGATE["**qoq fix**, scoped to the<br/>files it returned"]
    EGATE -->|FAIL| T5
    EGATE -->|PASS| TCOM["commit exactly<br/>this ticket's files"]
    TCOM --> EDONE["**Status: done**<br/>+ commit hash, advisories"]
    THAND --> EESC{"a tier<br/>above?"}
    EESC -->|"yes — re-dispatch with<br/>the report pasted in"| EDISP
    EESC -->|"no — top rung already"| EBLOCK(["**Status: blocked** — bring the<br/>user the report: bad ticket,<br/>or session model too small"])
    EDONE --> EMORE{"tickets left in<br/>the milestone?"}
    EBLOCK --> EMORE
    EMORE -->|yes| EWAVE
    EMORE -->|no| EMGATE["**refactor** — the third TDD beat, delegated:<br/>**qoq refactor --decisions auto** over every<br/>file the milestone's tickets touched,<br/>then the full test suite + build"]
    EMGATE -->|red| ENEW["write the failure up as a new<br/>ticket — sized, rated, dispatched"]
    ENEW --> EWAVE
    EMGATE -->|green| EARCH["**archive** — milestone text to<br/>.completed.md, summary stays,<br/>downstream Context updated first"]
    EARCH --> EMS{"milestones<br/>left?"}
    EMS -->|yes| EWAVE
    EMS -->|no| EFIN(["**done** — plan delivered"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class EDEV agent
    class EASK user
    class EBACK,EMGATE,EGATE skill
```

---

## `test`

```mermaid
flowchart TD
    TARG["a path, or a behaviour to cover<br/>*(from the user, or from an<br/>execute ticket)*"]
    TARG --> TD1
    TD1["**read the record** — runner · globals ·<br/>React? · conventions file · commands.<br/>*nothing rediscovered here*"]
    TD1 --> TSCOPE["**infer the scope** — one piece → unit,<br/>a flow across pieces → integration.<br/>state it back, don't ask"]

    TSCOPE --> TBASE["**run the full suite** —<br/>is the base green?"]
    TBASE -->|"red"| TBASK(["**ASK THE USER** — pre-existing failures:<br/>skip them, or fix them first?"])
    TBASK -.->|"fix first"| TOLD["dispatch **qoq-tester**<br/>over the failing specs"]
    TOLD --> TBASE
    TBASK -.->|"skip — recorded as the baseline"| TSLICE
    TBASE -->|"green"| TSLICE

    TSLICE["**slice the scope** — one coherent unit<br/>each: a file, a component, a behaviour"]
    TSLICE --> TDISP["dispatch **qoq-tester**<br/>(Sonnet, **one slice at a time**)<br/>hands it: conventions · commands ·<br/>the slice · the baseline"]

    subgraph TESTER["qoq-tester flow *(everything the agent does)*"]
        direction TB
        A1["write the specs<br/>for this slice"]
        A1 --> A2["run `test:one` on exactly those specs —<br/>*the project's own script,<br/>never the qoq CLI*"]
        A2 -->|"red"| A4
        A2 -->|"green"| A3["**the full suite** —<br/>against the baseline it was given"]
        A3 -->|"red"| A4{"3 rewrites<br/>spent?"}
        A4 -->|"no — rewrite, don't patch"| A1
        A4 -->|"yes"| AHAND(["**hands back** — what it tried,<br/>the blocker verbatim, what's on disk.<br/>*a subagent can't ask*"])
        A3 -->|"green"| ARET["return: **the files written**,<br/>what the suite says"]
    end

    TDISP --> A1
    AHAND --> TNARROW(["**ASK THE USER** — narrow this slice?<br/>fewer cases, one behaviour at a time —<br/>with the agent's blocker, quoted"])
    TNARROW -.->|"narrowed — counter resets"| TDISP
    TNARROW -.->|"no"| TSTOP2(["**stop** — report the blocker,<br/>nothing half-written left behind"])

    ARET --> TGATE["**qoq fix**, scoped to<br/>the files it returned —<br/>*the gate, run from here*"]
    TGATE -->|FAIL| A4
    TGATE -->|"PASS, and fix changed files"| TRERUN["re-run the full suite —<br/>fix's own check is scoped"]
    TRERUN --> TMORE
    TGATE -->|"PASS, nothing changed"| TMORE{"slices<br/>left?"}
    TMORE -->|"yes — on the tree<br/>this one left green"| TDISP
    TMORE -->|"no"| TREF["**qoq refactor**<br/>scope = every file written"]
    TREF --> TDONE(["**done** — tests green,<br/>gated, tidied. never .skip,<br/>never a loosened assertion"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class TESTER agent
    class TNARROW,TBASK user
    class TGATE,TREF skill
```

---

## `compress`

```mermaid
flowchart TD
    CQ["/qoq compress [paths]"] --> CSCOPE

    CSCOPE{"paths<br/>given?"}
    CSCOPE -->|"yes"| CLIST["those files"]
    CSCOPE -->|"no"| CDEF["git ls-files '*CLAUDE.md' '*AGENTS.md'<br/>*tracked only — an untracked scratch<br/>file has no reader to save*"]
    CDEF --> CLIST
    CLIST --> CSHOW["**list what matched** before touching<br/>anything — in a monorepo that's<br/>twenty files, some shipped to npm"]

    CSHOW --> CNODISC["**no qoq-discovery** —<br/>*no line of the record describes<br/>a markdown file. the only command<br/>that skips it*"]

    CNODISC --> CFILE["**next file** — one at a time,<br/>never in parallel"]
    CFILE --> CREAD["read it **whole** first.<br/>*a rule stated in ¶2 and used in ¶9<br/>looks redundant from ¶9*"]
    CREAD --> CEST{"est. saving<br/>≥ ~15%?"}
    CEST -->|"no — already tight"| CSKIP["**skip it**, record why.<br/>*churn costs more in review<br/>than thirty words return*"]
    CSKIP --> CMORE

    CEST -->|"yes"| CWRITE["**compress to a scratch path**,<br/>not over the original —<br/>the check needs both halves"]
    CWRITE --> CTEST["the one test, per sentence:<br/>**would an agent act differently<br/>if this were gone?**<br/>*reshape to a table before deleting*"]
    CTEST --> CCHECK["node <skill>/scripts/compress-check.mjs<br/>&lt;original&gt; &lt;scratch&gt;<br/>*compares literals: paths · commands ·<br/>flags · filenames · URLs · fenced lines*"]

    CCHECK -->|"exit 1 — dropped"| CDROP{"redundant,<br/>or lost?"}
    CDROP -->|"lost"| CWRITE
    CDROP -->|"redundant — say so<br/>in the report"| CCOLD
    CCHECK -->|"exit 1 — **invented**"| CINV["*compression never creates a path.<br/>a hit here is a hallucinated<br/>filename* → rewrite"]
    CINV --> CWRITE
    CCHECK -->|"exit 0"| CCOLD

    CCOLD["**reread it cold**, as if the original<br/>never existed.<br/>*the script catches lost facts,<br/>never lost meaning*"]
    CCOLD --> CMOVE["move into place"]
    CMOVE --> CMORE{"files<br/>left?"}
    CMORE -->|"yes"| CFILE
    CMORE -->|"no"| CGATE["**qoq fix**, scoped to the files<br/>changed — *markdown is Prettier's<br/>business; reflowed paragraphs and<br/>re-aligned tables come back unformatted*"]

    CGATE --> CDONE(["**done** — one table:<br/>file · before · after · saved,<br/>from the script's own word counts.<br/>plus every skip, and every dropped<br/>literal judged redundant"])

    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class CGATE skill
```

**No purple on this one.** `compress` dispatches nothing — it is judgement about
meaning applied to one file at a time, and two agents rewriting sibling docs are
how the same fact ends up disagreeing with itself in two places.
