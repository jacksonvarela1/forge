/* ================= LIFTING SPLIT =================
   Four days anchored to weekdays so the offset can never drift against the MMA
   week. Built by an adversarial council for three goals at once: dunk a
   basketball, keep building muscle in a deficit, and not wreck the striking
   camp. Lift first, MMA second, four hours apart minimum. */

const LIFTDAYS = ['mon', 'wed', 'fri', 'sat'];
const LIFTRULE = 'Lift first, MMA second, 4 hours apart minimum, 6 is better. Miss a lift and you skip it, you never shift it: a quad day landing on kicks day is a strain.';

/* The jump block runs Wednesday only, on the freshest legs of the week: 96
   hours after the squat, 48 after kicks, and boxing that evening asks nothing
   of the legs. Blocks advance by camp week. Never progress volume and
   intensity in the same week. */
const JUMPBLOCK = [
  { n: 'Block 1', wk: 'weeks 1 to 3', from: 0, to: 2,
    intro: 'Landing mechanics first. No depth jumps yet, you earn those by proving you can absorb force quietly.',
    it: [['Rim attempts x8', 'max intent, 45 to 60 sec between reps, FIRST before any other contact. Log the best touch'],
         ['Drop landing to a stick, 12 inch box, 3x3', 'step off, land silently, hold 2 sec. 20 sec between reps, 90 sec between sets'],
         ['Pogo hops 3x10', 'ankles only, no knee bend, target contact under 200 ms'],
         ['Broad jump 3x3', 'max intent, 45 sec between reps'],
         ['About 56 contacts', 'write the number down every week']] },
  { n: 'Block 2', wk: 'weeks 4 to 7', from: 3, to: 6,
    intro: 'Bag and partner land at the start of this block. Hold jump volume flat for the first 10 days while the new impact load is absorbed, then progress.',
    it: [['Rim attempts x10', 'max intent, 45 to 60 sec between reps'],
         ['Drop jump from 12 inches, 4x4', 'explicit target: ground contact under 250 ms. Film at 240 fps and count the frames'],
         ['Single-leg pogo 3x8 each', 'stiff ankle, contact under 200 ms'],
         ['Accelerations 4 x 15 to 20 m', 'full recovery, walk back slow. Not conditioning: if it stops feeling crisp the set is over'],
         ['About 64 contacts plus sprints', 'run-up speed is the energy a running dunk converts into height']] },
  { n: 'Block 3', wk: 'weeks 8 to 10', from: 7, to: 9,
    intro: 'Lower volume, higher intensity. Depth jumps only if the week 6 retest held: jump height maintained at 12 inches with contact under 250 ms.',
    it: [['Rim attempts x12', 'max intent, 45 to 60 sec between reps'],
         ['Depth jump from 16 to 18 inches, 4x3', 'gated on the retest. If contact time balloons, the box comes back down. No exceptions'],
         ['Single-leg bound 3x4 each', '45 sec between reps'],
         ['Approach runs x3, no jump', 'groove the run-in rhythm on its own'],
         ['About 36 contacts, all high quality', 'this is the block where it shows up']] }
];

