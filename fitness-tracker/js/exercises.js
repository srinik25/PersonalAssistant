// Fitness Tracker — Exercise Database + Weekly Plan
// Profile: 53yo male, 147lb/5'11", cardiac rehab (stent+MI), knee pain, frozen shoulder, diabetes mgmt
// Max HR: 145 bpm | RHR: 55-60 bpm | Zone 2 target: 87-105 bpm (60–72% of max HR 145)

const EXERCISES = [
  // ── CARDIO ──────────────────────────────────────────────────────────────
  {
    id: 'elliptical_z2',
    name: 'Elliptical — Zone 2',
    category: 'cardio',
    complexity: 'simple',
    setsReps: '25–35 min',
    diagramId: 'elliptical',
    hrZone: { label: 'Zone 2', min: 87, max: 105 },
    description: 'Low-impact, knee-friendly. Keep RPE ~5/10 — conversational pace. Arms active, slight forward lean.',
    formCues: ['Upright posture, slight forward lean', 'Push through heel not toe', 'Arm push-pull matches leg stride', 'If HR > 120 slow down'],
    videoUrl: 'https://www.youtube.com/results?search_query=elliptical+proper+form+technique',
    notes: 'Best cardio option with knee pain. No impact stress.'
  },
  {
    id: 'rowing_z2',
    name: 'Rowing Machine — Zone 2',
    category: 'cardio',
    complexity: 'moderate',
    setsReps: '15–20 min',
    diagramId: 'rowing_machine',
    hrZone: { label: 'Zone 2', min: 87, max: 105 },
    description: 'Full-body low-impact cardio. Excellent for upper body & core. Keep HR under 120.',
    formCues: ['Drive with legs first, then lean back, then arms', 'Catch: shins vertical, arms straight', 'Finish: elbows past ribs, slight recline', 'Drive quick and powerful, return slow and controlled — 1:2 ratio'],
    videoUrl: 'https://www.youtube.com/results?search_query=rowing+machine+proper+form+beginners',
    notes: 'Avoid if shoulder flares. Modify grip if frozen shoulder limits reach.'
  },
  {
    id: 'walking_incline',
    name: 'Incline Walking',
    category: 'cardio',
    complexity: 'simple',
    setsReps: '20–30 min, 3–5% incline',
    diagramId: 'walking',
    hrZone: { label: 'Zone 2', min: 87, max: 105 },
    description: 'Gentle cardio that also activates glutes. Low knee stress at moderate incline.',
    formCues: ['Don\'t hold handrails — engage core', 'Heel strike, roll to toe', 'Arms swing naturally', 'Incline > 5% increases knee load — stay moderate'],
    videoUrl: 'https://www.youtube.com/results?search_query=incline+treadmill+walking+form+benefits',
    notes: 'Good warmup or standalone session. Builds hiking endurance.'
  },
  {
    id: 'stationary_bike',
    name: 'Stationary Bike',
    category: 'cardio',
    complexity: 'simple',
    setsReps: '20–30 min',
    diagramId: 'seated',
    hrZone: { label: 'Zone 2', min: 87, max: 105 },
    description: 'Excellent knee rehab cardio. Zero impact. Adjust seat so knee has slight bend at bottom.',
    formCues: ['Seat height: slight knee bend at bottom of pedal stroke', 'Don\'t lock out knee', 'Moderate resistance — not grinding', 'Cadence ~70-90 rpm'],
    videoUrl: 'https://www.youtube.com/results?search_query=stationary+bike+proper+seat+height+form',
    notes: 'If elliptical unavailable, this is the top knee-safe alternative.'
  },

  // ── UPPER BODY ───────────────────────────────────────────────────────────
  {
    id: 'db_chest_press',
    name: 'Dumbbell Chest Press',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 10–12',
    diagramId: 'lying_back',
    description: 'Primary chest + tricep exercise. Bench allows greater range than floor press.',
    formCues: ['Feet flat on floor', 'Elbows 45° from torso (not flared out)', 'Lower to chest level, press up and slightly in', 'Shoulder blades pinched together throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=dumbbell+chest+press+proper+form',
    notes: 'Frozen shoulder: reduce range of motion, keep elbows closer to body if needed.'
  },
  {
    id: 'db_row',
    name: 'Single-Arm Dumbbell Row',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 10–12 each arm',
    diagramId: 'bent_over_row',
    description: 'Best back exercise for frozen shoulder — unilateral, full control. Builds lats and rhomboids.',
    formCues: ['Support with opposite hand on bench', 'Row elbow straight back past hip', 'Don\'t rotate torso excessively', 'Squeeze lat at top, lower slowly'],
    videoUrl: 'https://www.youtube.com/results?search_query=single+arm+dumbbell+row+proper+form',
    notes: 'Modify range if shoulder restricts. Pain-free ROM only.'
  },
  {
    id: 'band_pull_apart',
    name: 'Band Pull-Apart',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15–20',
    diagramId: 'standing_arms_wide',
    description: 'Shoulder rehab staple. Strengthens rear deltoids, improves posture, helps frozen shoulder.',
    formCues: ['Hold band in front at shoulder height, arms straight', 'Pull band apart until it reaches chest, squeezing shoulder blades', 'Control the return slowly', 'Keep wrists neutral throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=resistance+band+pull+apart+shoulder+rehab',
    notes: 'Excellent daily exercise for frozen shoulder. Use light band.'
  },
  {
    id: 'band_external_rotation',
    name: 'Band External Rotation',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15 each arm',
    diagramId: 'standing_arm_rotate',
    description: 'Rotator cuff rehab for frozen shoulder. Core exercise for shoulder health.',
    formCues: ['Elbow at side, 90° bend', 'Rotate forearm away from body against band resistance', 'Keep elbow pressed to side throughout', 'Small, controlled movement — stop at discomfort'],
    videoUrl: 'https://www.youtube.com/results?search_query=band+external+rotation+shoulder+rehab+exercise',
    notes: 'Critical for frozen shoulder recovery. Do this daily if possible.'
  },
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press (Seated)',
    category: 'upper',
    complexity: 'moderate',
    setsReps: '3 × 10',
    diagramId: 'seated',
    description: 'Overhead pressing builds shoulder strength. Use modified range for frozen shoulder.',
    formCues: ['Seated with back supported', 'Start at ear level, press upward', 'If shoulder restricts: press only to forehead level', 'Don\'t arch lower back'],
    videoUrl: 'https://www.youtube.com/results?search_query=seated+dumbbell+shoulder+press+form',
    notes: 'Reduce range of motion significantly if frozen shoulder limits overhead reach.'
  },
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12–15',
    diagramId: 'standing_arms_wide',
    description: 'Side deltoid development. Keep weight very light to protect the shoulder.',
    formCues: ['Slight forward lean from hips', 'Raise arms to shoulder height — no higher', 'Lead with elbow, not wrist', 'Lower slowly — 3 seconds down'],
    videoUrl: 'https://www.youtube.com/results?search_query=dumbbell+lateral+raise+proper+form',
    notes: 'Use very light weight (5–8 lb). Raising above shoulder height stresses the rotator cuff — stop at shoulder level.'
  },
  {
    id: 'tricep_overhead_ext',
    name: 'Tricep Overhead Extension',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12',
    diagramId: 'standing_arms_overhead',
    description: 'Tricep isolation exercise that strengthens the long head of the tricep.',
    formCues: ['Hold one dumbbell with both hands overhead', 'Lower behind head keeping elbows pointing up', 'Extend back to start, squeeze at top', 'Keep upper arms still — only forearms move'],
    videoUrl: 'https://www.youtube.com/results?search_query=overhead+tricep+extension+dumbbell+form',
    notes: 'Skip if shoulder position is uncomfortable due to frozen shoulder. Replace with band pushdown.'
  },
  {
    id: 'band_pushdown',
    name: 'Band Tricep Pushdown',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15',
    diagramId: 'standing',
    description: 'Shoulder-friendly tricep isolation. Band anchored at head height or above.',
    formCues: ['Elbows pinned to sides — don\'t let them flare', 'Push down and fully extend, squeeze at bottom', 'Slow controlled return — 2 seconds up', 'No swinging or leaning'],
    videoUrl: 'https://www.youtube.com/results?search_query=resistance+band+tricep+pushdown+form',
    notes: 'Best frozen-shoulder-safe tricep option. Preferred over overhead extension if shoulder is a concern.'
  },
  {
    id: 'pushups',
    name: 'Push-Ups',
    category: 'upper',
    complexity: 'moderate',
    setsReps: '3 × 8–15',
    diagramId: 'push_up',
    description: 'Bodyweight compound movement for chest, shoulders, and triceps. Highly modifiable.',
    formCues: ['Hands slightly wider than shoulders', 'Body forms a straight line — no sagging hips', 'Elbows at 45° from torso, not flared wide', 'Lower chest to 1 inch from floor', 'Exhale on the way up'],
    videoUrl: 'https://www.youtube.com/results?search_query=push+up+proper+form+tutorial',
    notes: 'Start with wall or incline push-ups (hands on bench) if full push-ups are too hard or shoulder flares. Reduce range of motion if needed.'
  },
  {
    id: 'db_curl',
    name: 'Dumbbell Bicep Curl',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12',
    diagramId: 'standing_arm_curl',
    description: 'Classic bicep builder. Supinate the wrist at the top for full contraction.',
    formCues: ['Elbows remain at sides throughout', 'Rotate palm upward as you curl', 'Squeeze bicep at top', 'Lower fully — 2 second descent'],
    videoUrl: 'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+proper+form',
    notes: 'Alternate arms for better mind-muscle connection and control.'
  },
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    category: 'upper',
    complexity: 'moderate',
    setsReps: '3 × 10',
    diagramId: 'lying_back',
    description: 'Upper chest emphasis. Often more shoulder-friendly than flat press at 30–45°.',
    formCues: ['Bench at 30–45°', 'Press up and slightly inward at the top', 'Elbows at 45° from torso', 'Don\'t lock out elbows at top'],
    videoUrl: 'https://www.youtube.com/results?search_query=incline+dumbbell+press+form+technique',
    notes: 'Adjust bench angle based on shoulder comfort. Lower angle = more chest, higher = more shoulder.'
  },

  // ── CORE ─────────────────────────────────────────────────────────────────
  {
    id: 'dead_bug',
    name: 'Dead Bug',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 8–10 each side',
    diagramId: 'lying_back_dead_bug',
    description: 'One of the safest core exercises — no spinal flexion. Trains abs, obliques, and deep stabilizers.',
    formCues: ['Lie on back, arms vertical, knees at 90° over hips', 'Press lower back firmly into floor — maintain throughout', 'Lower opposite arm and leg slowly (4 counts)', 'Return and switch sides — exhale on the way down'],
    videoUrl: 'https://www.youtube.com/results?search_query=dead+bug+exercise+form+tutorial',
    notes: 'No spinal flexion = no Valsalva risk = safe for post-cardiac patients. Start here before any crunch-based work.'
  },
  {
    id: 'plank',
    name: 'Forearm Plank',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 20–40 sec',
    diagramId: 'plank',
    description: 'Full core activation without spinal flexion. Strengthens deep stabilizing muscles.',
    formCues: ['Elbows directly under shoulders', 'Neutral spine — no sagging hips, no raised glutes', 'Squeeze glutes and abs simultaneously', 'Breathe normally — don\'t hold your breath'],
    videoUrl: 'https://www.youtube.com/results?search_query=forearm+plank+proper+form+tutorial',
    notes: 'Progress duration gradually. Use kneeling version if shoulder discomfort occurs.'
  },
  {
    id: 'side_plank',
    name: 'Side Plank',
    category: 'core',
    complexity: 'moderate',
    setsReps: '3 × 15–25 sec each side',
    diagramId: 'side_plank',
    description: 'Oblique and lateral core strength. Important for spine and hip stability.',
    formCues: ['Elbow directly under shoulder', 'Hips stacked and lifted — don\'t let them sag', 'Top arm rests on hip or reaches to ceiling', 'Body forms a straight diagonal line'],
    videoUrl: 'https://www.youtube.com/results?search_query=side+plank+form+tutorial+benefits',
    notes: 'Start with kneeling side plank if needed. Lateral stability directly supports knee health.'
  },
  {
    id: 'pallof_press',
    name: 'Pallof Press (Band)',
    category: 'core',
    complexity: 'moderate',
    setsReps: '3 × 10 each side',
    diagramId: 'standing_press_forward',
    description: 'Anti-rotation core stability exercise. Trains the core to resist twisting forces.',
    formCues: ['Band anchored at chest height beside you', 'Hold band at sternum, then press straight out in front', 'Hold 2 sec — resist the rotation pull', 'Return slowly to chest'],
    videoUrl: 'https://www.youtube.com/results?search_query=pallof+press+resistance+band+form',
    notes: 'One of the best functional core exercises. No spinal flexion — safe for all fitness levels.'
  },
  {
    id: 'ab_wheel_kneeling',
    name: 'Ab Wheel Rollout (Kneeling)',
    category: 'core',
    complexity: 'complex',
    setsReps: '3 × 6–8',
    diagramId: 'ab_wheel',
    description: 'Advanced core exercise. Highly effective for rectus abdominis when done with controlled range.',
    formCues: ['Start kneeling, ab wheel directly below shoulders', 'Roll forward only until lower back is about to arch — then stop', 'Pull back using core and lats, not arms', 'Keep glutes squeezed throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=ab+wheel+rollout+proper+form+kneeling',
    notes: 'Start with very short range (6–8 inches). Never allow lower back to arch — that is the hard stop.'
  },
  {
    id: 'bird_dog',
    name: 'Bird Dog',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 10 each side',
    diagramId: 'bird_dog',
    description: 'Core stability and glute activation. Excellent for spine health with no joint stress.',
    formCues: ['On all fours — wrists under shoulders, knees under hips', 'Maintain neutral (flat) back throughout', 'Extend opposite arm and leg simultaneously', 'Hold 2 sec at top — don\'t let hips rotate'],
    videoUrl: 'https://www.youtube.com/results?search_query=bird+dog+exercise+form+tutorial',
    notes: 'Excellent warm-up exercise. Glute activation from this exercise also protects the knee.'
  },

  // ── LOWER BODY / KNEE REHAB ──────────────────────────────────────────────
  {
    id: 'wall_sit',
    name: 'Wall Sit',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 20–40 sec',
    diagramId: 'wall_sit',
    description: 'Isometric quad strengthening with no joint movement — ideal for knee pain.',
    formCues: ['Back fully flat against wall', 'Thighs at or above parallel to floor', 'Feet shoulder-width apart, toes slightly out', 'Weight in heels — push back into wall'],
    videoUrl: 'https://www.youtube.com/results?search_query=wall+sit+proper+form+knee+rehab',
    notes: 'Higher thigh angle (less depth) = less knee stress. Increase depth only as pain allows.'
  },
  {
    id: 'straight_leg_raise',
    name: 'Straight Leg Raise',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15 each leg',
    diagramId: 'lying_back_leg_raise',
    description: 'Strengthens quads without any knee bending. The foundational PT exercise for knee pain.',
    formCues: ['Lie on back, bend non-working knee for lumbar support', 'Tighten quad of straight leg before lifting', 'Raise leg to ~45°, hold 1 sec at top', 'Lower slowly — 3 seconds down'],
    videoUrl: 'https://www.youtube.com/results?search_query=straight+leg+raise+exercise+knee+rehab+form',
    notes: 'The most important starting point for knee rehab. Begin every lower body session with this.'
  },
  {
    id: 'clamshells',
    name: 'Clamshells',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15–20 each side',
    diagramId: 'lying_side_clamshell',
    description: 'Activates glute medius and hip abductors — critical for proper knee tracking.',
    formCues: ['Side-lying, knees bent to 45°, hips stacked', 'Rotate top knee upward without rolling the pelvis back', 'Squeeze glute at top, hold 1 sec', 'Lower slowly and repeat'],
    videoUrl: 'https://www.youtube.com/results?search_query=clamshell+exercise+hip+abductor+form',
    notes: 'Add a light resistance band above the knee for progression. Weak glute medius is a primary cause of knee pain.'
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15',
    diagramId: 'lying_back_bridge',
    description: 'Hip extension that strengthens glutes and hamstrings — reduces knee load significantly.',
    formCues: ['Lie on back, knees bent, feet flat and hip-width apart', 'Drive hips up by squeezing glutes — not by arching back', 'At top: straight line from knees to shoulders', 'Hold 2 sec, lower over 3 seconds'],
    videoUrl: 'https://www.youtube.com/results?search_query=glute+bridge+proper+form+tutorial',
    notes: 'Strong glutes are the single best protection for the knee. Progress to single-leg bridge when comfortable.'
  },
  {
    id: 'single_leg_bridge',
    name: 'Single-Leg Glute Bridge',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12 each side',
    diagramId: 'lying_back_bridge',
    description: 'Unilateral hip extension — greater glute activation and reveals strength asymmetries.',
    formCues: ['One foot flat on floor, other leg extended or lifted', 'Drive through the planted heel to raise hips', 'Don\'t let hips rotate or drop to one side', 'Squeeze working glute at top'],
    videoUrl: 'https://www.youtube.com/results?search_query=single+leg+glute+bridge+form+tutorial',
    notes: 'Build bilateral glute bridge first. Side-to-side strength imbalances often contribute to knee pain.'
  },
  {
    id: 'step_up',
    name: 'Step-Up (Low Box)',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12 each leg',
    diagramId: 'step_up',
    description: 'Functional quad and glute strengthener. More knee-friendly than squats when done correctly.',
    formCues: ['Use a 6–8 inch step to start — progress height over time', 'Step up, drive through heel of the raised foot', 'Don\'t push off the back foot — let the front leg do the work', 'Step down with control'],
    videoUrl: 'https://www.youtube.com/results?search_query=step+up+exercise+proper+form+knee+friendly',
    notes: 'Hold dumbbells for added load once bodyweight is comfortable. Excellent for hiking preparation.'
  },
  {
    id: 'terminal_knee_ext',
    name: 'Terminal Knee Extension (Band)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15 each leg',
    diagramId: 'standing_one_leg',
    description: 'Activates the VMO (inner quad tear drop) which stabilizes and tracks the kneecap.',
    formCues: ['Loop band behind knee, anchor point in front of you', 'Stand with slight knee bend, both feet on ground', 'Straighten the knee fully against band resistance — do not hyperextend', 'Hold 1 sec, release slowly'],
    videoUrl: 'https://www.youtube.com/results?search_query=terminal+knee+extension+band+VMO+exercise',
    notes: 'One of the most effective exercises for patellofemoral (kneecap) pain. Can be done daily.'
  },
  {
    id: 'hamstring_curl_band',
    name: 'Hamstring Curl (Band)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 12–15 each leg',
    diagramId: 'lying_prone',
    description: 'Isolates the hamstrings — tight hamstrings are a direct contributor to knee pain.',
    formCues: ['Lie face down, band looped around ankle anchored in front', 'Curl heel toward glute — controlled 2 seconds up', 'Hold 1 sec at top, lower over 3 seconds', 'Don\'t let hips lift off the floor'],
    videoUrl: 'https://www.youtube.com/results?search_query=lying+hamstring+curl+resistance+band+form',
    notes: 'Follow with a standing calf stretch — calves and hamstrings form a connected posterior chain.'
  },
  {
    id: 'hip_flexor_stretch',
    name: 'Hip Flexor Stretch (Kneeling)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 30–45 sec each side',
    diagramId: 'kneeling_lunge',
    description: 'Tight hip flexors anteriorly tilt the pelvis and increase knee stress. This stretch is essential.',
    formCues: ['Back knee on padded surface, front foot forward', 'Posteriorly tilt pelvis (tuck tailbone under)', 'Feel the stretch at the front of the back hip — not the lower back', 'Keep torso upright — don\'t lean forward'],
    videoUrl: 'https://www.youtube.com/results?search_query=kneeling+hip+flexor+stretch+proper+form',
    notes: 'Perform every session. Tight hip flexors (common from sitting) directly stress the knee joint.'
  },
  {
    id: 'calf_raise',
    name: 'Calf Raise',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15–20',
    diagramId: 'standing',
    description: 'Strengthens gastrocnemius and soleus. Ankle stability and calf tightness both affect the knee.',
    formCues: ['Stand on a step edge (or flat ground) with balls of feet', 'Rise up fully through the big toe side', 'Lower slowly past neutral — full range', 'Hold at top for 1 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=calf+raise+proper+form+tutorial',
    notes: 'Single-leg version for progression. Post-meal calf raises are clinically shown to reduce blood glucose spikes.'
  },
  {
    id: 'adductor_squeeze',
    name: 'Adductor Ball Squeeze',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15',
    diagramId: 'lying_back_knees_up',
    description: 'Isometric inner thigh activation. Tight or weak adductors affect knee joint stability.',
    formCues: ['Lie on back, knees bent, feet flat', 'Place a rolled towel or soft ball between knees', 'Squeeze inward isometrically — hold 3 sec', 'Release slowly and repeat'],
    videoUrl: 'https://www.youtube.com/results?search_query=adductor+squeeze+inner+thigh+knee+stability',
    notes: 'Gentle and joint-friendly. Great for addressing inner thigh tightness that pulls the knee inward.'
  },
  {
    id: 'db_goblet_squat',
    name: 'Goblet Squat (Dumbbell)',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12',
    diagramId: 'squat',
    description: 'The most knee-friendly squat variation. Counterbalance weight improves depth and posture.',
    formCues: ['Hold dumbbell at chest, elbows pointing down', 'Feet shoulder-width, toes angled out 30°', 'Sit back and down — weight stays in heels', 'Knees track over toes — don\'t let them cave inward', 'Go only as deep as pain-free allows'],
    videoUrl: 'https://www.youtube.com/results?search_query=goblet+squat+proper+form+tutorial',
    notes: 'Earn this exercise first with pain-free wall sits and step-ups. Range of motion = pain-free range only.'
  },

  // ── FLEXIBILITY / MOBILITY ────────────────────────────────────────────────
  {
    id: 'worlds_greatest_stretch',
    name: "World's Greatest Stretch",
    category: 'mobility',
    complexity: 'moderate',
    setsReps: '5 reps each side',
    diagramId: 'worlds_greatest_stretch',
    description: 'One movement addresses hip flexors, adductors, thoracic spine, and hamstrings simultaneously.',
    formCues: ['Step into a deep lunge — front shin vertical', 'Place same-side hand inside the front foot on the floor', 'Rotate top arm open toward the ceiling, eyes follow', 'Then sweep that arm under body and reach through', 'Hold each position 2–3 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=worlds+greatest+stretch+form+tutorial',
    notes: 'Ideal daily warm-up. Addresses nearly every tight area relevant to your profile in one sequence.'
  },
  {
    id: 'hamstring_stretch',
    name: 'Hamstring Stretch (Lying)',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '3 × 30 sec each leg',
    diagramId: 'hamstring_stretch_lying',
    description: 'Tight hamstrings contribute directly to knee pain and lower back tension.',
    formCues: ['Lie on back, keep non-stretched knee bent with foot flat', 'Pull straight leg upward — use a strap or towel if needed', 'Keep both hips firmly on the floor', 'Breathe out slowly into the stretch — no bouncing'],
    videoUrl: 'https://www.youtube.com/results?search_query=lying+hamstring+stretch+proper+form',
    notes: 'Daily consistency matters more than intensity. A gentle daily stretch outperforms an aggressive weekly one.'
  },
  {
    id: 'thoracic_rotation',
    name: 'Thoracic Spine Rotation',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 × 10 each side',
    diagramId: 'thoracic_rotation',
    description: 'Improves thoracic (upper back) rotation — reduces compensatory stress on the frozen shoulder.',
    formCues: ['Side-lying, hips and knees at 90°, arms stacked in front', 'Slowly rotate top arm open to the opposite side', 'Let your eyes and head follow the moving arm', 'Hold at end range 2 sec — breathe out'],
    videoUrl: 'https://www.youtube.com/results?search_query=thoracic+rotation+mobility+exercise+form',
    notes: 'Upper back stiffness forces the shoulder to compensate — improving thoracic rotation takes load off the frozen shoulder.'
  },
  {
    id: 'pendulum_shoulder',
    name: 'Pendulum Shoulder Circles',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 min each direction',
    diagramId: 'lean_forward_pendulum',
    description: 'Codman\'s pendulum — classic frozen shoulder mobilization using gravity, not muscle force.',
    formCues: ['Lean forward, support non-affected arm on a table or chair', 'Let the affected arm hang freely and relaxed', 'Allow the arm to gently swing in small circles — gravity does the work', 'Gradually increase circle size as tolerated'],
    videoUrl: 'https://www.youtube.com/results?search_query=pendulum+exercise+frozen+shoulder+form',
    notes: 'Do morning and evening. This is the #1 prescribed frozen shoulder exercise — muscle contraction is not the goal.'
  },
  {
    id: 'wall_slides',
    name: 'Wall Slides',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 × 10',
    diagramId: 'wall_slides',
    description: 'Trains shoulder blade control and serratus anterior. Improves posture and frozen shoulder.',
    formCues: ['Stand with back flat against wall', 'Start with arms in "W" — elbows and wrists touching wall', 'Slide arms upward toward "Y" position', 'Maintain wall contact throughout — don\'t let elbows or wrists lift off'],
    videoUrl: 'https://www.youtube.com/results?search_query=wall+slides+shoulder+rehab+form+tutorial',
    notes: 'Go only as high as wall contact can be maintained. Consistent improvement in range signals frozen shoulder progress.'
  },
  {
    id: 'it_band_foam_roll',
    name: 'IT Band / Quad Foam Roll',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '60–90 sec each leg',
    diagramId: 'foam_roller',
    description: 'Self-myofascial release for IT band and quad tightness — both contributors to knee pain.',
    formCues: ['Lie on side with foam roller under mid-thigh', 'Roll slowly from hip to just above the knee', 'Pause on tender spots for 5–10 sec — breathe through it', 'Keep core slightly engaged for control'],
    videoUrl: 'https://www.youtube.com/results?search_query=IT+band+foam+rolling+technique+knee+pain',
    notes: 'Roll before cardio to loosen tissue, and after to aid recovery. Avoid rolling directly over the knee joint.'
  },

  // ── ACTIVE RECOVERY ───────────────────────────────────────────────────────
  {
    id: 'yoga_flow',
    name: 'Yoga Flow (Beginner)',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '15–20 min',
    diagramId: 'yoga_child',
    description: 'Gentle movement to reduce stiffness, improve flexibility, and activate parasympathetic recovery.',
    formCues: ['Cat-cow: inhale to arch, exhale to round — 10 reps', 'Child\'s pose: arms forward, hold 30 sec', 'Downward dog: pedal heels, hold 20 sec', 'Thread-the-needle for thoracic rotation'],
    videoUrl: 'https://www.youtube.com/results?search_query=beginner+yoga+flow+morning+15+minutes',
    notes: 'Use blocks or a chair for wrist modifications. Avoid full downward dog if shoulder is very restricted.'
  },
  {
    id: 'walking_easy',
    name: 'Easy Walk (Outdoor)',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '20–30 min, flat ground',
    diagramId: 'walking',
    description: 'Active recovery that serves triple duty: joint mobility, blood sugar control, and mental health.',
    formCues: ['Comfortable, conversational pace — no HR pressure', 'Relaxed arm swing', 'Flat or gently rolling terrain preferred', 'Stay well within Zone 1 (under 90 bpm)'],
    videoUrl: 'https://www.youtube.com/results?search_query=benefits+of+walking+daily+health',
    notes: 'Post-meal walks of 10+ min are clinically proven to significantly reduce blood glucose spikes. Do this daily after meals.'
  },
  {
    id: 'breathing_exercise',
    name: '4-7-8 Breathing',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '5–8 cycles',
    diagramId: 'sitting_breathing',
    description: 'Diaphragmatic breathing technique that activates the parasympathetic nervous system and lowers resting heart rate.',
    formCues: ['Inhale through nose for 4 counts', 'Hold breath for 7 counts', 'Exhale through mouth slowly for 8 counts', 'Repeat — use after cardio to bring HR down'],
    videoUrl: 'https://www.youtube.com/results?search_query=4-7-8+breathing+technique+tutorial+benefits',
    notes: 'Post-cardio cool-down. If 7-count hold is uncomfortable, try 4-4-8. Aids blood glucose regulation via stress reduction.'
  },

  // ── NECK / UPPER TRAP / LEVATOR SCAPULAE ─────────────────────────────────
  {
    id: 'upper_trap_stretch',
    name: 'Upper Trapezius Stretch',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '3 × 30–45 sec each side',
    diagramId: 'neck_side_stretch',
    description: 'Lengthens the upper trapezius — the thick muscle running from base of skull across the shoulder. Chronic tension here causes neck pain, headaches, and restricted shoulder mobility.',
    formCues: ['Sit or stand tall, shoulders relaxed and level', 'Tilt ear slowly toward same-side shoulder', 'Gently place that hand on the opposite temple — add only mild overpressure', 'Keep far shoulder actively pressed down', 'Hold — breathe out into the stretch'],
    videoUrl: 'https://www.youtube.com/results?search_query=upper+trapezius+stretch+neck+shoulder+relief',
    notes: 'Never pull the head — just let gravity and light hand contact do the work. Opposite shoulder must stay down to isolate the trap.'
  },
  {
    id: 'levator_scapulae_stretch',
    name: 'Levator Scapulae Stretch',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '3 × 30 sec each side',
    diagramId: 'levator_scapulae_stretch',
    description: 'Targets the levator scapulae — the muscle lifting the shoulder blade, commonly the source of that deep ache between neck and shoulder.',
    formCues: ['Sit tall, rotate head 45° toward the side you\'re stretching', 'Nod chin down toward that armpit', 'Place hand on back of head and let weight add gentle overpressure', 'Keep opposite shoulder pinned down', 'Hold and breathe — you\'ll feel it deep behind the neck'],
    videoUrl: 'https://www.youtube.com/results?search_query=levator+scapulae+stretch+neck+shoulder+blade',
    notes: 'This is different from a trap stretch — the rotation angle matters. Used by PTs specifically for the "computer shoulder" ache between neck and shoulder blade.'
  },
  {
    id: 'chin_tuck',
    name: 'Chin Tuck (Cervical Retraction)',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '3 × 10 reps, hold 5 sec',
    diagramId: 'chin_tuck',
    description: 'Retracts the cervical spine to counteract forward head posture. Stretches the suboccipitals and strengthens deep neck flexors — addressing the root cause of upper trap overload.',
    formCues: ['Stand or sit against a wall', 'Draw chin straight back — make a "double chin"', 'Think: slide head back on a shelf, not tuck down', 'Hold 5 sec, then release fully', 'Repeat — keep jaw relaxed throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=chin+tuck+exercise+cervical+retraction+form',
    notes: 'Forward head posture increases upper trap tension. Daily chin tucks address the postural cause, not just the symptom. Do them at your desk.'
  },
  {
    id: 'face_pull',
    name: 'Face Pull (Band)',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15',
    diagramId: 'face_pull',
    description: 'Strengthens the mid and lower trapezius plus rear deltoids — the muscles that counterbalance upper trap dominance and pull the shoulders back into alignment.',
    formCues: ['Band anchored at face height, hold with both hands', 'Pull toward face, elbows flaring wide and high', 'At the finish, elbows are behind ears — like a "W"', 'Squeeze shoulder blades together at the end', 'Return slowly — 3 seconds'],
    videoUrl: 'https://www.youtube.com/results?search_query=face+pull+exercise+proper+form+band',
    notes: 'The single best exercise for shoulder posture and rotator cuff health. Works mid/lower trap which is typically weak when upper trap is tight.'
  },
  {
    id: 'shrug_release',
    name: 'Shoulder Shrug & Release',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 × 10 reps',
    diagramId: 'shrug_release',
    description: 'Contract-and-release technique for the upper trapezius. Intentional shrug followed by complete drop creates neuromuscular relaxation that passive stretching alone cannot achieve.',
    formCues: ['Stand tall, arms at sides', 'Shrug both shoulders up toward ears as high as possible — hold 5 sec', 'Drop them completely — let gravity take over', 'Take a breath, feel the release', 'Repeat slowly — do not rush'],
    videoUrl: 'https://www.youtube.com/results?search_query=shoulder+shrug+release+trap+tension+relief',
    notes: 'This works via post-isometric relaxation (PIR) — the muscle releases more deeply after a contraction than during passive stretching alone.'
  }
];

// Category metadata
const CATEGORIES = {
  cardio:   { label: 'Cardio',    icon: 'Cardio',    color: '#ef4444' },
  upper:    { label: 'Upper Body', icon: 'Upper',     color: '#3b82f6' },
  core:     { label: 'Core',       icon: 'Core',      color: '#f59e0b' },
  lower:    { label: 'Lower Body', icon: 'Lower',     color: '#10b981' },
  mobility: { label: 'Mobility',   icon: 'Mobility',  color: '#8b5cf6' },
  recovery: { label: 'Recovery',   icon: 'Recovery',  color: '#6b7280' }
};

// Complexity metadata
const COMPLEXITY = {
  simple:   { label: 'Simple',   color: '#16a34a', bg: '#dcfce7' },
  moderate: { label: 'Moderate', color: '#d97706', bg: '#fef3c7' },
  complex:  { label: 'Complex',  color: '#dc2626', bg: '#fee2e2' }
};

// 7-Day Weekly Plan
const WEEKLY_PLAN = {
  0: { // Sunday
    label: 'Lower Body + Core',
    focus: 'Knee rehab & stability',
    exercises: ['straight_leg_raise', 'clamshells', 'glute_bridge', 'terminal_knee_ext', 'hamstring_curl_band', 'hip_flexor_stretch', 'dead_bug', 'bird_dog', 'hamstring_stretch'],
    duration: '45 min',
    cardio: null
  },
  1: { // Monday
    label: 'Upper Body',
    focus: 'Chest, back, shoulder rehab',
    exercises: ['pendulum_shoulder', 'shrug_release', 'chin_tuck', 'band_pull_apart', 'face_pull', 'band_external_rotation', 'db_chest_press', 'pushups', 'db_row', 'db_curl', 'wall_slides'],
    duration: '45 min',
    cardio: null
  },
  2: { // Tuesday
    label: 'Cardio + Core',
    focus: 'Zone 2 endurance + abs',
    exercises: ['elliptical_z2', 'dead_bug', 'plank', 'pallof_press', 'side_plank', 'it_band_foam_roll', 'breathing_exercise'],
    duration: '45 min',
    cardio: 'elliptical_z2'
  },
  3: { // Wednesday
    label: 'Lower Body Volume',
    focus: 'Strength & knee support',
    exercises: ['wall_sit', 'step_up', 'single_leg_bridge', 'calf_raise', 'adductor_squeeze', 'hip_flexor_stretch', 'terminal_knee_ext', 'worlds_greatest_stretch'],
    duration: '45 min',
    cardio: null
  },
  4: { // Thursday
    label: 'Active Recovery',
    focus: 'Neck, shoulder, mobility',
    exercises: ['shrug_release', 'chin_tuck', 'upper_trap_stretch', 'levator_scapulae_stretch', 'pendulum_shoulder', 'thoracic_rotation', 'wall_slides', 'hamstring_stretch', 'breathing_exercise'],
    duration: '35 min',
    cardio: null
  },
  5: { // Friday
    label: 'Upper Body Volume',
    focus: 'Muscle building, shoulder health',
    exercises: ['band_external_rotation', 'incline_db_press', 'pushups', 'db_row', 'db_shoulder_press', 'band_pull_apart', 'db_curl', 'wall_slides'],
    duration: '45 min',
    cardio: null
  },
  6: { // Saturday
    label: 'Cardio + Rowing',
    focus: 'Full-body aerobic, endurance',
    exercises: ['rowing_z2', 'dead_bug', 'bird_dog', 'calf_raise', 'it_band_foam_roll', 'hamstring_stretch', 'breathing_exercise'],
    duration: '45 min',
    cardio: 'rowing_z2'
  }
};
