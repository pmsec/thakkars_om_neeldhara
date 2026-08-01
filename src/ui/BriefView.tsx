/**
 * Project brief, Rev 4 revision note, and the open constraints (brief §8).
 * Carried here so the interior designer and the contractors can read the intent
 * without it being explained to them each time.
 */

import React from 'react'
import { getModel } from '../geometry/model'
import { greatRoomWidths } from '../geometry/dimensions'
import { building } from '../data/building'
import { formatFeetInches, sqFt, sqM } from '../geometry/units'

const model = getModel()

export function BriefView(): React.ReactElement {
  const w = greatRoomWidths()
  const great = model.roomById.get('R-GREAT')!
  const deck = model.roomById.get('R-DECK')!
  const pTerrace = model.roomById.get('R-P-TERRACE')!
  const roof = building.glassRoofs.find((r) => r.id === 'ROOF-DECK')!

  return (
    <div className="doc">
      <h1>Full-Floor Residence</h1>
      <p className="lede">
        Two mirror-image 2BHK flats on one floor of a Mumbai building, merged into a single
        home. DWG {building.meta.drawing}, {building.meta.revision}, {building.meta.date}.
        Concept drawing — not for construction.
      </p>

      <h2>Who this house is for</h2>
      <p>
        The owner (Karan) and his wife; his two parents; and his grandmother, who visits
        occasionally and needs a place to sleep. Plus a live-in house help, present 24/7.
      </p>

      <h3>The organising idea — a house within a house</h3>
      <p>
        The two ends of the floor become self-contained pods, one for Karan and his wife,
        one for his parents. Each pod is a merged master suite, a multipurpose room and its
        own hall, separated from the shared central great room by a big curved glass wall
        with an arched portal. The owner likes curved walls and arches; this is the
        signature move of the design and it reads in both the plan and the model.
      </p>
      <p>
        The wall between the two original living/dining rooms is not RCC and is being
        demolished. That is what makes the great room possible: it runs{' '}
        <b>{w.atDeck} mm</b> ({formatFeetInches(w.atDeck)}) wide at the deck edge, widening
        to <b>{w.atBack} mm</b> ({formatFeetInches(w.atBack)}) at the dining end as the two
        curves bow away from it — {sqFt(great.area).toFixed(0)} sq ft /{' '}
        {sqM(great.area).toFixed(1)} m² of carpet.
      </p>

      <h3>What the design has to do</h3>
      <ul>
        <li>Both wings are one large combined master suite each, the two original master bedrooms merged.</li>
        <li>
          The parents&rsquo; side includes a day bed for the grandmother, screened by a curved
          sliding partition.
        </li>
        <li>One kitchen only, deliberately placed away from Karan&rsquo;s wing, because kitchens are noisy.</li>
        <li>
          A small pantry / coffee bar at the edge of Karan&rsquo;s multipurpose room, next to the
          deck, for balcony and den chill sessions, with a hatch through to the deck.
        </li>
        <li>
          Karan&rsquo;s multipurpose room is a music and work den: a good couch for working and
          taking calls, an electronic drum kit, guitars. It has a glass roof for daylight.
        </li>
        <li>
          The long balcony along the living room is not a separate room. It is merged into
          the great room as an all-weather deck of {sqFt(deck.area).toFixed(0)} sq ft, under
          a big curved, openable, acoustic glass roof — road-noise insulation, daylight,
          sitting under the stars.
        </li>
        <li>Toilets: one per master suite, plus one small guest bathroom.</li>
        <li>
          Wet areas stay put. All bathrooms and the kitchen remain on their existing
          plumbing stacks. Everything else internal has been freely re-planned.
        </li>
        <li>
          A sealed service zone reachable by its own door from the building lobby, so the
          house help can enter, cook, do laundry and leave without entering the house. It
          holds the kitchen, the dry balcony / laundry, the storeroom, a service WC and the
          live-in help&rsquo;s sleeping room. Exactly one internal door connects it to the house,
          plus a serving hatch to the dining area.
        </li>
        <li>A storeroom with plenty of shelving for home supplies.</li>
        <li>A pooja niche, on the parents&rsquo; side of the house.</li>
      </ul>
      <p>
        The owner hands this to an interior designer, who has it executed by contractors.
        The portal is a communication and verification tool, not a toy — every number in it
        can be measured and every check can be seen to pass.
      </p>

      <h2>What changed in Rev 4</h2>
      <ul>
        <li>
          <b>Pod curvature reversed.</b> In Rev 3 both curved glass walls bowed <i>into</i>{' '}
          the great room and ate its space. They now bow away from it, into the pods, which
          is what gives the great room its {w.atDeck}&nbsp;→&nbsp;{w.atBack} mm splay.
        </li>
        <li>
          <b>Planters corrected to voids.</b> The two bays at x 3200–4730 and 19750–21280 in
          the deck band are open building shafts, not usable floor and not planters. They
          are hatched like the lift cores. The bathroom windows that ventilate into them are
          intentional and match the sanctioned plan.
        </li>
        <li>
          <b>Dual units added.</b> Every dimension is given in millimetres and feet-inches,
          and every area in both square feet and square metres.
        </li>
      </ul>

      <h2>Open constraints — please do not skip these</h2>

      <div className="callout risk">
        <b>The retractable glass roof over the deck is the highest-risk element in the design.</b>
        It covers an open balcony, so it will need society NOC and, in all likelihood, BMC
        permission. Nothing else in this scheme depends on a third-party approval in the same
        way. Resolve it early: if it is refused, the deck reverts to an open balcony and the
        great room&rsquo;s relationship to it changes.
      </div>

      <div className="callout">
        <b>Specify laminated acoustic glass for that roof.</b> The point of it is road noise.
        Single glazing will not stop road noise, and substituting it during value engineering
        would defeat the reason the roof is there at all. Currently specified as:{' '}
        {roof.glazing}.
      </div>

      <div className="callout">
        <b>Verify the structural columns at the merged-wall junctions on site before anything
        is demolished.</b> The design assumes the wall between the two living/dining rooms is
        non-structural. That assumption has to be confirmed against the as-built condition,
        not against the sanctioned drawing.
      </div>

      <div className="callout">
        <b>Two ex-toilets become walk-in wardrobes with plumbing capped, not removed.</b>{' '}
        {building.stacks
          .filter((s) => s.capped)
          .map((s) => s.name)
          .join(' and ')}
        . Keeping the stacks live means the change is reversible, which matters for resale
        and for any future re-split of the floor.
      </div>

      <h2>Assumptions this model makes</h2>
      <p>
        Recorded here so nobody inherits them silently. Each is either visible in the
        integrity page or adjustable in the interface.
      </p>
      <ul>
        <li>
          <b>North is not settled.</b> The Rev 4 sheet&rsquo;s north arrow points along the model&rsquo;s
          +x axis; the header comment in the source script says north is &minus;y. The 3D
          view exposes north as a setting, defaulting to the sheet. The sun-path study is
          only as correct as that setting, so confirm it before reading anything into a shadow.
        </li>
        <li>
          <b>Stack positions are Rev 4 derived, not surveyed.</b> They make the wet-area
          check a real regression guard — move a plumbed fixture and the build fails — but
          they are not a substitute for the sanctioned plumbing drawings.
        </li>
        <li>
          <b>There is no longer any upright glass between the deck and the interior.</b> The
          screens that stood on that line are deleted: the curved canopy is the exterior
          enclosure, so a straight glass wall inside it was a second skin. The family room,
          the den and the great room all now open onto the deck. The line survives only as a
          floor-finish change, which is why the rooms still measure separately.
          <br />
          <b>Worth a decision:</b> that removes the thermal and acoustic break between
          conditioned rooms and the deck. It is the right move if the deck is a winter
          garden on the same air as the house; it is the wrong one if the deck is meant to
          run unconditioned.
        </li>
        <li>
          <b>Shaft edges are zero-thickness boundaries.</b> The sanctioned plan shows no wall
          on those four lines, so none has been added. They follow the zone extents exactly.
        </li>
        <li>
          <b>Carpet areas are measured inside the wall faces.</b> Rev 4&rsquo;s published figures
          are measured to zone extents, so they read higher. Both are shown side by side in
          the schedules rather than one quietly replacing the other.
        </li>
        <li>
          <b>Doorway thresholds count as wall footprint.</b> That is the convention that
          makes carpet + walls + shafts reconcile exactly to the gross envelope.
        </li>
      </ul>

      <div className="callout">
        <b>The wall along the deck edge has been removed.</b>
        Rev 4 drew the external wall as a continuous 240 mm run right around the outline,
        including the full north face in front of the deck. Taken literally that put a blank
        3050 mm wall between the deck and the view. It is now deleted for the whole
        15 020 mm of deck and replaced by floor-to-canopy structural glazing on the building
        line, continuous with the barrel vault above.
        <br />
        <br />
        Two things corroborate that the wall was never intended. The deck's derived carpet
        area is now {sqFt(deck.area).toFixed(1)} sq ft against Rev 4's published 378 — it
        only reconciles with the wall gone. And nothing in the drawing puts an opening in
        that wall, which no habitable balcony would be built without.
        <br />
        <br />
        <b>The two private terraces have had the same treatment.</b> Each is a corner, so
        both exposed edges are glazed — leaving one side walled would be the same blank wall
        turned ninety degrees. They are not under the barrel vault, so their glass runs floor
        to ceiling and the terraces stay open to the sky. Each gains{' '}
        {(sqFt(pTerrace.area) - 25.0).toFixed(0)} sq ft, from 25.0 to{' '}
        {sqFt(pTerrace.area).toFixed(1)} sq ft, and now measures 3200 mm across against the
        Rev 4 note's 3120.
      </div>

      <div className="callout">
        <b>The glass roofs now land on the top of the walls.</b> The canopy previously met
        the building at 3400 mm, floating above the 3050 mm wall head, and the two flat pod
        roofs sat at 3070. All three are now at 3050, so the canopy and the flat roofs meet
        edge to edge on the wall line and read as one continuous glazed surface rather than
        three pieces at three levels.
      </div>

      <h2>Two things in Rev 4 worth a second look</h2>
      <p>
        Neither is a modelling error; both are in the drawing as issued.
      </p>
      <ul>
        <li>
          <b>Karan&rsquo;s pod hall is published at 96 sq ft, the same as the parents&rsquo;.</b> That
          figure is taken before the gear store is subtracted from it. Net of the gear store
          the hall is {sqFt(model.roomById.get('R-K-HALL')!.grossArea).toFixed(0)} sq ft
          gross, against the parents&rsquo;{' '}
          {sqFt(model.roomById.get('R-P-HALL')!.grossArea).toFixed(0)} sq ft.
        </li>
        <li>
          <b>The east bay is not centred on the mirror axis.</b> It spans x 3200–18600, whose
          midpoint is 10900, while the two wings mirror about 12240. So rooms touching the
          south edge — the walk-in wardrobes and the pod halls — genuinely differ between the
          wings. That comes from the sanctioned envelope, not from the design.
        </li>
      </ul>
    </div>
  )
}