const LIFT = {
  mon: {
    title: 'Upper A + Forearms',
    pair: 'MMA that evening: kicks and hips',
    primer: [
      ['Pogo hops 2x10', 'ankles only, low amplitude. This is not a jump session, it is ankle prep'],
      ['Approach-run rehearsal x4', 'full dunk run-in at speed, plant, submaximal touch. Penultimate step LONG and LOW, final step short and fast, arms back then drive up hard. From week 3 make these max intent if Saturday left your legs feeling normal'],
      ['Plyo push-up 3x5', '60 sec rest'],
      ['Band pull-apart 2x20-25', 'heavy band, so this counts as real rear delt volume instead of a warm-up']
    ],
    main: [
      ['Weighted dip 3x6-10 at 1-2 RIR', 'full depth so the chest loads long, 3 sec down, no bouncing out of the bottom'],
      ['Weighted neutral-grip pull-up 3x6-10 at 1-2 RIR', 'belt or a dumbbell between the feet. Finish the last set with a 20 to 30 sec max dead hang'],
      ['DB shoulder press 2x6-10 at 1-2 RIR', 'held at 2 sets on purpose. Dips and incline press already load the front delt heavily'],
      ['Single-arm cable row 2x8-12 each at 1 RIR', 'the frame and collar-tie pattern, and it makes the trunk resist rotation for free'],
      ['Cable lateral raise 4x12-20 at 0-1 RIR', 'low pulley across the body. Last set: lengthened partials x5-8 past failure, then a 20 to 30 sec hold at 30 degrees. Doubled from 2 sets because this was the most undertrained muscle you own'],
      ['Incline DB curl 2x8-12 at 0-1 RIR', 'shoulder extended puts the biceps at long length, the position that grows it. Do not add more, four pulls already feed it']
    ],
    acc: [
      ['Fat-grip or towel dead hang 2x30-45 sec', 'support grip, not wrist curls. Your flexors are already saturated by pull-ups, rows and gripping gloves daily'],
      ['Seated wrist extension 2x15-20 at 0-1 RIR', 'the extensors get nothing anywhere else. Cheap insurance for the punching wrist and the elbow once the bag lands']
    ],
    stretch: [
      ['DB flye stretch-hold 2x30 sec', 'then 8 to 10 controlled full range reps. Loaded lengthening beats a passive doorway stretch'],
      ['Thoracic extension over a bench 45 sec'],
      ['Wrist flexor and extensor 30 sec each'],
      ['Neck, 4-way isometrics 2x20-30 sec each direction', 'submaximal press against your own hand or a towel: flexion, extension, both sides. From week 4 switch to banded work 2x10-12 per direction with a 2 sec eccentric. Never loaded neck bridges, and stop instantly on any radiating pain']
    ],
    note: 'Monday is the biggest lower-limb MMA day of the week, which is exactly why it gets the lift that costs the legs nothing. Neck work starts NOW, in the weeks before the partner arrives, not after.'
  },

  wed: {
    title: 'Lower Hamstring + Abs',
    pair: 'JUMP DAY. MMA that evening: boxing',
    primer: [['The jump block runs first', 'see the block for your camp week. 18 to 20 minutes, on the freshest legs of the week, before anything else touches them. This is the most important block in the program']],
    main: [
      ['Romanian deadlift 3x6-8 at 2 RIR', 'slot 1 so the hinge is trained fresh. Stop the set when bar speed drops or the low back starts taking over. Never grind this one'],
      ['Seated leg curl 3x8-12 at 0-1 RIR', 'seated, not lying. Hip flexion lengthens the hamstring and grows it measurably more. Last set: lengthened partials x5-8'],
      ['Nordic hamstring curl 2x4-6', 'lower over 3 to 4 sec, catch, push back up. WEEKS 1 AND 2: eccentric only, lowering to a box, 2x3. This is your only heavy eccentric hamstring work and it is what protects you when the kicking gets real'],
      ['Leg press or hack squat 3x8-12 at 1-2 RIR', 'full depth. Second quad exposure of the week, and it is not optional when the goal is inches'],
      ['Standing calf raise 3x8-12', 'explosive up, 2 sec hold at the top, 3 sec down. Knee straight means gastrocnemius. PAIRED with tibialis raise 2x12-20'],
      ['Copenhagen adductor hold 2x30-45 sec each', 'WEEKS 1 AND 2: cap at 20 to 25 sec, the first exposure is brutally sore. PAIRED with standing band hip flexion drive 2x10-12 each, which trains the kick chamber standing up, in the posture you actually kick from']
    ],
    acc: [
      ['Half-kneeling Pallof press 2x8-10 each, 3 sec hold', 'anti-rotation. Striking is a force transfer problem: the trunk stiffens so the limbs can throw. This is what stops the lead shoulder flying open on a cross'],
      ['Weighted cable rope crunch 2x10-15', 'loaded flexion, the only real ab growth stimulus in the week. Boxing day is the one MMA day with no core stations, so it is the uncontested slot for it']
    ],
    stretch: [
      ['90/90 hip switch with a 5 sec end-range press, 8 each', 'press the down shin into the floor at end range, then switch. The base leg in a roundhouse needs internal rotation you never otherwise train'],
      ['Couch stretch 45 sec each side'],
      ['Half-kneeling adductor rock 30 sec each', 'you load the adductors twice a week and never lengthen them'],
      ['Bent-knee wall calf stretch 30 sec each', 'bent knee targets the soleus']
    ],
    note: 'Longest day of the week at about 80 minutes, by design. Heavy eccentric hamstring work sits five days before Monday kicks, the most separation the fixed skeleton allows. TEST WEEKS 1, 3, 6 and 9: run the full test battery here, fully warm, BEFORE the jump block.'
  },

  fri: {
    title: 'Upper B + Forearms',
    pair: 'MMA that evening: defense and counters',
    primer: [
      ['Plyo push-up 3x5', 'or a med ball chest pass into a wall. 60 sec rest'],
      ['Band pull-apart 2x20-25 at 1-2 RIR', 'heavy band']
    ],
    main: [
      ['Low-incline DB press 3x6-10 at 1-2 RIR', '15 to 30 degrees, 2 to 3 sec down, deep stretch at the bottom. The old explosive cue is gone: speed intent on a hypertrophy set does neither job well'],
      ['T-bar row 3x6-10 at 1-2 RIR'],
      ['Single-arm cable pulldown 2x8-12 each at 1 RIR', 'two vertical and two horizontal pulls a week is a good balance. Do not rob it to fund something else'],
      ['Face pull 3x12-20 SUPERSET cable lateral raise 2x12-20, both 0-1 RIR', '90 sec between supersets. Hold the last face pull at peak contraction for 15 to 20 sec. The rear delt decelerates every punch you throw and you are about to throw hundreds a session'],
      ['Half-kneeling landmine rotation 2x8-10 each, 3 sec eccentric', 'the one piece of loaded rotational strength in your week, and the highest transfer lift you own for striking'],
      ['Overhead cable triceps extension 2x10-15 at 0-1 RIR', 'the long head only lengthens with the shoulder overhead. Do not trade it for a pressdown']
    ],
    acc: [
      ['DB reverse curl 2x10-12 at 0-1 RIR', 'brachioradialis and wrist extensors, the muscles that hold wrist position under load when you punch and grip'],
      ['Heavy farmer or suitcase hold 2x30-40 sec each side', 'heavy enough that the grip is what fails. Support grip endurance is what the clinch actually demands']
    ],
    stretch: [
      ['DB flye stretch-hold 2x30 sec', 'then 8 to 10 controlled reps'],
      ['Thread the needle 8 each side'],
      ['Wrist flexor and extensor 30 sec each'],
      ['Neck, same protocol as Monday', '4-way isometrics 2x20-30 sec each direction, banded 2x10-12 from week 4']
    ],
    note: 'Heaviest upper day by set count, but nearly all the added volume is cable and isolation work at 0-1 RIR, which is cheap in systemic fatigue. Friday MMA is defense and movement, so a morning upper lift competes with almost nothing.'
  },

  sat: {
    title: 'Lower Quad + Abs',
    pair: 'MMA that evening: hands and core',
    primer: [
      ['Pogo hops 2x10', 'barefoot on grass or a mat. You pivot barefoot seven days a week, so train ankle stiffness barefoot'],
      ['Ankle and hip prep', '2 light sets of leg curl for knee prep plus 10 wall ankle rockers each side. Not counted as volume']
    ],
    main: [
      ['Trap bar jump 4x3 at 20-30% of your trap bar deadlift 1RM', '90 sec between sets, maximal concentric intent, full triple extension, land soft and RESET every rep instead of bouncing. This is the middle of the force-velocity curve, which your old program had nothing in. It also potentiates the squat behind it'],
      ['Back squat 3x5-8 at 1-2 RIR', '2 to 3 sec pause in the hole on the FIRST set while you are fresh, then touch and go with maximum concentric intent on sets 2 and 3'],
      ['Bulgarian split squat 2x6-8 each at 1-2 RIR', 'heavier than a bodybuilding range on purpose. A running takeoff is a single-leg force problem'],
      ['Leg extension 2x10-15 SUPERSET seated leg curl 2x10-15, both 0-1 RIR', 'adjacent machines, minimal rest. Last set of each: lengthened partials x5-8 past failure. This is what keeps hamstring frequency at twice a week'],
      ['Seated calf raise 3x10-15 at 0-1 RIR', '2 sec pause at full stretch, explosive up, 3 sec down. Seated means knee bent means soleus, the biggest plantarflexor you own and the one your old program never trained. PAIRED with tibialis raise 2x12-20'],
      ['Barefoot lateral bound 2x3 each with a 2 to 3 sec stick landing', 'the frontal plane, where the base leg actually lives during a kick pivot, and a plane no squat or split squat touches. PAIRED with banded lateral step-out 1x12-15 each']
    ],
    acc: [
      ['Ab wheel rollout 2x6-10', 'anti-extension. Regress to a long-lever plank 2x20-30 sec if the low back complains. This is what stops the ribs flaring and the back arching when you sit down on a cross'],
      ['Heavy suitcase carry 2x30-40 yards each side', 'anti-lateral-flexion plus heavy support grip, standing, which is the position you actually fight in']
    ],
    stretch: [
      ['Couch stretch 45 sec each side'],
      ['90/90 hip switch with a 5 sec end-range press, 8 each'],
      ['Wall ankle dorsiflexion 10 each side'],
      ['Bent-knee standing soleus stretch 30 sec each']
    ],
    note: 'The genuine overreach day: day six of seven, straight after Friday, in a deficit, with hands and core that evening. If you are cooked the MMA session gets cut, never the lift, because the lift is what protects your muscle during a cut. Expect some quad soreness Monday and accept it: a sore quad is a performance cost, a sore hamstring going into kicks is an injury.'
  }
};

