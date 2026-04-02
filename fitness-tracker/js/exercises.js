// Fitness Tracker — Exercise Database + Weekly Plan
// Profile: 53yo male, 147lb/5'11", cardiac rehab (stent+MI), knee pain, frozen shoulder, diabetes mgmt
// Max HR: 145 bpm | RHR: 55-60 bpm | Zone 2 target: 76-100 bpm

const EXERCISES = [
  // ── CARDIO ──────────────────────────────────────────────────────────────
  {
    id: 'elliptical_z2',
    name: 'Elliptical — Zone 2',
    category: 'cardio',
    complexity: 'simple',
    setsReps: '25–35 min',
    hrZone: { label: 'Zone 2', min: 76, max: 100 },
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
    hrZone: { label: 'Zone 2', min: 76, max: 100 },
    description: 'Full-body low-impact cardio. Excellent for upper body & core. Keep HR under 120.',
    formCues: ['Drive with legs first, then lean back, then arms', 'Catch: shins vertical, arms straight', 'Finish: elbows past ribs, slight recline', 'Ratio: 75% effort on drive, 25% recovery'],
    videoUrl: 'https://www.youtube.com/results?search_query=rowing+machine+proper+form+beginners',
    notes: 'Avoid if shoulder flares. Modify grip if frozen shoulder limits reach.'
  },
  {
    id: 'walking_incline',
    name: 'Incline Walking',
    category: 'cardio',
    complexity: 'simple',
    setsReps: '20–30 min, 3–5% incline',
    hrZone: { label: 'Zone 2', min: 76, max: 100 },
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
    hrZone: { label: 'Zone 2', min: 76, max: 100 },
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
    description: 'Shoulder rehab staple. Strengthens rear deltoids, improves posture, helps frozen shoulder.',
    formCues: ['Arms straight out in front at shoulder height', 'Pull band apart to chest, squeeze shoulder blades', 'Control the return', 'Keep wrists neutral'],
    videoUrl: 'https://www.youtube.com/results?search_query=resistance+band+pull+apart+shoulder+rehab',
    notes: 'Excellent daily exercise for frozen shoulder. Use light band.'
  },
  {
    id: 'band_external_rotation',
    name: 'Band External Rotation',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15 each arm',
    description: 'Rotator cuff rehab for frozen shoulder. Core exercise for shoulder health.',
    formCues: ['Elbow at side, 90° bend', 'Rotate forearm away from body', 'Keep elbow pressed to side throughout', 'Small, controlled movement'],
    videoUrl: 'https://www.youtube.com/results?search_query=band+external+rotation+shoulder+rehab+exercise',
    notes: 'Critical for frozen shoulder recovery. Do this daily if possible.'
  },
  {
    id: 'db_shoulder_press',
    name: 'Dumbbell Shoulder Press (Seated)',
    category: 'upper',
    complexity: 'moderate',
    setsReps: '3 × 10',
    description: 'Overhead pressing builds shoulder strength. Modified range for frozen shoulder.',
    formCues: ['Seated with back support', 'Start at ear height, press overhead', 'If shoulder limits: press to forehead level only', 'Don\'t arch lower back'],
    videoUrl: 'https://www.youtube.com/results?search_query=seated+dumbbell+shoulder+press+form',
    notes: 'Reduce range of motion significantly if frozen shoulder limits overhead reach.'
  },
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12–15',
    description: 'Side deltoid development. Keep weight light to protect shoulder.',
    formCues: ['Slight forward lean', 'Raise arms to shoulder height (not higher)', 'Lead with elbow, not wrist', 'Slow lower — 3 seconds down'],
    videoUrl: 'https://www.youtube.com/results?search_query=dumbbell+lateral+raise+proper+form',
    notes: 'Use very light weight. Stop at shoulder height — going higher stresses the rotator cuff.'
  },
  {
    id: 'tricep_overhead_ext',
    name: 'Tricep Overhead Extension',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12',
    description: 'Tricep isolation. Helps with pushing strength and arm mass.',
    formCues: ['Hold one dumbbell with both hands above head', 'Lower behind head, elbows pointing up', 'Extend back up, squeeze at top', 'Keep upper arms still'],
    videoUrl: 'https://www.youtube.com/results?search_query=overhead+tricep+extension+dumbbell+form',
    notes: 'Skip if shoulder position is uncomfortable. Replace with band pushdown.'
  },
  {
    id: 'band_pushdown',
    name: 'Band Tricep Pushdown',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 15',
    description: 'Shoulder-friendly tricep exercise. Band anchored overhead.',
    formCues: ['Elbows pinned to sides', 'Push down and squeeze at bottom', 'Slow controlled return', 'No swinging'],
    videoUrl: 'https://www.youtube.com/results?search_query=resistance+band+tricep+pushdown+form',
    notes: 'Great frozen-shoulder-safe alternative to overhead tricep work.'
  },
  {
    id: 'db_curl',
    name: 'Dumbbell Bicep Curl',
    category: 'upper',
    complexity: 'simple',
    setsReps: '3 × 12',
    description: 'Classic bicep builder. Supinate wrist at top for full contraction.',
    formCues: ['Elbows at sides throughout', 'Rotate palm up as you curl', 'Squeeze at top', 'Lower fully — 2 second descent'],
    videoUrl: 'https://www.youtube.com/results?search_query=dumbbell+bicep+curl+proper+form',
    notes: 'Alternate arms for better mind-muscle connection.'
  },
  {
    id: 'incline_db_press',
    name: 'Incline Dumbbell Press',
    category: 'upper',
    complexity: 'moderate',
    setsReps: '3 × 10',
    description: 'Upper chest emphasis. More shoulder-friendly than flat press for some.',
    formCues: ['Bench at 30–45°', 'Press up and slightly together at top', 'Elbows at 45° from torso', 'Don\'t lock elbows at top'],
    videoUrl: 'https://www.youtube.com/results?search_query=incline+dumbbell+press+form+technique',
    notes: 'Adjust angle based on shoulder comfort.'
  },

  // ── CORE ─────────────────────────────────────────────────────────────────
  {
    id: 'dead_bug',
    name: 'Dead Bug',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 8–10 each side',
    description: 'Safest core exercise — no spine flexion. Excellent for abs, obliques and stability.',
    formCues: ['Lie on back, arms up, knees at 90° over hips', 'Press lower back INTO floor throughout', 'Lower opposite arm + leg slowly', 'Return and switch — breathe out on lower'],
    videoUrl: 'https://www.youtube.com/results?search_query=dead+bug+exercise+form+tutorial',
    notes: 'Start here for core work. No spinal flexion = safe for cardiac/diabetic patients.'
  },
  {
    id: 'plank',
    name: 'Forearm Plank',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 20–40 sec',
    description: 'Full core activation without spinal flexion. Builds deep stabilizers.',
    formCues: ['Elbows under shoulders', 'Neutral spine — no sagging hips, no raised butt', 'Squeeze glutes and abs simultaneously', 'Breathe normally throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=forearm+plank+proper+form+tutorial',
    notes: 'Progress time gradually. Avoid if shoulder flares — use kneeling version.'
  },
  {
    id: 'side_plank',
    name: 'Side Plank',
    category: 'core',
    complexity: 'moderate',
    setsReps: '3 × 15–25 sec each side',
    description: 'Oblique and lateral core strength. Helps with spine stability.',
    formCues: ['Elbow under shoulder', 'Hips stacked and lifted', 'Top arm on hip or ceiling', 'Hold the straight line from head to heels'],
    videoUrl: 'https://www.youtube.com/results?search_query=side+plank+form+tutorial+benefits',
    notes: 'Kneeling version OK to start. Builds hip stability relevant to knee health.'
  },
  {
    id: 'pallof_press',
    name: 'Pallof Press (Band)',
    category: 'core',
    complexity: 'moderate',
    setsReps: '3 × 10 each side',
    description: 'Anti-rotation core stability. Excellent functional core exercise.',
    formCues: ['Band anchored at chest height to your side', 'Press out straight in front, hold 2 sec', 'Return slowly — resist the rotation', 'Keep hips square'],
    videoUrl: 'https://www.youtube.com/results?search_query=pallof+press+resistance+band+form',
    notes: 'Excellent for building the deep core and obliques without any spinal flexion.'
  },
  {
    id: 'ab_wheel_kneeling',
    name: 'Ab Wheel Rollout (Kneeling)',
    category: 'core',
    complexity: 'complex',
    setsReps: '3 × 6–8',
    description: 'Advanced core. Very effective for abs. Knees on floor, limited range until strong.',
    formCues: ['Start kneeling, ab wheel in front', 'Roll out ONLY until you feel lower back about to arch', 'Pull back using abs, not arms', 'Keep glutes squeezed throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=ab+wheel+rollout+proper+form+kneeling',
    notes: 'Start with very short range of motion. Never let lower back arch — stop before that point.'
  },
  {
    id: 'bird_dog',
    name: 'Bird Dog',
    category: 'core',
    complexity: 'simple',
    setsReps: '3 × 10 each side',
    description: 'Core and glute stability. Safe on the back, excellent spine health exercise.',
    formCues: ['On all fours, back flat (neutral spine)', 'Extend opposite arm + leg simultaneously', 'Hold 2 sec at top', 'Don\'t let hips rotate or sag'],
    videoUrl: 'https://www.youtube.com/results?search_query=bird+dog+exercise+form+tutorial',
    notes: 'Great warm-up exercise. Also activates glutes which support the knee.'
  },

  // ── LOWER BODY / KNEE REHAB ──────────────────────────────────────────────
  {
    id: 'wall_sit',
    name: 'Wall Sit',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 20–40 sec',
    description: 'Isometric quad strengthening. Safe for knee pain — no movement, controlled load.',
    formCues: ['Back flat against wall', 'Thighs parallel to floor (or higher if pain)', 'Feet shoulder-width, toes slightly out', 'Push back into wall throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=wall+sit+proper+form+knee+rehab',
    notes: 'Higher thigh angle (less depth) = less knee stress. Progress depth slowly.'
  },
  {
    id: 'straight_leg_raise',
    name: 'Straight Leg Raise',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15 each leg',
    description: 'Strengthens quads without bending the knee. Classic PT exercise for knee pain.',
    formCues: ['Lie on back, one knee bent for support', 'Tighten quad of straight leg', 'Raise to 45°, hold 1 sec', 'Lower slowly'],
    videoUrl: 'https://www.youtube.com/results?search_query=straight+leg+raise+exercise+knee+rehab+form',
    notes: 'The foundation exercise for knee pain. Start here before any weighted leg work.'
  },
  {
    id: 'clamshells',
    name: 'Clamshells',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15–20 each side',
    description: 'Hip abductor + glute medius activation. Critical for knee tracking and IT band issues.',
    formCues: ['Side-lying, knees bent 45°, hips stacked', 'Rotate top knee open like a clamshell', 'Keep hips from rolling back', 'Squeeze glute at top, hold 1 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=clamshell+exercise+hip+abductor+form',
    notes: 'Add a resistance band for progression. Essential if knee tracks inward during walking.'
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15',
    description: 'Hip extension to strengthen glutes + hamstrings. Takes load off the knee.',
    formCues: ['Lie on back, knees bent, feet flat', 'Drive hips up by squeezing glutes', 'At top: straight line from knees to shoulders', 'Hold 2 sec, lower slowly'],
    videoUrl: 'https://www.youtube.com/results?search_query=glute+bridge+proper+form+tutorial',
    notes: 'Progress to single-leg bridge. Strong glutes are the best knee protection.'
  },
  {
    id: 'single_leg_bridge',
    name: 'Single-Leg Glute Bridge',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12 each side',
    description: 'Unilateral hip extension — more glute activation, exposes side-to-side imbalances.',
    formCues: ['One foot lifted or extended', 'Drive through grounded heel', 'Don\'t let hips rotate or drop', 'Squeeze glute at top'],
    videoUrl: 'https://www.youtube.com/results?search_query=single+leg+glute+bridge+form+tutorial',
    notes: 'Key hip strengthener. Progress from bilateral bridge first.'
  },
  {
    id: 'step_up',
    name: 'Step-Up (Low Box)',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12 each leg',
    description: 'Knee-friendly alternative to squats. Great for quad and glute strength + balance.',
    formCues: ['Use a low step (6–8 inch) to start', 'Step fully onto box, drive through heel', 'Bring other foot up slowly', 'Step back down with control'],
    videoUrl: 'https://www.youtube.com/results?search_query=step+up+exercise+proper+form+knee+friendly',
    notes: 'Don\'t push off the lower foot. Hold dumbbells for progression.'
  },
  {
    id: 'terminal_knee_ext',
    name: 'Terminal Knee Extension (Band)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15 each leg',
    description: 'PT staple for knee pain. Activates VMO (inner quad) which stabilizes the kneecap.',
    formCues: ['Band behind knee, anchored in front', 'Stand on one leg, slight bend in knee', 'Straighten (not hyperextend) against band resistance', 'Hold 1 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=terminal+knee+extension+band+VMO+exercise',
    notes: 'Excellent for kneecap tracking issues (patellofemoral syndrome). Do this daily.'
  },
  {
    id: 'hamstring_curl_band',
    name: 'Hamstring Curl (Band)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 12–15 each leg',
    description: 'Hamstring isolation exercise. Tight hamstrings contribute to knee pain — must address.',
    formCues: ['Lying face down, band around ankle anchored in front', 'Curl heel toward glute', 'Slow and controlled — 3 sec up, 3 sec down', 'Don\'t let hips lift'],
    videoUrl: 'https://www.youtube.com/results?search_query=lying+hamstring+curl+resistance+band+form',
    notes: 'Also do standing calf stretches after — calves and hamstrings are connected chains.'
  },
  {
    id: 'hip_flexor_stretch',
    name: 'Hip Flexor Stretch (Kneeling Lunge)',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 30–45 sec each side',
    description: 'Tight hip flexors tilt pelvis forward and strain the knee. This stretch is essential.',
    formCues: ['Back knee on padded surface, front foot forward', 'Tuck pelvis (posterior tilt)', 'Feel stretch in front of back hip', 'Keep torso upright — don\'t lean forward'],
    videoUrl: 'https://www.youtube.com/results?search_query=kneeling+hip+flexor+stretch+proper+form',
    notes: 'Do this every session. Tight hip flexors are directly linked to knee pain.'
  },
  {
    id: 'calf_raise',
    name: 'Calf Raise',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15–20',
    description: 'Strengthens calves and improves ankle stability. Tight calves affect knee mechanics.',
    formCues: ['Stand on edge of step or flat ground', 'Rise up through big toe', 'Lower slowly — full range', 'Hold at top 1 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=calf+raise+proper+form+tutorial',
    notes: 'Use one leg for progression. Calf raises also aid blood sugar control (Type 2 DM).'
  },
  {
    id: 'adductor_squeeze',
    name: 'Adductor Ball Squeeze',
    category: 'lower',
    complexity: 'simple',
    setsReps: '3 × 15',
    description: 'Activates inner thighs (adductors) which support knee joint stability.',
    formCues: ['Lie on back, knees bent', 'Place ball or folded towel between knees', 'Squeeze isometrically, hold 3 sec', 'Release slowly'],
    videoUrl: 'https://www.youtube.com/results?search_query=adductor+squeeze+inner+thigh+knee+stability',
    notes: 'Very gentle way to activate adductors without stress. Great for tight inner thighs.'
  },
  {
    id: 'db_goblet_squat',
    name: 'Goblet Squat (Dumbbell)',
    category: 'lower',
    complexity: 'moderate',
    setsReps: '3 × 10–12',
    description: 'Knee-friendly squat variation. Dumbbell counterbalance helps posture + reduces knee stress.',
    formCues: ['Hold dumbbell at chest', 'Feet shoulder-width, toes out 15–30°', 'Sit back and down', 'Knees track over toes — don\'t cave in', 'Go only as deep as pain-free'],
    videoUrl: 'https://www.youtube.com/results?search_query=goblet+squat+proper+form+tutorial',
    notes: 'Only add after pain-free wall sits and step-ups. Depth = pain-free range only.'
  },

  // ── FLEXIBILITY / MOBILITY ────────────────────────────────────────────────
  {
    id: 'worlds_greatest_stretch',
    name: "World's Greatest Stretch",
    category: 'mobility',
    complexity: 'moderate',
    setsReps: '5 each side',
    description: 'One move hits hip flexors, adductors, thoracic spine, and hamstrings. Perfect warm-up.',
    formCues: ['Step into deep lunge', 'Place same-side hand inside front foot', 'Rotate top arm to ceiling', 'Then reach arm under body', 'Each position: 3-second hold'],
    videoUrl: 'https://www.youtube.com/results?search_query=worlds+greatest+stretch+form+tutorial',
    notes: 'Great daily mobility routine. Addresses nearly all the tight areas from your profile.'
  },
  {
    id: 'hamstring_stretch',
    name: 'Hamstring Stretch (Lying)',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '3 × 30 sec each leg',
    description: 'Tight hamstrings = knee pain and lower back tension. Stretch daily.',
    formCues: ['Lie on back, pull leg straight up', 'Use a strap or towel if needed', 'Keep both hips on floor', 'Breathe out into the stretch'],
    videoUrl: 'https://www.youtube.com/results?search_query=lying+hamstring+stretch+proper+form',
    notes: 'Consistency matters more than intensity. Gentle, daily is better than aggressive, weekly.'
  },
  {
    id: 'thoracic_rotation',
    name: 'Thoracic Spine Rotation',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '10 each side, 2 sets',
    description: 'Improves upper back rotation — directly helps frozen shoulder by taking load off the joint.',
    formCues: ['Side-lying, knees bent 90°, arms stacked', 'Rotate top arm open to the other side', 'Follow with your eyes', 'Hold at end range 2 sec'],
    videoUrl: 'https://www.youtube.com/results?search_query=thoracic+rotation+mobility+exercise+form',
    notes: 'One of the best frozen shoulder auxiliary exercises — improves shoulder ROM indirectly.'
  },
  {
    id: 'pendulum_shoulder',
    name: 'Pendulum Shoulder Circles',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 min each direction',
    description: 'Classic frozen shoulder exercise. Uses gravity to gently mobilize the joint.',
    formCues: ['Lean forward, support with non-affected arm on table', 'Let affected arm hang freely', 'Allow it to swing gently in circles', 'Start small, gravity does the work'],
    videoUrl: 'https://www.youtube.com/results?search_query=pendulum+exercise+frozen+shoulder+form',
    notes: 'Do this daily — morning and evening. The most important frozen shoulder exercise.'
  },
  {
    id: 'wall_slides',
    name: 'Wall Slides',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '2 × 10',
    description: 'Shoulder blade control and upper back strengthening. Safe for frozen shoulder.',
    formCues: ['Stand with back against wall', 'Arms up in "W" shape, elbows and wrists touching wall', 'Slide arms up toward "Y" shape', 'Keep contact with wall throughout'],
    videoUrl: 'https://www.youtube.com/results?search_query=wall+slides+shoulder+rehab+form+tutorial',
    notes: 'Don\'t force the range — go as high as comfortable. Improves posture too.'
  },
  {
    id: 'it_band_foam_roll',
    name: 'IT Band / Quad Foam Roll',
    category: 'mobility',
    complexity: 'simple',
    setsReps: '60–90 sec each leg',
    description: 'Reduces tightness in IT band and quad that contributes to knee pain.',
    formCues: ['Lie on side, foam roller at mid-thigh', 'Roll slowly from hip to just above knee', 'Pause on tight spots for 5–10 sec', 'Breathe out on tender spots'],
    videoUrl: 'https://www.youtube.com/results?search_query=IT+band+foam+rolling+technique+knee+pain',
    notes: 'Do before and after cardio sessions. Reduces post-workout soreness significantly.'
  },

  // ── ACTIVE RECOVERY ───────────────────────────────────────────────────────
  {
    id: 'yoga_flow',
    name: 'Yoga Flow (Beginner)',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '15–20 min',
    description: 'Reduces stiffness, improves flexibility, promotes parasympathetic recovery.',
    formCues: ['Focus on breathing', 'Cat-cow for spine', 'Child\'s pose for hip flexors', 'Downward dog for hamstrings + calves'],
    videoUrl: 'https://www.youtube.com/results?search_query=beginner+yoga+flow+morning+15+minutes',
    notes: 'Modified cat-cow avoids shoulder stress. Use blocks if wrist/shoulder limits.'
  },
  {
    id: 'walking_easy',
    name: 'Easy Walk (Outdoor)',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '20–30 min, flat ground',
    description: 'Active recovery, blood sugar control, mental health. Keep HR under 100.',
    formCues: ['Natural pace', 'Arm swing relaxed', 'Even terrain preferred', 'No pace pressure'],
    videoUrl: 'https://www.youtube.com/results?search_query=benefits+of+walking+daily+health',
    notes: 'Post-meal walks of 10+ min significantly lower blood glucose. Very important for diabetes management.'
  },
  {
    id: 'breathing_exercise',
    name: '4-7-8 Breathing',
    category: 'recovery',
    complexity: 'simple',
    setsReps: '5–8 cycles',
    description: 'Activates parasympathetic system. Reduces cardiac workload and cortisol.',
    formCues: ['Inhale for 4 counts', 'Hold for 7 counts', 'Exhale slowly for 8 counts', 'After exercise to bring HR down'],
    videoUrl: 'https://www.youtube.com/results?search_query=4-7-8+breathing+technique+tutorial+benefits',
    notes: 'Excellent post-cardio cool-down. Also aids blood glucose regulation via stress reduction.'
  }
];

// Category metadata
const CATEGORIES = {
  cardio:   { label: 'Cardio', icon: '❤️', color: '#ef4444' },
  upper:    { label: 'Upper Body', icon: '💪', color: '#3b82f6' },
  core:     { label: 'Core', icon: '🔥', color: '#f59e0b' },
  lower:    { label: 'Lower Body', icon: '🦵', color: '#10b981' },
  mobility: { label: 'Mobility', icon: '🧘', color: '#8b5cf6' },
  recovery: { label: 'Recovery', icon: '😌', color: '#6b7280' }
};

// Complexity metadata
const COMPLEXITY = {
  simple:   { label: 'Simple',   color: '#10b981', bg: '#d1fae5' },
  moderate: { label: 'Moderate', color: '#d97706', bg: '#fef3c7' },
  complex:  { label: 'Complex',  color: '#ef4444', bg: '#fee2e2' }
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
    exercises: ['pendulum_shoulder', 'band_pull_apart', 'band_external_rotation', 'db_chest_press', 'db_row', 'lateral_raise', 'band_pushdown', 'db_curl', 'wall_slides'],
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
    focus: 'Mobility, shoulder, blood sugar',
    exercises: ['pendulum_shoulder', 'thoracic_rotation', 'wall_slides', 'hamstring_stretch', 'walking_easy', 'breathing_exercise', 'yoga_flow', 'it_band_foam_roll'],
    duration: '30 min',
    cardio: null
  },
  5: { // Friday
    label: 'Upper Body Volume',
    focus: 'Muscle building, shoulder health',
    exercises: ['band_external_rotation', 'incline_db_press', 'db_row', 'db_shoulder_press', 'band_pull_apart', 'db_curl', 'tricep_overhead_ext', 'wall_slides'],
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

// Heart rate zone reference
const HR_ZONES = {
  rhr: 57, // midpoint of 55-60
  max: 145, // cardiac rehab safe max
  zones: [
    { zone: 1, label: 'Recovery',    min: 57,  max: 75,  color: '#6b7280', desc: 'Very light, warmup/cooldown' },
    { zone: 2, label: 'Fat Burn',    min: 76,  max: 100, color: '#10b981', desc: 'Conversational pace — primary target' },
    { zone: 3, label: 'Aerobic',     min: 101, max: 120, color: '#f59e0b', desc: 'Moderate — occasional OK' },
    { zone: 4, label: 'Threshold',   min: 121, max: 135, color: '#ef4444', desc: 'Hard — approach with caution' },
    { zone: 5, label: 'Max',         min: 136, max: 145, color: '#7f1d1d', desc: 'DANGER — do not exceed 145' }
  ]
};
