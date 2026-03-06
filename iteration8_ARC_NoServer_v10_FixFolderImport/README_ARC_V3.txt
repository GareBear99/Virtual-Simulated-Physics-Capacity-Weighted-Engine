
ITERATION8 + ARC (NO SERVER) v3

Open:
- iteration8/index.html
(or OPEN_ME.html)

Fix:
- ARC scripts load AFTER iteration8 boot (window load + safe guards)
- No DOM restructuring of iteration8 index
- ARC cannot crash iteration8 (fail-closed)

Controls:
- H toggles ARC panel

Feed real signals:
- DevTools: ARC_FEED("entity_name","wifi",1)
