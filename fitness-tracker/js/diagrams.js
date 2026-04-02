// Exercise stick-figure diagrams
// Each value is inner SVG content for viewBox="0 0 120 90"
// Rendered with: stroke="var(--accent)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"

const DIAGRAMS = {

  // ── STANDING ─────────────────────────────────────────────────────────────

  standing:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="54"/>
     <line x1="60" y1="32" x2="42" y2="48"/>
     <line x1="60" y1="32" x2="78" y2="48"/>
     <line x1="60" y1="54" x2="50" y2="82"/>
     <line x1="60" y1="54" x2="70" y2="82"/>`,

  standing_arms_wide:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="54"/>
     <line x1="60" y1="34" x2="16" y2="40"/>
     <line x1="60" y1="34" x2="104" y2="40"/>
     <line x1="60" y1="54" x2="50" y2="82"/>
     <line x1="60" y1="54" x2="70" y2="82"/>`,

  standing_arms_overhead:
    `<circle cx="60" cy="18" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="26" x2="60" y2="58"/>
     <line x1="60" y1="34" x2="42" y2="20"/>
     <line x1="42" y1="20" x2="40" y2="6"/>
     <line x1="60" y1="34" x2="78" y2="20"/>
     <line x1="78" y1="20" x2="80" y2="6"/>
     <line x1="60" y1="58" x2="50" y2="82"/>
     <line x1="60" y1="58" x2="70" y2="82"/>`,

  standing_arm_curl:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="54"/>
     <line x1="60" y1="32" x2="42" y2="48"/>
     <line x1="60" y1="32" x2="80" y2="32"/>
     <line x1="80" y1="32" x2="82" y2="14"/>
     <line x1="60" y1="54" x2="50" y2="82"/>
     <line x1="60" y1="54" x2="70" y2="82"/>`,

  standing_arm_rotate:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="54"/>
     <line x1="60" y1="32" x2="42" y2="46"/>
     <line x1="60" y1="32" x2="82" y2="34"/>
     <line x1="82" y1="34" x2="96" y2="22"/>
     <line x1="60" y1="54" x2="50" y2="82"/>
     <line x1="60" y1="54" x2="70" y2="82"/>
     <path d="M88,28 A12,12 0 0,1 96,38" stroke-dasharray="3,2"/>`,

  standing_press_forward:
    `<circle cx="28" cy="18" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="28" y1="26" x2="28" y2="58"/>
     <line x1="28" y1="38" x2="92" y2="44"/>
     <line x1="28" y1="58" x2="18" y2="82"/>
     <line x1="28" y1="58" x2="38" y2="82"/>
     <rect x="96" y="30" width="6" height="42" rx="1"/>`,

  standing_one_leg:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="54"/>
     <line x1="60" y1="32" x2="42" y2="48"/>
     <line x1="60" y1="32" x2="78" y2="48"/>
     <line x1="60" y1="54" x2="52" y2="82"/>
     <line x1="60" y1="54" x2="72" y2="66"/>
     <line x1="72" y1="66" x2="84" y2="66"/>`,

  // ── LYING ON BACK (SUPINE) ────────────────────────────────────────────────

  lying_back:
    `<circle cx="14" cy="48" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="48" x2="90" y2="48"/>
     <line x1="40" y1="48" x2="34" y2="64"/>
     <line x1="40" y1="48" x2="48" y2="64"/>
     <line x1="90" y1="48" x2="100" y2="52"/>
     <line x1="90" y1="48" x2="106" y2="52"/>`,

  lying_back_bridge:
    `<circle cx="12" cy="62" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="20" y1="62" x2="46" y2="64"/>
     <line x1="46" y1="64" x2="62" y2="40"/>
     <line x1="62" y1="40" x2="84" y2="38"/>
     <line x1="84" y1="38" x2="92" y2="62"/>
     <line x1="92" y1="62" x2="108" y2="64"/>
     <line x1="30" y1="64" x2="26" y2="78"/>
     <line x1="5" y1="80" x2="115" y2="80"/>`,

  lying_back_leg_raise:
    `<circle cx="12" cy="52" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="20" y1="52" x2="72" y2="52"/>
     <line x1="38" y1="52" x2="30" y2="68"/>
     <line x1="38" y1="52" x2="44" y2="68"/>
     <line x1="72" y1="52" x2="84" y2="78"/>
     <line x1="72" y1="52" x2="92" y2="24"/>`,

  lying_back_dead_bug:
    `<circle cx="12" cy="50" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="20" y1="50" x2="72" y2="50"/>
     <line x1="36" y1="50" x2="26" y2="26"/>
     <line x1="36" y1="50" x2="50" y2="70"/>
     <line x1="72" y1="50" x2="98" y2="36"/>
     <line x1="72" y1="50" x2="58" y2="70"/>`,

  lying_back_knees_up:
    `<circle cx="12" cy="50" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="20" y1="50" x2="70" y2="50"/>
     <line x1="36" y1="50" x2="30" y2="66"/>
     <line x1="36" y1="50" x2="44" y2="66"/>
     <line x1="70" y1="50" x2="84" y2="36"/>
     <line x1="84" y1="36" x2="98" y2="54"/>
     <line x1="70" y1="50" x2="78" y2="36"/>
     <line x1="78" y1="36" x2="92" y2="54"/>`,

  // ── PRONE (FACE DOWN) ────────────────────────────────────────────────────

  lying_prone:
    `<circle cx="14" cy="44" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="46" x2="88" y2="50"/>
     <line x1="42" y1="48" x2="36" y2="62"/>
     <line x1="42" y1="48" x2="48" y2="62"/>
     <line x1="88" y1="50" x2="96" y2="28"/>
     <line x1="88" y1="50" x2="104" y2="54"/>`,

  // ── SIDE-LYING ────────────────────────────────────────────────────────────

  lying_side_clamshell:
    `<circle cx="14" cy="40" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="44" x2="78" y2="52"/>
     <line x1="40" y1="46" x2="30" y2="62"/>
     <line x1="78" y1="52" x2="100" y2="34"/>
     <line x1="78" y1="52" x2="106" y2="58"/>`,

  side_plank:
    `<circle cx="18" cy="28" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="26" y1="34" x2="90" y2="60"/>
     <line x1="26" y1="34" x2="26" y2="60"/>
     <line x1="26" y1="60" x2="46" y2="60"/>
     <line x1="54" y1="46" x2="54" y2="26"/>
     <line x1="90" y1="60" x2="112" y2="66"/>`,

  thoracic_rotation:
    `<circle cx="14" cy="42" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="46" x2="70" y2="52"/>
     <line x1="40" y1="48" x2="32" y2="64"/>
     <line x1="70" y1="52" x2="84" y2="66"/>
     <line x1="70" y1="52" x2="92" y2="60"/>
     <line x1="42" y1="46" x2="56" y2="30"/>
     <line x1="56" y1="30" x2="98" y2="22"/>`,

  // ── ALL FOURS ─────────────────────────────────────────────────────────────

  all_fours:
    `<circle cx="18" cy="35" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="26" y1="40" x2="78" y2="40"/>
     <line x1="30" y1="40" x2="30" y2="62"/>
     <line x1="30" y1="62" x2="46" y2="62"/>
     <line x1="74" y1="40" x2="74" y2="62"/>
     <line x1="74" y1="62" x2="92" y2="62"/>`,

  bird_dog:
    `<circle cx="18" cy="35" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="26" y1="40" x2="78" y2="40"/>
     <line x1="30" y1="40" x2="6" y2="28"/>
     <line x1="30" y1="40" x2="30" y2="62"/>
     <line x1="30" y1="62" x2="46" y2="62"/>
     <line x1="74" y1="40" x2="74" y2="62"/>
     <line x1="74" y1="62" x2="90" y2="62"/>
     <line x1="74" y1="40" x2="106" y2="28"/>`,

  plank:
    `<circle cx="16" cy="35" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="24" y1="40" x2="92" y2="44"/>
     <line x1="24" y1="40" x2="26" y2="58"/>
     <line x1="26" y1="58" x2="50" y2="58"/>
     <line x1="92" y1="44" x2="108" y2="50"/>`,

  ab_wheel:
    `<circle cx="22" cy="30" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="30" y1="36" x2="58" y2="52"/>
     <line x1="30" y1="36" x2="72" y2="28"/>
     <line x1="58" y1="52" x2="60" y2="68"/>
     <line x1="60" y1="68" x2="96" y2="68"/>
     <circle cx="96" cy="64" r="7"/>`,

  // ── SEATED ────────────────────────────────────────────────────────────────

  seated:
    `<circle cx="50" cy="16" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="50" y1="24" x2="50" y2="52"/>
     <line x1="50" y1="34" x2="32" y2="48"/>
     <line x1="50" y1="34" x2="68" y2="48"/>
     <line x1="50" y1="52" x2="86" y2="52"/>
     <line x1="86" y1="52" x2="90" y2="78"/>
     <line x1="28" y1="52" x2="24" y2="78"/>
     <line x1="16" y1="54" x2="100" y2="54"/>`,

  rowing_machine:
    `<circle cx="58" cy="24" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="58" y1="32" x2="62" y2="56"/>
     <line x1="58" y1="38" x2="30" y2="46"/>
     <line x1="30" y1="46" x2="14" y2="52"/>
     <line x1="62" y1="56" x2="80" y2="56"/>
     <line x1="80" y1="56" x2="86" y2="72"/>
     <line x1="86" y1="72" x2="106" y2="72"/>
     <line x1="8" y1="56" x2="114" y2="56"/>
     <line x1="8" y1="72" x2="114" y2="72"/>`,

  sitting_breathing:
    `<circle cx="50" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="50" y1="22" x2="50" y2="52"/>
     <line x1="50" y1="34" x2="34" y2="48"/>
     <line x1="50" y1="34" x2="66" y2="48"/>
     <line x1="50" y1="52" x2="82" y2="52"/>
     <line x1="82" y1="52" x2="86" y2="76"/>
     <line x1="28" y1="52" x2="24" y2="76"/>
     <line x1="14" y1="54" x2="98" y2="54"/>
     <line x1="14" y1="76" x2="98" y2="76"/>`,

  // ── BENT OVER ─────────────────────────────────────────────────────────────

  bent_over_row:
    `<circle cx="24" cy="28" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="24" y1="36" x2="24" y2="60"/>
     <line x1="24" y1="60" x2="78" y2="48"/>
     <line x1="78" y1="48" x2="74" y2="72"/>
     <line x1="78" y1="48" x2="86" y2="72"/>
     <line x1="24" y1="60" x2="16" y2="72"/>
     <line x1="24" y1="48" x2="64" y2="44"/>
     <line x1="64" y1="44" x2="78" y2="30"/>`,

  lean_forward_pendulum:
    `<circle cx="30" cy="18" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="30" y1="26" x2="30" y2="50"/>
     <line x1="30" y1="50" x2="82" y2="48"/>
     <line x1="72" y1="48" x2="72" y2="64"/>
     <line x1="72" y1="64" x2="92" y2="64"/>
     <line x1="30" y1="50" x2="22" y2="78"/>
     <line x1="30" y1="50" x2="40" y2="78"/>
     <line x1="30" y1="40" x2="14" y2="80"/>`,

  // ── WALL ─────────────────────────────────────────────────────────────────

  wall_sit:
    `<rect x="5" y="4" width="5" height="82" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <circle cx="28" cy="16" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="28" y1="24" x2="28" y2="54"/>
     <line x1="28" y1="54" x2="76" y2="54"/>
     <line x1="76" y1="54" x2="76" y2="82"/>
     <line x1="5" y1="82" x2="112" y2="82"/>`,

  wall_slides:
    `<rect x="5" y="4" width="5" height="82" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <circle cx="30" cy="16" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="30" y1="24" x2="30" y2="58"/>
     <line x1="30" y1="34" x2="10" y2="24"/>
     <line x1="10" y1="24" x2="10" y2="10"/>
     <line x1="30" y1="34" x2="44" y2="26"/>
     <line x1="44" y1="26" x2="44" y2="10"/>
     <line x1="30" y1="58" x2="20" y2="82"/>
     <line x1="30" y1="58" x2="40" y2="82"/>`,

  // ── KNEELING / LUNGE ─────────────────────────────────────────────────────

  kneeling_lunge:
    `<circle cx="52" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="52" y1="22" x2="52" y2="50"/>
     <line x1="52" y1="34" x2="36" y2="46"/>
     <line x1="52" y1="50" x2="28" y2="50"/>
     <line x1="28" y1="50" x2="20" y2="78"/>
     <line x1="52" y1="50" x2="80" y2="56"/>
     <line x1="80" y1="56" x2="80" y2="82"/>
     <line x1="5" y1="82" x2="115" y2="82"/>`,

  // ── SQUAT / LOWER BODY ────────────────────────────────────────────────────

  squat:
    `<circle cx="60" cy="16" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="24" x2="60" y2="50"/>
     <line x1="60" y1="32" x2="46" y2="42"/>
     <line x1="46" y1="42" x2="40" y2="50"/>
     <line x1="60" y1="32" x2="74" y2="42"/>
     <line x1="74" y1="42" x2="80" y2="50"/>
     <rect x="44" y="48" width="32" height="8" rx="2"/>
     <line x1="60" y1="50" x2="38" y2="68"/>
     <line x1="38" y1="68" x2="32" y2="82"/>
     <line x1="60" y1="50" x2="82" y2="68"/>
     <line x1="82" y1="68" x2="88" y2="82"/>`,

  step_up:
    `<circle cx="46" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="46" y1="22" x2="46" y2="52"/>
     <line x1="46" y1="34" x2="30" y2="48"/>
     <line x1="46" y1="34" x2="62" y2="46"/>
     <line x1="46" y1="52" x2="62" y2="52"/>
     <line x1="62" y1="52" x2="66" y2="70"/>
     <line x1="46" y1="52" x2="36" y2="72"/>
     <line x1="36" y1="72" x2="30" y2="82"/>
     <rect x="56" y="70" width="58" height="12" rx="2"/>
     <line x1="5" y1="82" x2="55" y2="82"/>`,

  // ── STRETCHING / MOBILITY ─────────────────────────────────────────────────

  hamstring_stretch_lying:
    `<circle cx="12" cy="52" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="20" y1="52" x2="72" y2="52"/>
     <line x1="38" y1="52" x2="30" y2="68"/>
     <line x1="38" y1="52" x2="44" y2="68"/>
     <line x1="72" y1="52" x2="82" y2="76"/>
     <line x1="72" y1="52" x2="96" y2="22"/>
     <line x1="82" y1="32" x2="98" y2="20"/>`,

  worlds_greatest_stretch:
    `<circle cx="55" cy="18" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="55" y1="26" x2="50" y2="52"/>
     <line x1="55" y1="30" x2="40" y2="22"/>
     <line x1="55" y1="30" x2="76" y2="42"/>
     <line x1="50" y1="52" x2="26" y2="52"/>
     <line x1="26" y1="52" x2="18" y2="78"/>
     <line x1="50" y1="52" x2="78" y2="58"/>
     <line x1="78" y1="58" x2="80" y2="80"/>
     <line x1="5" y1="80" x2="115" y2="80"/>`,

  foam_roller:
    `<circle cx="14" cy="40" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="44" x2="86" y2="52"/>
     <line x1="40" y1="46" x2="34" y2="62"/>
     <line x1="86" y1="52" x2="98" y2="44"/>
     <line x1="86" y1="52" x2="106" y2="58"/>
     <ellipse cx="60" cy="64" rx="54" ry="10"/>`,

  // ── CARDIO EQUIPMENT ─────────────────────────────────────────────────────

  elliptical:
    `<circle cx="60" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="60" y1="22" x2="60" y2="48"/>
     <line x1="60" y1="32" x2="38" y2="44"/>
     <line x1="38" y1="44" x2="22" y2="30"/>
     <line x1="60" y1="32" x2="82" y2="44"/>
     <line x1="82" y1="44" x2="98" y2="30"/>
     <line x1="60" y1="48" x2="44" y2="62"/>
     <line x1="44" y1="62" x2="36" y2="80"/>
     <line x1="60" y1="48" x2="76" y2="62"/>
     <line x1="76" y1="62" x2="84" y2="80"/>
     <ellipse cx="60" cy="82" rx="46" ry="5"/>`,

  walking:
    `<circle cx="55" cy="14" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="55" y1="22" x2="55" y2="52"/>
     <line x1="55" y1="32" x2="36" y2="44"/>
     <line x1="55" y1="32" x2="74" y2="42"/>
     <line x1="55" y1="52" x2="42" y2="70"/>
     <line x1="42" y1="70" x2="28" y2="82"/>
     <line x1="55" y1="52" x2="68" y2="64"/>
     <line x1="68" y1="64" x2="86" y2="54"/>
     <line x1="5" y1="82" x2="82" y2="82"/>`,

  yoga_child:
    `<circle cx="82" cy="42" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="74" y1="46" x2="44" y2="52"/>
     <line x1="44" y1="52" x2="16" y2="58"/>
     <line x1="16" y1="58" x2="6" y2="58"/>
     <line x1="44" y1="52" x2="50" y2="72"/>
     <line x1="50" y1="72" x2="56" y2="80"/>
     <line x1="50" y1="72" x2="38" y2="76"/>
     <line x1="5" y1="80" x2="115" y2="80"/>`,

  push_up:
    `<circle cx="14" cy="34" r="8" fill="var(--accent)" opacity=".2" stroke="var(--accent)"/>
     <line x1="22" y1="38" x2="90" y2="44"/>
     <line x1="28" y1="38" x2="28" y2="60"/>
     <line x1="28" y1="60" x2="44" y2="60"/>
     <line x1="84" y1="42" x2="84" y2="60"/>
     <line x1="84" y1="60" x2="100" y2="60"/>
     <line x1="90" y1="44" x2="110" y2="50"/>
     <line x1="5" y1="60" x2="115" y2="60"/>`,

};

function renderDiagram(diagramId) {
  const d = DIAGRAMS[diagramId];
  if (!d) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" class="ex-diagram">
    <g stroke="var(--accent)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">${d}</g>
  </svg>`;
}
