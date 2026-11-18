# QoQ fullstack workflows — diagrams

Diagrams for [`skills/qoq-fullstack`](../skills/qoq-fullstack/SKILL.md). The prose
wins on a disagreement, and the chart and the prose change in the same commit.
The protocol a repo's own `qoq plan` and `qoq execute` follow is in
[qoq-workflows.md](qoq-workflows.md#a-plan-under-a-program).

| Diagram                       | Prose it reflects                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview](#overview)         | [SKILL.md](../skills/qoq-fullstack/SKILL.md)                                                                                                                                       |
| [Sub-commands](#sub-commands) | [plan.md](../skills/qoq-fullstack/references/plan.md), [execute.md](../skills/qoq-fullstack/references/execute.md), [program-status.mjs](../skills/qoq/scripts/program-status.mjs) |

**Legend.** Amber dashed = a script run directly. Cyan = the user. Red = a `qoq` command run inside a repo session.

## Overview

One chief of staff in the parent folder, one background session per repo. The
files on disk are the state, and messages only wake the chief of staff up.

```mermaid
flowchart LR
    USER(["**user**"])
    COS["**chief of staff**<br/>parent folder<br/>owns brd.md · program.json"]
    STATUS["**program-status.mjs**<br/>rebuilds state from disk"]
    subgraph REPOS["repo sessions — claude --bg --model opus, in parallel"]
        BE["**be**<br/>qoq plan · qoq execute"]
        TEL["**telemetry**<br/>qoq plan · qoq execute"]
        UI["**ui**<br/>qoq plan · qoq execute"]
    end
    CON[("contracts/")]
    USER <-->|"business grilling ·<br/>relayed questions"| COS
    COS -->|"launch · wake"| REPOS
    REPOS -.->|"plan file first,<br/>then SendMessage"| COS
    COS --> STATUS
    BE & TEL -->|"provider writes"| CON
    CON -->|"consumer plans against"| UI
    UI -->|"execute asks:<br/>may M&lt;N&gt; start?"| STATUS

    classDef command fill:#f59e0b1a,stroke:#f59e0b,stroke-width:2px,stroke-dasharray:4 3
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px
    class STATUS command
    class USER user
    class BE,TEL,UI skill
```

## Sub-commands

```mermaid
flowchart TD
    PSUB{"sub-command?"}
    PSUB -->|status| PSTAT["**program-status.mjs**<br/>print its table — read-only"]
    PSUB -->|plan| PJSON{"program.json<br/>in the parent folder?"}
    PJSON -->|no| PJASK(["**ASK THE USER**<br/>repos · after (dependency order) ·<br/>integration checks · permissionMode<br/>— never guessed"])
    PJASK --> PGRILL
    PJSON -->|yes| PGRILL["**grilling — business only**<br/>actors · Given/When/Then ·<br/>milestone edges. *no repo is named:<br/>a technology question is parked<br/>for the repos, never asked here*"]
    PGRILL --> PBRD(["**ASK THE USER**<br/>approve brd.md"])
    PBRD --> PREPO["**every** repo, in **after** order:<br/>claude --bg --model opus --name project-repo<br/>→ **qoq plan** on the whole BRD →<br/>a plan, or **no changes needed**"]
    PREPO --> PRELAY(["**relay** each repo's grilling<br/>and approval to the user,<br/>verbatim, prefixed by repo"])
    PRELAY --> PCON["approved: Repo plans row = plan dir or none ·<br/>provider writes contracts/name.md →<br/>start repos whose after is settled"]
    PCON --> PSCHED["**--schedule** — automatic, no questions:<br/>simulate the parallel run, reorder rows<br/>so the piece another repo needs goes first.<br/>*hard dependencies never move*"]
    PSCHED --> PCOV{"every master milestone<br/>served by a repo milestone?"}
    PCOV -->|gap| PREPLAN["that repo: **qoq replan**"]
    PREPLAN -.-> PCOV
    PCOV -->|yes| PEXEC
    PSUB -->|execute| PSETUP
    PEXEC["offer **execute**"] --> PSETUP
    PSETUP(["**setup, once per repo**<br/>crossSessionInbound accept +<br/>bgIsolation none? ·<br/>claude --version · program/slug branch"])
    PSETUP --> PLOOP["**program-status.mjs --json**<br/>*the files are the state*"]
    PLOOP --> PWAKE["each repo with **next.runnable**,<br/>idle or gone → **qoq execute** in it.<br/>*repos in parallel; one ticket<br/>at a time inside each*"]
    PWAKE --> PDUE{"a master milestone<br/>integrationDue?"}
    PDUE -->|yes| PINT["run its checks —<br/>npm run script in that repo"]
    PINT -->|pass| PDEL["master row → **delivered**<br/>*the only write that<br/>unblocks the next master*"]
    PINT -->|fail| PFAIL(["**ASK THE USER**<br/>which repo takes the fix →<br/>its qoq replan"])
    PDUE -->|no| PWAIT
    PDEL --> PWAIT
    PFAIL -.-> PWAIT
    PWAIT["wait: a message or an idle notice<br/>*a repo writes its plan file first,<br/>then messages*"] --> PLOOP
    PWAIT -->|"escalation relayed"| PESC(["**ASK THE USER**<br/>only repos waiting on it stop"])
    PESC -.-> PLOOP

    classDef command fill:#f59e0b1a,stroke:#f59e0b,stroke-width:2px,stroke-dasharray:4 3
    classDef user fill:#06b6d422,stroke:#0891b2,stroke-width:2px
    classDef skill fill:#ef44441f,stroke:#ef4444,stroke-width:2px
    class PSTAT,PLOOP,PSCHED command
    class PJASK,PBRD,PRELAY,PSETUP,PFAIL,PESC user
    class PREPO,PWAKE,PREPLAN,PEXEC skill
```
