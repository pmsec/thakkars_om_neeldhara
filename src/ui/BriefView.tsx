/**
 * The brief, as prose: what this plan is, the rules it was drawn under, and
 * what still needs an engineer's signature. Regenerated for the CAD-branch
 * plan — the Rev 4 brief this view used to carry described a different,
 * earlier scheme.
 */

import React from 'react'
import { building } from '../data/building'
import { activeHome } from '../homes/registry'
import { getModel } from '../geometry/model'
import { sqFt, sqM } from '../geometry/units'

const S: React.CSSProperties = { maxWidth: 860, margin: '0 auto', padding: '28px 34px 80px' }
const H: React.CSSProperties = { marginTop: 34, marginBottom: 8 }

export function BriefView(): React.ReactElement {
  // A brief is a written thing. Om Neeldhara has one because somebody wrote it;
  // a flat that was imported this morning has not been briefed, and printing
  // another home's brief under its name would be the worst kind of lie the app
  // could tell — plausible, specific and wrong.
  if (!activeHome.meta.checks.brief) return <NoBrief />

  return (
    <div className="brief" style={S}>
      <h1 style={{ marginBottom: 4 }}>{building.meta.project}</h1>
      <p className="tiny" style={{ color: 'var(--ink-soft)' }}>
        {building.meta.drawing} · {building.meta.revision} · {building.meta.date} —{' '}
        {building.meta.scaleNote}
      </p>

      <h2 style={H}>The idea: in &amp; out, open &amp; close — both at once</h2>
      <p>
        Every boundary that matters can be opened, and every one of them can be closed.
        The great room flows into the all-weather deck through 6250 mm of sliding glass;
        the two pods stand behind curved glass screens whose arched portals have no
        doors; each master suite opens full-width to its own terrace; even the parents&rsquo;
        dressing zone is closed by a leaf of tinted glass that pockets into the backs of
        the cupboards. Close everything and the floor is eight rooms. Open everything and
        it is one room, fifty metres of it, with a real tree at each end.
      </p>

      <h2 style={H}>The shell is honest</h2>
      <p>
        The flat came from the builder as a bare shell — no internal walls. Every wall in
        this model is new, and every opening is a gap left in a new wall, never a hole
        cut into structure. All fourteen columns, every beam, the two sealed shafts, the
        two retained deck voids and the service ducts are exactly where the builder left
        them; the CAD branch&rsquo;s clash suite checks them on every change, and this
        portal&rsquo;s own integrity suite re-derives the rooms from the walls on every build.
      </p>

      <h2 style={H}>The plan in one paragraph</h2>
      <p>
        Two mirrored master wings hold the ends of the floor — bed zone to the north
        opening on a private grass terrace with its own tree and jhoola under a high
        glass roof, dressing and an arched bath to the south. Between them, the shared
        heart: family-dining pod on the west, music-and-work den on the east, both
        behind curved screens, and the great room between, one timber floor with the
        deck through the glass line. The south bay carries the working rooms — kitchen
        with its serving hatch, the entry gallery drum with doors that slide along the
        arc, help&rsquo;s room, the guest WC behind its quarter-ellipse sweep, and the store.
      </p>

      <h2 style={H}>Glass roofs, not walls</h2>
      <p>
        The deck&rsquo;s enclosure is a glass parapet and a retractable glass roof at 3400 mm
        — cooled when shut, open sky when drawn back. Each terrace carries a fixed glass
        roof at 3050 mm over real grass and a real tree. Both pod bays take flat glass
        over their deck ends. The retractable roof and the planted terraces are the two
        items that need society NOC and a structural engineer&rsquo;s sign-off before anything
        is built; neither changes the layout.
      </p>

      <h2 style={H}>What the portal guarantees</h2>
      <p>
        Rooms are never drawn — they are derived from the wall centrelines, so the areas,
        the schedules, the 3D model and the exports cannot disagree with the plan. The
        integrity tab shows every check the build runs: envelope closure, area
        reconciliation, wet stacks under their fixtures, reachability of every room from
        the entry, and the mirror symmetry of the two wings. The construction reference
        remains the DXF generated on the CAD branch; this portal is generated from the
        same source and exists to be read, toggled and walked through.
      </p>
    </div>
  )
}

/** What an imported home has instead of a brief: what it is, and what is missing. */
function NoBrief(): React.ReactElement {
  const model = getModel()
  const rooms = model.rooms.reduce((a, r) => a + r.area, 0)
  return (
    <div className="brief" style={S}>
      <h1 style={{ marginBottom: 4 }}>{building.meta.project}</h1>
      <p className="tiny" style={{ color: 'var(--ink-soft)' }}>
        {building.meta.drawing} · {building.meta.revision} · {building.meta.date}
      </p>

      <h2 style={H}>There is no brief for this home yet</h2>
      <p>
        This flat was IMPORTED, not designed. Every line in it came out of the
        builder&rsquo;s DWG: the walls are the two drawn faces of each wall paired into a
        centreline, the columns are the rectangles on the column layer, and the envelope
        is the RERA carpet boundary pushed out by one external wall. Nothing here is a
        decision — it is a survey.
      </p>
      <p>
        So the model is true, and mute. The rooms below are the builder&rsquo;s rooms with
        the builder&rsquo;s names; the areas are measured, not published; and the 3D model
        is the shell you would walk into on handover, empty.
      </p>

      <h2 style={H}>What it measures</h2>
      <p>
        Envelope {sqM(model.envelopeArea).toFixed(2)} m² ({sqFt(model.envelopeArea).toFixed(0)} sq
        ft) · rooms {sqM(rooms).toFixed(2)} m² ({sqFt(rooms).toFixed(0)} sq ft) across{' '}
        {model.rooms.length} spaces. The difference is the internal partitions, which RERA
        counts as carpet and the room polygons do not.
      </p>

      <h2 style={H}>What is still missing</h2>
      <p>
        Doors. The builder&rsquo;s door arcs sit on their own layer and have not been read
        yet, so every room here is drawn sealed: the openings schedule is empty and the
        reachability checks have nothing to walk through. Furniture and fixtures are empty
        for the same reason — none were drawn.
      </p>

      <h2 style={H}>What happens next</h2>
      <p>
        The same thing that happened to Om Neeldhara. Its plan is Python too, and it began
        as geometry with no reasons attached; it became a design when somebody said what
        the rooms were for and the walls started moving to suit. The first real edit to
        this flat is a sentence about what its owner wants — everything after that is
        arithmetic.
      </p>
    </div>
  )
}
