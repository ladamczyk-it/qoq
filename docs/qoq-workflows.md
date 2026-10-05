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

Why any of it is shaped this way is a third file, [qoq-design.md](qoq-design.md)
— also outside the skill, and for the same reason these diagrams are.

| Diagram                                     | Prose it reflects                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Entry and discovery](#entry-and-discovery) | [skill](../skills/qoq/SKILL.md), [discovery.md](../skills/qoq/references/discovery.md)   |
| [`fix`](#fix)                               | [fix.md](../skills/qoq/references/fix.md), [cli.yaml](../skills/qoq/references/cli.yaml) |
| [`refactor`](#refactor)                     | [refactor.md](../skills/qoq/references/refactor.md)                                      |
| [`bump`](#bump)                             | [bump.md](../skills/qoq/references/bump.md)                                              |
| [`plan`](#plan)                             | [plan.md](../skills/qoq/references/plan.md)                                              |
| [`replan`](#replan)                         | [replan.md](../skills/qoq/references/replan.md)                                          |
| [`execute`](#execute)                       | [execute.md](../skills/qoq/references/execute.md)                                        |
| [`test`](#test)                             | [test.md](../skills/qoq/references/test.md)                                              |
| [`compress`](#compress)                     | [compress.md](../skills/qoq/references/compress.md)                                      |

**Legend, shared by all nine.** Purple = a subagent and everything it does.
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
    Q["/qoq [command]"] --> ENTRY

    ENTRY["**scripts/entry.mjs --project --command $0**<br/>injected into SKILL.md at invocation<br/>(`!` dynamic context) — the thread reads its<br/>output, never runs it for the top-level run.<br/>Composes the three head-of-run checks and<br/>prints a section each, with what to do<br/>*the sequencing rules live here rather than<br/>in SKILL.md, which every run of every<br/>command loads whether it needs them or not*"]

    ENTRY --> CMD{"$0 a known<br/>command?"}
    CMD -->|"no — empty or unknown"| CASK(["**one `command` section, exit 0**<br/>ASK which command, then run the<br/>entry.mjs line it prints<br/>*a non-zero exit would abort the skill;<br/>nothing else runs, stats least of all*"])
    CMD -->|yes| SYNC

    subgraph HEAD["what entry.mjs runs, in order"]
        direction TB
        SYNC["**1. sync-agents.mjs** —<br/>copy the skill's agent files into<br/>&lt;root&gt;/.claude/agents<br/>*an agent inside a skill is registered<br/>by nothing; symlinked ones are left alone*<br/>*did the SKILL move? — a separate<br/>question from the hash's did the<br/>PROJECT move, so it gets its own check*<br/>*tracks what it wrote in .qoq-agents.json:<br/>a body that isn't the one it installed is<br/>the user's, and is kept, never reverted*<br/>*deletes the copies of agents the skill<br/>stopped shipping — same proof, plus any<br/>symlink with nothing behind it*"]
        SYNC --> CISC{"command =<br/>compress?"}
        CISC -->|"yes — edits prose, runs no tool,<br/>dispatches no agent"| STATSN
        CISC -->|"no"| CHECK

        CHECK["**2. discovery-check.mjs** —<br/>hash the package.json scripts block +<br/>the watched deps (vitest/jest,<br/>@testing-library/react) named in<br/>package.json and the lockfile,<br/>compare it to the record's hash field<br/>*the scripts too: a renamed script<br/>moves no lockfile, and every command<br/>field on the record quotes one*<br/>*those parts only: a version bump or an<br/>unrelated transitive dependency changes<br/>no word of the record*<br/>*the qoq CLI is not watched: its<br/>invocation is a constant, not a field*"]
        CHECK --> STATSN
        STATSN["**3. stats.mjs &lt;command&gt;** —<br/>reads qoq.config `stats:`, then<br/>~/.claude/qoq/consent.md<br/>*on exit 1 it prints the disclosure itself,<br/>quoting the literal request body — so it<br/>cannot drift from what is sent, and every<br/>run that isn't asking stops paying for it*"]
    end

    HEAD --> SECT["**stdout: one section per check**"]

    SECT -.->|"line is `agents installed:` **and**<br/>the command is fix / test / execute"| AASK
    AASK(["**caller ASKS THE USER**<br/>continue now on the general-purpose<br/>fallback, or exit and re-run with them<br/>registered?<br/>*those three dispatch a pinned agent<br/>inside the pickup window — and for<br/>qoq-tester the fallback is its<br/>restriction gone*<br/>*refactor is the exception: it opens with<br/>a fix, but a question in front of another<br/>command's question is the noise this<br/>narrowing exists to remove*"])

    SECT -.->|"stats never asked"| SASK(["**ASK THE USER**<br/>send anonymous usage stats?<br/>*consent is never defaulted*"])
    SASK -.->|"record it: `stats.mjs &lt;command&gt;<br/>--consent yes/no`"| SECT

    SECT -->|"discovery current —<br/>the record is in the section"| USE["**use the record as-is**,<br/>derive nothing<br/>*the common case,<br/>and the reason it exists*"]
    SECT -->|"discovery stale — the section<br/>carries hash + proposed + unresolved"| DISP

    DISP["**fill the record in, on this thread**<br/>*proposed = the half that was only ever<br/>reading, already derived by the check.<br/>unresolved = the half that needed a<br/>reader. Deriving both twice is how the<br/>two answers come to disagree*<br/>*no agent: a Haiku pin can't hold on the<br/>first run in a project — the agents were<br/>installed seconds ago — and the one move<br/>this can end in is a question only this<br/>thread can ask*"]

    subgraph DISCO["filling the record *(references/discovery.md)*"]
        direction TB
        HAS{"a stale record<br/>to repair?"}
        HAS -->|yes| VER{"verify it<br/>field by field"}
        VER -->|"all hold"| DONE["re-stamp the hash,<br/>change nothing else<br/>*(a bump that moved no script)*"]
        VER -->|stale| D0["re-derive the<br/>failed fields only"]
        HAS -->|no| D0

        D0 --> DOCS["**read the project's docs first** —<br/>CLAUDE.md / AGENTS.md / README.md.<br/>*a written answer outranks a guess*"]
        DOCS --> D1["**check `proposed`**<br/>*a starting point with a stale record's<br/>standing: usually right, worth a glance,<br/>yours to overrule when the docs say so*"]
        D1 --> D3["**1. project commands**, unresolved only<br/>test — full suite · test — single file · build<br/>*the project's own scripts —<br/>npx is qoq's alone*<br/>*test:one is always here: both runners take<br/>a path positionally, so a default is easy to<br/>write and easy to be wrong about*"]
        D3 --> D4["**2. test conventions**, unresolved only<br/>runner · globals on or off ·<br/>React? · a testing-gate.md<br/>at the root<br/>*no CLI step: npx qoq --check --json is<br/>the same line in every project, so<br/>nothing reads the CLI's AGENTS.md*"]
        D4 --> REC["write the record — **JSON**,<br/>hash included →<br/>node_modules/@ladamczyk/qoq-cli/bin/<br/>qoq-skill-discovery.json"]

        BLOCK(["**stop, write nothing**<br/>half a record is read as<br/>whole by the next run"])
        D3 -.->|anything unclear| BLOCK
        D4 -.->|anything unclear| BLOCK
    end

    DISP --> HAS

    BLOCK -.-> ASK(["**ASK THE USER**<br/>never assume a default"])
    ASK -.-> WRITE["**write the answer into the<br/>project's docs** — CLAUDE.md /<br/>AGENTS.md / README.md.<br/>*survives the next reinstall*"]
    WRITE -.-> D1

    REC --> OPT
    DONE --> OPT
    USE --> OPT

    OPT{"which<br/>command?"}
    OPT -->|"none given"| OASK(["**ASK THE USER**<br/>which command?"])
    OASK -.-> OPT

    OPT -->|fix| RFIX["**qoq fix**<br/>the check/fix loop"]
    OPT -->|refactor| RREF["**qoq refactor**<br/>green base, four assessments"]
    OPT -->|bump| RBUMP["**qoq bump**<br/>analyse, choose, apply"]
    OPT -->|plan| RPLAN["**qoq plan**<br/>requirements → approved plan file"]
    OPT -->|execute| REXEC["**qoq execute**<br/>approved plan file → delivered"]
    OPT -->|test| RTEST["**qoq test**<br/>coverage for code that exists"]
    OPT -->|compress| RCOMP["**qoq compress**<br/>*no discovery — no line of the<br/>record describes a markdown file*"]

    RFIX --> NOTE
    RREF --> NOTE
    RBUMP --> NOTE
    RPLAN --> NOTE
    REXEC --> NOTE
    RTEST --> NOTE
    RCOMP --> NOTE
    NOTE(["**end of run: notice to user**<br/>what discovery repaired, one line each,<br/>plus any agents entry installed,<br/>removed, or kept because they<br/>were edited here"])

    classDef command fill:#f59e0b1a,stroke:#f59e0b,stroke-width:2px,stroke-dasharray:4 3
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px

    class RFIX,RREF,RBUMP,RPLAN,REXEC,RTEST,RCOMP command
    class ASK,OASK,SASK,AASK,NOTE user
```

---

## `fix`

```mermaid
flowchart TD
    CHK["dispatch **qoq-checker**<br/>(Haiku, one instance)"]

    subgraph CHECKER["qoq-checker flow *(everything the agent does)*"]
        direction TB
        C0{"run `reports-current.mjs<br/>&lt;report dir&gt; &lt;scope&gt;`<br/>exit 0 or 1?"}
        C0 -->|"1 — stale or missing"| RUN["the check: `npx qoq --check --json`<br/>*a constant — nothing read off the<br/>record, nothing derived*<br/>*--json is what writes the reports at all*<br/>*no narrowing: positionals are TOOL<br/>names, and `staged` writes no reports*"]
        C0 -->|"0 — current"| DIG
        RUN --> DIG["the digest: `node &lt;skill&gt;/scripts/<br/>summarize.mjs &lt;report dir&gt;`<br/>*the report dir is a constant too;<br/>the skill path is handed in at dispatch*"]
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
    G0 --> G1["the agent writes, then proves it<br/>runs with the **project's own**<br/>`test:one` / `test` / `build`"]
    G1 --> G1B["then **npx qoq staged &lt;its files&gt;**<br/>*the CLI's only path-scoped command:<br/>seconds, and it spares a whole<br/>dispatch-and-gate round on a lint nit*<br/>*writes no reports, so no digest — and<br/>never `--fix` or `--check`, neither<br/>of which takes a path*<br/>**qoq-developer adds `--skip-knip`**<br/>*(knip ignores the file list and reads<br/>the whole repo — mid-milestone that<br/>repo is missing the tickets to come)*"]
    G1B --> G2["hands back **the file list**"]
    G2 --> G3["**caller** dispatches<br/>**qoq fix** over that list<br/>*execute passes `--skip-knip` too;<br/>test does not — no next slice is coming*"]
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
    SCOPE --> LENSQ
    LENSQ{"**ponytail-review** in your own<br/>available-skills list?<br/>*read at the moment it is needed —<br/>already in context, never out of date.<br/>Cached at discovery time it went stale<br/>the moment somebody installed a lens,<br/>and it went stale silently*"}
    LENSQ -->|yes| GB
    LENSQ -->|missing| LENSASK(["**ASK THE USER** — before the<br/>green base, while a re-run is free.<br/>install &amp; re-run *(recommended)*,<br/>or proceed on 3 of 4 — assessment 4<br/>then runs with no counterweight"])
    LENSASK -.->|install| LENSSTOP(["**stop** — install, re-run.<br/>*nothing to clean up first*"])
    LENSASK -.->|proceed| GB
    GB["dispatch **qoq fix** —<br/>establish a green base"]
    GB --> GBQ{"green?"}
    GBQ -->|no| GBSTOP(["**stop** — nothing to refactor<br/>against a red base"])
    GBQ -->|yes| SEQ

    SEQ["**one at a time, in order**<br/>1. JSCPD — honest read<br/>2. this project's own conventions<br/>3. ponytail<br/>4. design — **qoq-designer**"]
    SEQ --> ASSESS["run assessment *N*"]
    ASSESS -.->|"3 only"| LENS["dispatch **ponytail-review** under the<br/>name the list gave it, verbatim — bare<br/>(project) or **plugin:** prefixed, which<br/>do not resolve interchangeably.<br/>declined above = skipped, and named<br/>in the final summary"]
    LENS -.-> AQ
    ASSESS -.->|"4 only"| DSGN["dispatch **qoq-designer** (Sonnet)<br/>*(scope, project root)*"]

    subgraph DESIGNER["qoq-designer flow"]
        direction TB
        DSTACK["identify the **stack** from the<br/>scope's own files — .tsx/.jsx or an<br/>import from react — *not package.json*<br/>*(a server module in a React project<br/>is not a React scope)*"]
        DSTACK --> DIDX["read **assets/patterns/index.md**<br/>the smell→pattern routing table,<br/>plus **react/index.md** when the stack<br/>matched — additively, never instead<br/>*(never the per-pattern files —<br/>a catalogue read first is a<br/>pattern hunt, not a smell hunt)*"]
        DIDX --> DSMELL["hunt smells in the scope:<br/>name the cost each imposes **today**,<br/>check the cheaper native answer<br/>*(union, Record of fns, module —<br/>or pass children, for most React rows)*"]
        DSMELL --> DOUT["return: **the stack detected**, then<br/>per smell: where · cost · candidate<br/>pattern · **asset file** ·<br/>cheaper alternative · confidence<br/>+ smells found and **rejected**"]
    end

    DSGN --> DSTACK
    DOUT --> DREAD["**caller** opens only the asset files<br/>named — the deep stack-idiomatic write-up,<br/>before/after, and when it's wrong"]
    DREAD -.-> AQ
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
    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px

    class APPR,LENSASK user
    class GB,REGREEN,LENS skill
    class DSGN agent
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
    BAPPR -.->|"the chosen set"| MAKE["**now** write the git patches —<br/>one per bump, selected only<br/>*`package.json` only — never<br/>the lockfile*"]
    MAKE --> BAPPLY

    BAPPLY["apply next patch<br/>+ reinstall<br/>*the install alone regenerates<br/>the lockfile; a failed install<br/>is a failed patch*"]
    BAPPLY --> BVAL["**validate** — all three, in order<br/>`qoq fix` · `test` full suite · `build`<br/>*(commands from the record)*"]
    BVAL -->|passes| PREF["**qoq refactor --decisions auto**<br/>scope = this patch's files —<br/>*applies the safe tier,<br/>advises the rest*"]
    PREF -->|"changed nothing"| BMORE{"patches left?"}
    PREF -->|"changed something"| BREVAL["**re-validate** — test + build<br/>*(the refactor's own fix already ran)*"]
    BREVAL -->|passes| BMORE
    BREVAL -->|fails| BSPLIT
    BVAL -->|fails| BSPLIT{"can this patch<br/>split further?"}
    BSPLIT -->|"yes — grouped → **minor** / **patch**,<br/>then → **one per package**"| BRECUT["revert it *(git restore<br/>package.json + lockfile, reinstall)*,<br/>re-cut at the next level down"]
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
    EXIST -->|"yes — but the shape is wrong"| ERP["hand to **qoq replan**<br/>*(delivered work stays frozen)*"]
    EXIST -->|no| SMALL

    subgraph P1["Phase 1 — Scope"]
        direction TB
        SMALL{"one ticket's<br/>worth of work?"}
        SMALL -->|yes| PSTOP(["**stop** — no plan file.<br/>straight to the code —<br/>the gate alone is the bar"])
        SMALL -->|no| GRILLQ{"is `grilling` in your own<br/>**available-skills list**?<br/>*never cached — that list is<br/>already in this thread's context*<br/>*look for `grilling`, NOT `grill-me`:<br/>grill-me is disable-model-invocation<br/>and its whole body forwards here*"}
        GRILLQ -->|missing| GASK(["**ASK ONCE** — install<br/>`/plugin install mattpocock-skills`<br/>and re-run *(recommended)*,<br/>or proceed and ask the gaps one<br/>at a time, mid-decomposition"])
        GASK -.->|"proceed without"| PSCEN
        GRILLQ -->|installed| GRILL["invoke **grilling** with the requirements<br/>**plus what's already settled**, so its<br/>frontier opens on the gaps rather than<br/>re-asking what the spec answers"]
        GRILL --> GCAP["**it is stateless** — no files, no record.<br/>everything it settled lives only in this<br/>thread, so it has to land in the plan:<br/>Architecture · a ticket's Context ·<br/>a criterion that only got sharp<br/>because a question was asked"]
        GCAP --> PSCEN["**emit the Scenarios** — *Given / When / Then*<br/>prose per milestone, in the user's language,<br/>**from what the grill settled**.<br/>*a journey spanning tickets, not a ticket's<br/>assertion — nothing else in the plan holds<br/>one. more than ~6 and the milestone is too big*"]
    end

    PSCEN --> PEXP

    subgraph P2["Phase 2 — Design"]
        direction TB
        PEXP["dispatch **Explore** — *locate*:<br/>deps · existing patterns · test conventions<br/>*(reads excerpts, not whole files —<br/>it locates, it does not audit)*"]
        PEXP --> PSKIP{"single existing module **and**<br/>no new data shape, payload<br/>or persisted field **and**<br/>no new dependency?"}
        PSKIP -->|yes| PNONE["**Contracts: none** — nothing to design.<br/>*say so at approval: it is the other thing<br/>the user cannot see from the plan file*"]
        PSKIP -->|"no, or any doubt"| PARCH["dispatch **qoq-architect** — *audit*: read<br/>deep in what Explore located, **carrying<br/>the Scenarios**. *a journey constrains a<br/>contract: journeys are what, contracts<br/>are how, and that is the order*"]
        PARCH --> PIDX["**indexes only while scanning** —<br/>patterns/index.md + the stack index for<br/>the **scope's own files**, never package.json.<br/>*a write-up read before the scan is<br/>persuasive by construction, and at design<br/>time there is no code to falsify it against*"]
        PIDX --> PSMELL["a named pattern needs a **cited file:line<br/>smell in code that already exists**.<br/>otherwise the ponytail ladder stands —<br/>a new dependency is **flagged, never chosen**"]
        PSMELL --> PWRITE["**then** open that one write-up and check<br/>it fits — one per named pattern, never<br/>before. *the citation is already fixed, so<br/>reading can falsify the candidate,<br/>not widen it. say so when it does not fit*"]
        PWRITE --> PRET["returns: **Contracts** · **Integration surface**<br/>· **Risks** · **Unknowns**. never edits"]
        PRET --> PUNK{"Unknowns<br/>returned?"}
        PUNK -->|yes| PDASK(["**ASK THE USER** — a subagent cannot ask.<br/>the architect never guesses a contract:<br/>an invented one reads exactly like<br/>a real one on the page"])
        PDASK -.-> PLAND
        PUNK -->|no| PLAND["**Contracts** → the milestone field<br/>**Integration surface + Risks** → ticket Context<br/>*this is the anti-scope-expansion payload*"]
    end

    PNONE --> PSCOPE
    PLAND --> PSCOPE

    subgraph P3["Phase 3 — Breakdown"]
        direction TB
        PSCOPE{"independent<br/>subsystems?"}
        PSCOPE -->|yes| PSPLIT(["**say so** — separate plans,<br/>one each. never one plan<br/>with both"])
        PSCOPE -->|no| PDEC["**decompose** — per ticket:<br/>size XS/S/M *(never bigger)*<br/>complexity → agent tier, nothing else<br/>Context that stands alone<br/>**criteria written as assertions,<br/>derived from the Scenarios** — so each<br/>has a parent rather than an author<br/>*Risks feed sizing*"]
        PDEC --> PTAG["**tag the ticket** — mechanical ·<br/>architectural · pattern-repeat<br/>*(multiple, extensible)*<br/>+ the stack it lands in"]
        PTAG --> PEST["**scripts/estimate.mjs** — *size + tier is<br/>one decision*, counted per tier from<br/>this repo's `.claude/qoq-estimator.json`.<br/>a **miss** = not delivered inside<br/>the three-attempt budget"]
        PEST -->|"2 — split: tickets of this shape<br/>keep ending up **blocked**<br/>*(not a model problem)*"| PDEC
        PEST -->|"1 — escalate: most of this<br/>bucket missed at this tier"| PBUMP["take the **dearer tier** *(one rung up —<br/>far cheaper than three failed attempts)*.<br/>**never down** — saving a rung isn't worth<br/>an experiment on the user's ticket"]
        PEST -->|"0 — the pick stands"| PXL{"a milestone<br/>coming out XL?"}
        PBUMP --> PFLAG["flag the moved tier<br/>for approval"]
        PFLAG --> PXL
        PXL -->|yes| PSPLIT
        PXL -->|no| PREV["**self-review — the definition-of-ready gate**:<br/>requirement + scenario coverage · no<br/>placeholders · **exact Files** · cross-ticket<br/>interfaces · Depends on that's real ·<br/>**every criterion a spec can assert**<br/>*against the Contracts, before any code*"]
    end

    PREV --> PSAVE["save → ./plans/YYYY-MM-DD-[feature].md"]
    PSAVE --> PAPPR(["**ASK THE USER** — approve.<br/>surfaced here: new deps *(incl. any the<br/>architect flagged)*, the model ceiling,<br/>every tier the estimator moved, and<br/>**what was skipped** — the grill,<br/>the architect, or both"])
    PAPPR -.->|"changes"| PDEC
    PAPPR -.->|"approved"| PMARK["**Plan status: approved**<br/>+ Commands header,<br/>copied from the record"]
    PMARK --> PTOOL{"which `--tool`?"}
    PTOOL -->|"local *(default)*"| PHAND
    PTOOL -->|"jira · linear · trello"| PXOFF(["**ASK** — raise them now?<br/>*approving a plan is not the same<br/>act as publishing it into<br/>a team's tracker*"])
    PXOFF -.->|no| PHAND
    PXOFF -.->|yes| PMCP{"an MCP tool for it in your own<br/>**available-tools list**, and a<br/>**destination** — project key,<br/>team, or board?"}
    PMCP -->|"no tool — the *how*"| PXSTOP(["**say so and stop.** MCP setup is<br/>out of scope for this command.<br/>nothing is lost — the plan file is<br/>complete and `qoq execute` runs<br/>from it as-is<br/>*never curl, never a REST call<br/>against a token in the env*"])
    PMCP -->|"no destination — the *where*"| PXWHERE(["**ASK which one**, offering what the<br/>read-only tools can already see.<br/>never pick, never create one —<br/>a plan raised into the wrong project<br/>is worse than one not raised"])
    PXWHERE -.-> PXRUN
    PMCP -->|both known| PXRUN["**export** — container, then milestones,<br/>then tickets, then `Depends on` links last<br/>*(each level needs the one above it<br/>to have an id already)*<br/>status is a **label**, never the tracker's<br/>own workflow column: the export writes<br/>once and never syncs back"]
    PXRUN --> PXBACK["write each returned key/URL into that<br/>item's **External** field, then commit<br/>*the only thing making a re-run<br/>idempotent — an item that has one<br/>is skipped, always*"]
    PXBACK --> PHAND
    PHAND["offer **qoq execute** —<br/>run it on a yes,<br/>dispatch nothing from here"]

    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px
    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px

    class PAPPR,GASK,PXOFF,PXWHERE,PXSTOP,PDASK user
    class EG2,ERP,PHAND,GRILL skill
    class P2 agent
```

---

## `replan`

```mermaid
flowchart TD
    R0["**qoq replan** plans/[file].md"]
    R0 --> RGIT{"the plan file has<br/>uncommitted changes?"}
    RGIT -->|yes| RSTOP(["**REFUSE** — commit or stash first.<br/>replan overwrites in place so the path<br/>stays stable *(External keys, the<br/>.completed.md archive and any resume all<br/>reference it by name)*. git is the history"])
    RGIT -->|no| RSIZE{"one milestone<br/>from done?"}
    RSIZE -->|yes| RFIN(["**say so** — finishing is<br/>cheaper than reshaping"])
    RSIZE -->|no| RNEW{"nothing delivered **and** the<br/>requirements changed substantially?"}
    RNEW -->|yes| RFRESH(["**not a replan** — archive it<br/>and run qoq plan"])
    RNEW -->|no| RSPLIT["**split the file**"]

    RSPLIT --> FROZEN["**FROZEN** — delivered milestones · done<br/>tickets · the archive · commits.<br/>*read-only input, never material: a done<br/>ticket re-decomposed loses its commit link<br/>and the history stops meaning anything.*<br/>**backfill only** — missing Log from git,<br/>missing Estimate from estimate.mjs"]
    RSPLIT --> LIVE["**LIVE** — todo · in-progress · blocked<br/>tickets and undelivered milestones.<br/>*the only thing replan may rewrite*"]

    FROZEN --> GRILL
    LIVE --> GRILL["**Phase 1 over the live part** — hand the grill<br/>the old plan, the original Requirements source<br/>if it still resolves, **and what went wrong**:<br/>blocked tickets, escalations, scope-expansion<br/>attributions. *nothing else in the system reads<br/>these at plan time, and they are the strongest<br/>evidence the old decomposition was wrong*"]
    GRILL --> GNOTE["*self-limiting — handed everything already<br/>settled plus milestones that demonstrably<br/>work, the frontier is nearly closed.<br/>no skip mode needed*"]
    GNOTE --> PH23["**Phases 2 and 3**, live tickets only —<br/>architect, then decompose"]
    PH23 --> ORPH{"did any live ticket<br/>carry an **External** key?"}
    ORPH -->|yes| ORPT(["**report the orphans at approval** — a<br/>re-decomposed ticket loses its External and<br/>the tracker item it was is now dangling.<br/>*replan never syncs: the export writes once<br/>and never syncs back, and syncing is the<br/>problem this skill refuses to own*"])
    ORPT -.-> WRITE
    ORPH -->|no| WRITE["**overwrite in place**.<br/>*the calibration store is untouched — a<br/>recorded outcome means 'this shape of work<br/>at that tier went this way', which stays<br/>true however the plan is now shaped*"]

    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px

    class RSTOP,RFIN,RFRESH,ORPT user
    class GRILL,PH23 skill
```

---

## `execute`

```mermaid
flowchart TD
    EARG{"--source?"}
    EARG -->|"local *(default)*"| ELOAD
    EARG -->|"jira · linear · trello"| EIMP(["**ASK which milestone** — epic ·<br/>milestone · list, offering what the<br/>read-only tools can see.<br/>*never a bare ticket (no milestone gate)<br/>and never a board (work nobody started)*"])
    EIMP --> EIMAP["**read the mapping backwards** into<br/>the plan template — External = the key/URL.<br/>fill what no tracker has: **Commands** from<br/>the record, **Estimate** from estimate.mjs.<br/>write **Plan status: approved**"]
    EIMAP --> ERE{"a plan file already<br/>carries this milestone's<br/>**External**?"}
    ERE -->|"yes — the common<br/>second invocation"| ERES["**resume it** — add tickets the tracker<br/>has gained, touch nothing already there.<br/>*re-importing overwrites every done,<br/>every commit hash, and every assertion<br/>the user was asked for*"]
    ERES --> ELOAD
    ERE -->|no| ECRIT{"acceptance criteria<br/>assertable as written?"}
    ECRIT -->|"no — prose, a title"| ECASK(["**ASK THE USER** for the assertions,<br/>quoted, all tickets in one question,<br/>before anything dispatches.<br/>*never infer them — an invented criterion<br/>is a bar the ticket sets for itself*"])
    ECASK -.-> ELOAD
    ECRIT -->|yes| ELOAD
    ELOAD["**load the plan, fresh from disk**<br/>every time, resume or not<br/>*(./plans/[file].md — imported or not,<br/>nothing below knows the difference)*"]
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
    EWAVE --> ELIM{"--session-limit or<br/>--weekly-limit given?"}
    ELIM -->|"neither — no gate,<br/>nothing fetched"| EDISP
    ELIM -->|"either — the other<br/>defaults to 100"| EUSE["**usage-check.mjs** — before *each*<br/>ticket, headroom shown to the user<br/>verbatim. *`usage unavailable`<br/>→ say so and carry on*"]
    EUSE -->|"exit 0 — under both"| EDISP
    EUSE -->|"exit 1 — limit reached"| EPERM(["**ASK THE USER**<br/>dispatch anyway? a yes disarms<br/>the gate for the rest of the run —<br/>the number only climbs"])
    EPERM -->|yes| EDISP
    EPERM -->|no| EPAUSE(["**pause, not blocked** — ticket status<br/>untouched, **no estimate filed**<br/>*(nothing was dispatched to grade)*.<br/>qoq execute [plan] resumes it"])
    EDISP["dispatch **one qoq-developer** — model = the<br/>ticket's tier. carries **verbatim**: id · Context ·<br/>Files · Acceptance criteria · **the milestone's<br/>Contracts** · the record's path ·<br/>test-conventions.md's path.<br/>*not the Scenarios — journey-level context<br/>a single ticket cannot act on*"]

    subgraph EDEV["qoq-developer — red · green · refactor"]
        direction TB
        T0["**read the record** — runner · globals ·<br/>React? · conventions file · commands ·<br/>how to invoke qoq. *first move*"]
        T0 --> T1["**RED** — transcribe **every** criterion into<br/>an assertion **against the Contract**, in the<br/>project's dialect. **one run**: each must<br/>fail, and for the right reason.<br/>*the runner names every failing test — that<br/>is the isolation a per-criterion cycle<br/>would have bought. the reviewer cannot run<br/>anything, so this is the empirical half*"]
        T1 --> T2["**GREEN** — one criterion at a time, the<br/>minimum that turns that one assertion.<br/>*re-run a single one when you want to<br/>check it — permitted, never required*"]
        T2 --> TREF["**REFACTOR** — tidy inside the ticket's own<br/>**Files**, while green, no interface change,<br/>re-run after. *not the milestone refactor*"]
        TREF --> TADD["may **add** cases per test-conventions.md.<br/>**never change what a green assertion<br/>expects on your own judgment** — that is a<br/>hand-back with the criterion quoted.<br/>*a Gate 2 rejection is the one exception,<br/>and only for the assertions it cites*"]
        TADD --> T4["**prove it runs** — the project's<br/>own `test:one` + `build`, then<br/>`npx qoq staged --skip-knip` over its files<br/>*scoped and report-less: the<br/>digest and the gate stay<br/>with the caller*"]
        T4 -->|"red, budget left"| T2
        T4 -->|"red, budget spent"| THAND(["**handoff report** —<br/>never narrow the ticket,<br/>never weaken the gate"])
        T4 -->|"green"| TRET["hand back **every file changed**,<br/>spec and source both"]
    end

    CONTRA(["**a Contract that turns out wrong is a<br/>HAND-BACK, not an edit** — widening a<br/>payload to make your own test pass is<br/>the failure this rule exists for"])
    T1 -.-> CONTRA

    EDISP --> T0
    TRET --> EGATE["**GATE 1 — qoq fix --skip-knip**, scoped<br/>to exactly the files it returned.<br/>*knip is the one tool that can't be scoped —<br/>it asks whether an export is reachable in a<br/>repo missing every ticket after this one, so<br/>it calls ticket 4's dependency dead code and<br/>the gate sends ticket 3 back to delete it*"]
    EGATE -->|FAIL| EATT
    EGATE -->|PASS| EGATE2["**GATE 2 — qoq-test-reviewer**, read-only,<br/>over the spec files.<br/>*fix first: it rewrites formatting, so a<br/>semantic read before it would be spent<br/>on text about to change*"]
    EGATE2 -->|"REJECTED — file:line per defect"| EATT
    EGATE2 -->|"APPROVED + the criterion→assertion mapping"| TCOM["**commit** exactly this ticket's files,<br/>**`--no-verify`**.<br/>*nothing reaches history unproven, and no<br/>ticket is finished without proof its tests<br/>are real — the gates just ran, scoped, and a<br/>pre-commit hook would re-run them plus the<br/>knip that gate 1 dropped on purpose*"]

    EATT{"**3 attempts spent?**<br/>*shared across BOTH gates —<br/>an attempt is an attempt*"}
    EATT -->|"no — re-dispatch with the<br/>digest or the verdict **verbatim**"| EDISP
    EATT -->|yes| EESC
    THAND --> EESC{"a tier<br/>above?"}
    EESC -->|"yes — re-dispatch with<br/>the report pasted in"| EDISP
    EESC -->|"no — top rung already"| EBLOCK(["**Status: blocked** — bring the<br/>user the report: bad ticket,<br/>or session model too small"])

    TCOM --> EDONE["**Status: done** + commit hash, advisories.<br/>**tick each acceptance criterion and write<br/>its evidence pointer** from the reviewer's<br/>mapping — *never from your own reading<br/>of the diff*"]
    EDONE --> ELOG["**Log** — one line per transition:<br/>dispatch, each gate verdict,<br/>re-dispatch, done/blocked + hash"]
    EBLOCK --> ELOG
    ELOG --> EXBACK
    EXBACK["**imported plan only** — write the status<br/>**label** and the commit back to the item's<br/>**External** key. *the one state qoq writes:<br/>a run knows the transition as it happens,<br/>an export sets one and walks away.<br/>never the workflow column, never a list move.<br/>a rejected write is a report line, not a stop*"]
    EDONE -->|"**success** — even after three<br/>rounds and an escalation"| EREC["**estimate.mjs --record** — against the tags<br/>and **the tier the plan assigned**, never the one<br/>that finally delivered it. attempts spent, plus<br/>**your attribution**: estimation-miss *(the pick was<br/>wrong)* vs scope-expansion *(a different ticket got<br/>built)* — only a miss reaches a verdict"]
    EBLOCK -->|"**failure** — nothing delivered it<br/>*(the only thing that earns a split)*"| EREC
    EREC --> EMORE{"tickets left in<br/>the milestone?"}
    EMORE -->|yes| EWAVE
    EMORE -->|no| EMGATE["**milestone 1 — qoq refactor --decisions auto**<br/>over the union of every ticket's files.<br/>*the specs are in that union, so cross-ticket<br/>setup duplication and one boundary mocked<br/>three ways are already JSCPD's job —<br/>no third gate is needed here*<br/>**its green base is a full qoq fix — knip on.**<br/>*first moment every consumer exists, so the<br/>first moment a dead-code finding is true*"]
    EMGATE --> EMSUITE["**milestone 2 — the project's<br/>full build + full test suite**"]
    EMSUITE -->|red| ENEW["write the failure up as a new<br/>ticket — sized, rated, dispatched"]
    ENEW --> EWAVE
    EMSUITE -->|green| EARCH["**archive with the evidence** — the refactor<br/>verdict and the suite result into the<br/>Completed summary, not just 'green'.<br/>milestone text to .completed.md, summary<br/>stays, downstream Context updated first"]
    EARCH --> EMS{"milestones<br/>left?"}
    EMS -->|yes| EWAVE
    EMS -->|no| EFIN(["**done** — plan delivered"])

    classDef agent fill:#8b5cf61f,stroke:#8b5cf6,stroke-width:2px
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px
    classDef note fill:#f59e0b1f,stroke:#f59e0b,stroke-width:2px

    class EDEV,EGATE2 agent
    class EASK,EPERM,EIMP,ECASK user
    class EBACK,EMGATE,EGATE skill
    class CONTRA note
```

---

## `test`

```mermaid
flowchart TD
    TARG["a path, or a behaviour to cover<br/>*(from the user — the only caller.<br/>a ticket raises its own assertions<br/>inside qoq-developer)*"]
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
        A1 --> A2["run `test:one` on exactly those specs<br/>*the project's own script*, then<br/>`npx qoq staged` over the same specs<br/>*scoped, seconds, no reports*"]
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

    CSHOW --> CNODISC["**no discovery at all** —<br/>*no line of the record describes<br/>a markdown file. the only command<br/>that skips it*"]

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
