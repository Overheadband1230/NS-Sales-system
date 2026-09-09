# Context folder

This folder holds durable, hand-maintained notes about how the NS Online Shipment Tracker
is built. It exists so that a person — or an AI coding assistant — can get oriented
without reading the whole codebase first.

It is documentation only. Nothing here is imported, built, or deployed.

## What is in here

| File | Purpose |
| --- | --- |
| `README.md` | This file: how to use and maintain the folder. |
| `architecture.md` | What the system is, its layers, data model, and the rules that must not be broken. |

## How to use it

**Starting a task.** Read `architecture.md` first. It tells you which layer owns the
behavior you are about to change, so you can extend the right file instead of adding a
parallel path. The "Invariants" section lists the rules that a change must not violate;
check your plan against it before writing code.

**Asking a question about the system.** Look for the answer here before grepping. If the
answer is a stable architectural fact and it is missing, add it once you have found it.

**Working with an AI assistant.** Point the assistant at this folder at the start of a
session — for example, "read `context/architecture.md` before changing the publish flow."
That is cheaper and more reliable than having it rediscover the structure each time.

## How to maintain it

Keep this folder small. It earns its place only if it stays true.

- **Record decisions and invariants, not inventories.** A list of every file goes stale in
  a week and the file tree already tells you that. "Internal notes must never reach a
  published snapshot" stays true for years.
- **Update it in the same change that breaks it.** If you move ownership of a behavior,
  rename a table, or add a layer, edit these notes in the same commit. A wrong note is
  worse than no note.
- **Do not duplicate the root `README.md`.** That file covers setup, environment
  variables, and deployment — how to *run* the project. This folder covers how the project
  is *shaped*. Link across rather than copying.
- **Do not put secrets, keys, customer data, or exported route JSON here.** This folder is
  committed to the repository.