const LIFTRULES = [
  ['Test first, before you change anything', 'Wednesday, fully warm, before the jump block, then again in weeks 3, 6 and 9. Standing reach flat-footed. Standing vertical x3. Two-foot running approach x3. One-foot running approach x3 each leg. A 12 inch drop jump filmed at 240 fps so you can count contact frames. Bodyweight the same morning. Estimated squat 1RM divided by bodyweight. Tape target strips on the wall at reach plus 6 and reach plus 8 inches. Right now nobody, you included, knows whether you are force-deficient or reactive-deficient, and that one fact should drive the whole program.'],
  ['Read the test, it picks your bias', 'One-foot beats two-foot by 2 inches or more: you are a speed jumper, push the single-leg share and keep the sprints. Two-foot clearly better: bias bilateral drop jumps, squat, ankle stiffness. Standing vertical within 3 to 4 inches of your run-up vertical: TECHNIQUE is your cheapest bucket of inches, double the Monday approach reps and film from the side weekly. Contact over 250 ms with a low bounce: reactive strength is the limiter, stay on pogos and 12 inch drop jumps and do not advance to depth jumps. Squat under 1.5x bodyweight: max strength is a co-limiter, add a fourth squat set in Block 3 instead of raising jump volume.'],
  ['Know your real volume number', 'This week is about 88 working sets against roughly 64 in the old split. That is a real jump, so it is deliberate and it is bounded. The extra sets went only where you were genuinely below the growth threshold: side delts, quads, soleus and the squat. About a third of the additions are cheap holds, carries, band work and tibialis raises that cost almost nothing systemically, and every compound is capped at 1-2 RIR so nothing is ground to failure. If the autoregulation triggers below start firing, this number is the first thing to come down, not the jump block.'],
  ['Contact budget, logged weekly', 'About 130 lower-body contacts a week total, roughly 40 of them max intent. If you add contacts anywhere, take them from somewhere else. Silent creep in jump volume is how you arrive at week 6 with sore patellar tendons and no idea why.'],
  ['Double progression on the mains', 'When you hit the top of the rep range on every set at the target RIR, add load: 2.5 to 5 lb upper, 5 to 10 lb lower, then drop back to the bottom of the range. Trap bar jumps progress by bar speed and intent, never by load. They stay at 20 to 30 percent all camp.'],
  ['Intensity is capped, not maxed', 'Compounds 1-2 RIR, never to failure. Isolations 0-1 RIR. Lengthened partials past failure only on the last set of lateral raises, leg extension, leg curl and both calf raises. Adding a set buys more growth than grinding to failure, and you cannot afford failure training on top of seven MMA sessions in a deficit.'],
  ['Rate of loss decides everything', '0.4 to 0.6 percent of bodyweight a week, 0.7 is the ceiling. At 175 lb that is 0.7 to 1.0 lb a week. Athletes cutting slowly gained lean mass while a fast-cutting group gained none on identical training. Weigh daily, first thing, use only the 7 day average, and adjust by 150 calories at a time. Expect 7 to 9 lb over the camp, not 15.'],
  ['Protein high, carbs high, and cycle the two big days', 'Protein 2.2 to 2.4 g per kg, about 175 to 190 g at 175 lb, across 4 to 5 feedings. Carbs 4 to 4.5 g per kg: under-fueled carbs show up as dead bar speed and flat jumps before they show up anywhere else. Eat at maintenance on WEDNESDAY and SATURDAY, the jump day and the squat day, and take the deficit on Tuesday, Thursday and Sunday. Weekly deficit is unchanged, the two sessions that matter most stay fueled.'],
  ['Sleep is not the optional part', '7.5 hours in bed minimum, 8 or more in the hard weeks. At identical calories and identical training, short sleep cut the share of weight lost as fat by more than half and increased lean mass loss. That is large enough to invert this entire phase on its own. Do not run the MMA session inside 3 hours of bed.'],
  ['Deload in week 5', 'One week. Same exercises, same loads, one set per exercise, half the jump contacts, keep the rim attempts, and drop MMA to three technical sessions. Week 5 is where the new bag and partner load has accumulated, which is exactly when you need it.'],
  ['Deload early if any of these fire', 'Best rim touch is more than 1.5 inches below your 4 week best on two straight Wednesdays. Top-set reps at a fixed load on squat, RDL or dips fall by 2 or more versus two weeks ago. Morning resting heart rate averages 6 bpm above baseline for 5 straight days. Bodyweight drops faster than 1.2 lb a week for two straight weeks. Under 7 hours of sleep on 3 nights in a rolling week.'],
  ['The cut order, decided now while you are fresh', 'When the week goes bad, cut in this order and no other. 1: MMA station intensity. 2: Tuesday drops to film and shadow only. 3: Friday MMA drops. 4: lifting accessories, slots 7 and 8. 5: main lift top sets and the Wednesday jump block, dead last. Never skip a lift because it feels like the hardest thing on the list. The lifting is what is actively rescuing your muscle during the cut. The MMA volume is not.'],
  ['What to actually expect', 'Vertical: 3 to 6 inches over 10 weeks. Technique is the biggest and cheapest chunk, then bodyweight, then reactive adaptation, then strength. A clean regulation dunk inside 10 weeks is a coin flip, not a promise, and your first one will almost certainly be one-handed off a running approach. Before you assume you need more air, test whether the real limiter is ball control: try a slightly under-inflated ball and tacky hands. Muscle: 1 to 3 lb of lean mass alongside 7 to 9 lb of fat loss, concentrated in quads, hamstrings, calves, side delts and back, the places that got the reallocated volume. Most of what you see in the mirror at week 10 is fat loss uncovering muscle you already own.']
];
