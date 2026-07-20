const DAYMETA = {
  mon:{abbr:'MON',title:'Kicks & Hips',type:'technical',intensity:3,warm:'hips',cool:'hips',focus:'Leg-heavy skill day, on fresh legs.',flag:'Fresh legs, two days out from Wednesday\u2019s squat. Only leg-loaded skill day.'},
  tue:{abbr:'TUE',title:'Combinations',type:'moderate',intensity:4,warm:'upperk',cool:'upper',focus:'Chain it. Hands-led so legs stay fresh for Wednesday.',flag:'Day before your squat. Hands-dominant on purpose.'},
  wed:{abbr:'WED',title:'Boxing',type:'technical',intensity:2,warm:'upper',cool:'upper',focus:'Leg day. Hands and upper only.',flag:'Squat day. Zero kicks, light feet. Stacks clean with the lift.'},
  thu:{abbr:'THU',title:'Output & Core',type:'hard',intensity:5,warm:'full',cool:'full',focus:'Hard day. Upper and core, legs are cooked from Wednesday.',flag:'Push the pace on the hands, not the quads.'},
  fri:{abbr:'FRI',title:'Defense & Counters',type:'technical',intensity:2,warm:'upperk',cool:'upper',focus:'Read and punish. Lightest day of the week.',flag:'Low-leg before Saturday\u2019s squat.'},
  sat:{abbr:'SAT',title:'Hands & Core',type:'hard',intensity:5,warm:'upper',cool:'upper',focus:'Hard day and leg day. Upper and core only.',flag:'Biggest total-load day. Run it later than the lift, or trim a round if gassed.'},
  sun:{abbr:'SUN',title:'Restore',type:'recovery',intensity:1,warm:null,cool:null,focus:'Form, mobility, film. No power.',flag:'Lands on your rest day.'}
};

const WARM = {
  hips:[['Leg swings x15 each','front-back, then side-side'],['Deep squat hold','3 x 30 sec'],['90/90 hip switch x10 each','both knees stay down'],['Ankle circles + calf raises x20','the pivot lives here']],
  upper:[['Towel dislocates x15','arms straight, slow arc'],['Neck circles x10 each way'],['Torso rotations x20','let the arms swing'],['Light shadow 2 min','build up slow']],
  upperk:[['Towel dislocates x15','arms straight, slow arc'],['Torso rotations x20','let the arms swing'],['Teep primer x10 each leg','zero load, balance and range'],['Check primer x10 each','knee up, shin out'],['Light shadow 2 min','build up slow']],
  full:[['Light shadow 2 min'],['Arm circles + jacks 30 sec'],['Slow sprawls x5','wake up the hips']]
};
const COOL = {
  hips:[['Pigeon 60 sec each'],['Hamstring + groin 60 sec each']],
  upper:[['Shoulders, lats, wrists','60 sec each'],['Neck + chest','60 sec each']],
  full:[['Full body 60 sec each'],['Nasal breathing','bring the HR down']]
};

const W = [
/* ================= WEEK 1 ================= */
{n:1,phase:'Phase 1 · Foundation',theme:'The Tools',note:'One strike at a time. You are cutting the groove, not testing it. Slow and correct beats fast and sloppy every single rep.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Lead teep x15','knee up first, push the sole, snap back'],['Rear teep x15','more power, aim sternum'],['Leg kick x15 each','pivot the base foot, shin to outer thigh'],['Body roundhouse x15 each','taller chamber, shin to ribs'],['Checks x20 each','knee up and turned out']],
   r:[['R1 teeps + footwork','teep in, step-drag out, circle, teep to reset'],['R2 kick to hands','leg kick, then 1-2 as the foot lands'],['R3 free','all kicks + 1-2s, land balanced every time']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['1-2 x20','jab face, cross chin'],['1-2-3 x15','hook to the jaw, pivot the lead foot'],['2-3-2 x15','weight shifts side to side'],['1-2 into rear leg kick x12 each','sell high, land low']],
   r:[['R1','1-2 only, pivot after every one'],['R2','1-2-3, angle off after each'],['R3','every combo ends on a leg kick'],['R4','free, 2-3 strikes max']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Stance hold 2 min','mirror or phone, fix what is off'],['Footwork','step-drag x10 each, pivot x10 each'],['Jab x15 head, x10 body','bend the knees for the body jab'],['Cross x15','back heel spins out'],['Hooks x12 each','elbow at 90, turn the hips'],['Uppercuts x12 each','legs lift it, arm delivers']],
   r:[['R1 jab only','stick it, double it, body then head'],['R2','1-2, slip, 2'],['R3 all hands','no kicks, chain 3']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest between rounds.'],['30s 1-2 nonstop','max clean output'],['30s push-ups'],['30s fast shadow'],['30s mountain climbers'],['30s sprawls'],['30s 1-2-3 shadow']],
   r:[['Finisher, 5 min'],['Plank 3 x 45 sec'],['Hollow hold 3 x 30 sec'],['Leg raises 3 x 15'],['Russian twists 3 x 30']]},
  fri:{tm:{work:150,rest:60,rounds:3},
   t:[['Slip jab x15','outside'],['Slip cross x15','inside'],['Roll x15','under the hook, up the far side'],['Parry x15','tap it off line'],['Slip into counter x12 each','slip, then fire']],
   r:[['R1','pure defense, make it miss'],['R2','defense into one counter'],['R3','defend, counter 2, pivot out']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s max 1-2'],['30s push-up variations'],['30s 1-2, slip, 2'],['30s slips + counters'],['30s plank shoulder taps'],['30s 2-3-2 full speed']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 20'],['Side plank 3 x 30 sec each'],['Bicycles 3 x 30']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','every strike from the week, zero power'],['Mobility 15 min','pigeon, 90/90, deep squat, t-spine, shoulders'],['Film 10 min','the jab and nothing else. GSP or Volkanovski. Watch one round straight through, then replay 2 or 3 exchanges counting jabs, then say one takeaway out loud. Keep this fighter all phase.']],
   r:[]}
 }},

/* ================= WEEK 2 ================= */
{n:2,phase:'Phase 1 · Foundation',theme:'Sharpening',note:'Same tools, more of them, and the body opens up. Volume climbs about 20%. Add the calf kick and the switch kick.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Lead teep x20 / Rear teep x20','step in behind the rear one'],['Calf kick x20 each','below the knee, outside, chopping down'],['Leg kick x20 each'],['Body roundhouse x20 each'],['Switch kick x12 each','hop-switch, rear kick to the body'],['Checks x20 each']],
   r:[['R1 long range','teeps + calf kicks only'],['R2 kick-hand-kick','leg kick, 1-2, body kick'],['R3 free','all kicks + 1-2s']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['1-1-2 x15','double jab, cross'],['1-2-3-2 x15'],['1-2-5-2 x12','jab, cross, lead uppercut, cross'],['Kick-hand-kick x10 each','leg kick, 1-2, leg kick']],
   r:[['R1','double jab everything'],['R2','every combo starts with a kick'],['R3','every combo ends with a kick'],['R4','free, 3-4 strikes']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Footwork','step-drag, lateral, pivot x10 each'],['Jab x20 head, x15 body'],['Cross x20 head, x12 body'],['Hooks x15 each','head and ribs'],['Uppercuts x15 each'],['1-6-3 x10','jab, rear uppercut, lead hook']],
   r:[['R1','jab + body jab, change levels'],['R2 head-body-head','1, 2 to the body, 3 to the head'],['R3','all hands, 3-4 punch chains']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s 1-2-3 nonstop'],['30s push-ups'],['30s shadow with level changes'],['30s mountain climbers'],['30s sprawl and pop up'],['30s 1-2-3-2']],
   r:[['Finisher, 5 min'],['Plank 3 x 50 sec'],['Hollow hold 3 x 35 sec'],['Leg raises 3 x 18'],['Russian twists 3 x 35']]},
  fri:{tm:{work:150,rest:60,rounds:3},
   t:[['Slip x20 each side'],['Slip-slip x15','both sides, stay in the pocket'],['Roll x15'],['Parry + counter x12 each'],['Catch the jab, return the jab x12']],
   r:[['R1','slip-slip-reset only'],['R2','slip into the cross counter'],['R3','roll into the hook counter']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s 1-2-3 max'],['30s push-ups'],['30s body-head hands'],['30s slip counter'],['30s up-downs'],['30s 1-6-3 full speed']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 25'],['Side plank 3 x 35 sec each'],['Bicycles 3 x 40']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','the new stuff: calf kick, switch kick, 1-6-3'],['Mobility 15 min','in order, long exhales, no bouncing: 90/90 x10 then 60 sec each side, couch stretch 90 sec each side, frog rocks x10 then 60 sec, elephant walks x10, cossack squats x8 each, pigeon 60 sec each'],['Film 10 min','calf and body kicks. Gaethje low, Barboza body.']],
   r:[]}
 }},

/* ================= WEEK 3 ================= */
{n:3,phase:'Phase 2 · Connection',theme:'Chains',note:'Strikes stop being singles. Hand to kick to hand, and back. Long chains, both stances. This is where it starts to feel like striking instead of drilling.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Rear teep + step-in cross x15'],['Calf kick x20 each'],['Leg kick x15 each'],['Body roundhouse x15 each'],['Switch kick x15 each'],['Question mark kick x10 each','chamber low like a leg kick, snap it up high']],
   r:[['R1 kick chains','leg, body, leg on the same side'],['R2 hand-kick-hand','1-2, leg kick, 2'],['R3 switch stance','switch feet, kick, switch back']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['1-2-3-2-3 x12','five strikes, one motion'],['1-2 body, 3 head x12'],['Hand-kick-hand x12 each'],['Kick-hand-kick x12 each'],['1-2, level fake, 1-2 x10']],
   r:[['R1','five-strike chains only'],['R2','kick in the middle, not the end'],['R3','level-change fake in every combo'],['R4','free flow, 4-5 strikes']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['1-1-2-3 x12'],['1-2-3-2-3 x12'],['2-3-2 to the body x12'],['1-6-3-2 x10'],['3-2-3 x12','lead with the hook']],
   r:[['R1','lead with anything except the jab'],['R2','body-head chains, 4+ punches'],['R3','pivot after every chain']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s five-punch chains'],['30s push-ups'],['30s shadow + sprawl mixed'],['30s mountain climbers'],['30s sprawl into 1-2'],['30s body-head chains']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 40 sec'],['Leg raises 3 x 20'],['Russian twists 3 x 40']]},
  fri:{tm:{work:150,rest:60,rounds:3},
   t:[['Slip into 2-3 punch counter x12 each'],['Catch and counter x12'],['Roll into 3-2 x12'],['Shell, pivot, counter x10'],['Check the kick, kick back x12 each']],
   r:[['R1','defense into 2-3 punch counters'],['R2','check the kick, return the kick'],['R3','defend, counter, angle out']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s five-punch chains max'],['30s push-up variations'],['30s body-head'],['30s catch-counter'],['30s up-downs'],['30s free chains']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 25'],['Side plank 3 x 40 sec each'],['Bicycles 3 x 40']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','every chain slow, both stances'],['Mobility 15 min','extra hips, the switch kicks tax them'],['Film 10 min','hands into kicks. Pereira, 1-2 into the left low kick.']],
   r:[]}
 }},

/* ================= WEEK 4 ================= */
{n:4,phase:'Phase 2 · Connection',theme:'Setups',note:'Nothing lands cold. Every strike is bought with a feint, a level change, or a hand that opens the leg. This is the week that separates you from a guy swinging in his yard.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Hand feint into leg kick x12 each','flash the jab, kick low'],['Level change into head kick x10 each','they cover low, you go high'],['Teep feint into leg kick x12 each'],['Question mark kick x12 each'],['Body kick then head kick, same side x10 each']],
   r:[['R1','every kick gets a hand feint first'],['R2 low-low-high','two leg kicks, then the head kick'],['R3','free kicks, always set up']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['Jab feint into 2-3 x15'],['Level fake into 1-2-3 x12'],['Body feint into head shot x12'],['1-2 body, 3 head x12'],['Feint, kick, hands x10 each']],
   r:[['R1','feint before every combo'],['R2','body first, head second, always'],['R3','fake the shot, come up throwing'],['R4','free, everything set up']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Jab feint x15','sell it with the shoulder, not the hand'],['Feint into 2 x15'],['Double jab, feint, cross x12'],['Body feint into uppercut x12'],['Shoulder feint into hook x12']],
   r:[['R1 feints only','no real strikes, just sell them'],['R2','feint into one real shot'],['R3','mix real and fake at random']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s feint-combo nonstop'],['30s push-ups'],['30s shadow with feints'],['30s mountain climbers'],['30s sprawl into counter'],['30s body-head chains']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 40 sec'],['Leg raises 3 x 20'],['Russian twists 3 x 40']]},
  fri:{tm:{work:150,rest:60,rounds:3},
   t:[['Pull counter x12','lean back, they miss, cross'],['Slip outside into 3 x12'],['Catch, step, counter x12'],['Check into counter cross x12 each'],['Long guard, frame, counter x10']],
   r:[['R1','pull counters only'],['R2','defense into a set-up counter'],['R3','defend, feint, counter']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s feint into combo, max'],['30s push-up variations'],['30s body-head'],['30s pull counter'],['30s up-downs'],['30s free chains with feints']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 30'],['Side plank 3 x 40 sec each'],['Bicycles 3 x 45']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','every setup, sell each feint'],['Mobility 15 min','in order, long exhales, no bouncing: 90/90 x10 then 60 sec each side, couch stretch 90 sec each side, frog rocks x10 then 60 sec, elephant walks x10, cossack squats x8 each, pigeon 60 sec each'],['Film 10 min','feints only. Ilia or Volkanovski, watch the shoulder.']],
   r:[]}
 }},

/* ================= WEEK 5 ================= */
{n:5,phase:'Phase 3 · Reaction',theme:'Counters',note:'Stop initiating everything. Read, react, punish. The bag lands this week: run every Rounds block on it, wraps and gloves every time, kicks at 60-70% while the shins adapt. NO BAG YET: shadow every Rounds block, and it should already be on the truck.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Check into return kick x15 each'],['Catch the teep, return the leg kick x12'],['Counter the jab with a lead teep x12'],['Intercept the step-in, rear teep x12'],['Counter the kick with a cross x12 each']],
   r:[['R1','counter every imagined kick with a kick'],['R2','teep to intercept them coming in'],['R3','free counters']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['Counter the jab: slip outside, 3 x15'],['Counter the cross: slip inside, 2 x15'],['Counter the hook: roll, 3-2 x12'],['Counter the kick: check, 2-3 x12'],['Counter the shot: sprawl, uppercut x10']],
   r:[['R1','counters only, never lead'],['R2','counter into your own chain'],['R3','counter, then angle'],['R4','mix leading and countering']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Check hook x15','pivot away as you hook, catch them coming in'],['Pull counter x15'],['Shoulder roll into 2 x12'],['Cross counter x15','over the top of their jab'],['Uppercut on the level change x12']],
   r:[['R1','check hook only'],['R2','pull counter only'],['R3','free counter boxing']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s counter chains'],['30s push-ups'],['30s slip-counter shadow'],['30s mountain climbers'],['30s sprawl to uppercut'],['30s free counters']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 22'],['Russian twists 3 x 45']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['Check hook x12'],['Pull counter x12'],['Cross counter x12'],['Roll counter x12'],['Sprawl counter x12'],['Check and return x12 each']],
   r:[['R1','counter only, no leads'],['R2','counter into a 3-strike chain'],['R3','counter, angle out, re-enter']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s counter chains max'],['30s push-up variations'],['30s check hook'],['30s pull counter'],['30s up-downs'],['30s free counter boxing']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 30'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','every counter, slow'],['Mobility 15 min','in order, long exhales, no bouncing: 90/90 x10 then 60 sec each side, couch stretch 90 sec each side, frog rocks x10 then 60 sec, elephant walks x10, cossack squats x8 each, pigeon 60 sec each'],['Film 10 min','counters. Anderson Silva or Pereira, the beat before it lands.']],
   r:[]}
 }},

/* ================= WEEK 6 ================= */
{n:6,phase:'Phase 3 · Reaction',theme:'Timing & Angles',note:'Same strikes, better real estate. Stop trading in front of people. Hit from where they are not looking, and never end a combo where you started it.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Step off-angle, then kick x12 each'],['Kick, pivot, kick x10 each'],['Switch stance, kick, switch back x12'],['Southpaw leg kick x12','switch and kick from the other side'],['Teep to create the angle x12']],
   r:[['R1','angle before every kick'],['R2','kick from both stances'],['R3','free, always off-angle']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['1-2, pivot, 3 x15'],['Chain, angle, chain x12'],['Circle away from the power hand, 2 min'],['Step-in 1-2, step out, re-enter x12'],['Combo, angle, kick x12']],
   r:[['R1','pivot after every single combo'],['R2','in and out, never stand still'],['R3','circle one way the whole round, then the other'],['R4','free, constant angles']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Pivot drills x20 each way'],['1-2, pivot left, 1-2 x12'],['Jab, step off-line, cross x12'],['Cut the angle, hook x12'],['In-out-in x15','step in, out, back in with a shot']],
   r:[['R1 footwork only','no punches, just move'],['R2','only punch off an angle'],['R3','free, never square up']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s combo-angle-combo'],['30s push-ups'],['30s shadow, constant movement'],['30s mountain climbers'],['30s sprawl, pop up, angle out'],['30s free with angles']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 22'],['Russian twists 3 x 45']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['Slip, counter, angle x12 each'],['Check hook into pivot x12'],['Pull counter into step-off x12'],['Roll, counter, circle out x12'],['Catch, angle, counter x12']],
   r:[['R1','counter then immediately angle'],['R2','never counter from where you defended'],['R3','free, counter and reposition']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s combo-angle-combo max'],['30s push-up variations'],['30s in-out-in'],['30s counter and pivot'],['30s up-downs'],['30s free, always moving']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 30'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','angles only, slow'],['Mobility 15 min','in order, long exhales, no bouncing: 90/90 x10 then 60 sec each side, couch stretch 90 sec each side, frog rocks x10 then 60 sec, elephant walks x10, cossack squats x8 each, pigeon 60 sec each'],['Film 10 min','feet only. Volkanovski, ignore his hands entirely.']],
   r:[]}
 }},

/* ================= WEEK 7 ================= */
{n:7,phase:'Phase 4 · Power',theme:'Heavy Hands',note:'First full bag phase. Power is a skill air cannot teach: ground force through rotation into a real object. Sit down on every shot, kick through the bag, kicks at 80% while the shins adapt. NO BAG YET: run it as shadow, chase snap and full retraction instead of impact, add one round per session, and treat Power as postponed rather than skipped.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Range check 2 min','stand where the shin lands, not the foot'],['Leg kick x15 each','80%, kick through it, bag folds around the shin'],['Body kick x15 each','hip turns all the way over on contact'],['Power teep x15 each','rock it straight back'],['Switch kick x12 each','the bag tells you if the hip loaded']],
   r:[['R1 kicks only','through the bag, never at it'],['R2 kick-hand-kick','leg kick, 1-2, body kick'],['R3 free kicks','step back to range after every strike']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['1-2 at 80% x20','sit down, make the bag jump'],['1-2-3 x15','hook meets the bag swinging back'],['Hand-kick-hand x12 each','1-2, leg kick, 2'],['3-2 in close x12','short and heavy'],['Chain into low kick x10','1-2-3-2, finish on the leg']],
   r:[['R1','power 1-2 only, full sit-down'],['R2','every chain ends on a kick'],['R3','in close, hooks and uppercuts only'],['R4','free power chains']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Body jab x15','bend the knees, dig it in'],['Body hooks x15 each','rip under the elbows'],['Uppercuts in close x12 each','bag on your chest, dig up'],['Head-body-head x12','1 up, 2 down, 3 up']],
   r:[['R1 jab only','real contact, real snap'],['R2 body only','invest downstairs all round'],['R3 all hands 70%','light feet, you squatted today']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec on the bag. 1:00 rest.'],['30s max output'],['30s push-ups'],['30s body shots only'],['30s mountain climbers'],['30s sprawl into 1-2 on the bag'],['30s free hands']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 25'],['Russian twists 3 x 50']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['Touch, slip, counter x15 each','tap the bag as their jab, slip, cross back'],['Counter then angle x12','land it, circle off, reset'],['Check into cross x12 each'],['Pull, then 2 x12'],['Roll, then 3-2 x12']],
   r:[['R1','slip-counter on the bag only'],['R2','every counter ends with an angle'],['R3','free counters']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands on the bag. 1:00 rest.'],['30s max straights'],['30s push-up variations'],['30s body-head'],['30s slip-counter'],['30s up-downs'],['30s free hands']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 35'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','no bag today, groove the clean form back in'],['Mobility 15 min','shins and hips took new impact, take all of it'],['Film 10 min','a power puncher. Ngannou or Ilia, watch the rear heel and knees.']],
   r:[]}
 }},

/* ================= WEEK 8 ================= */
{n:8,phase:'Phase 4 · Power',theme:'Pressure & Pace',note:'The bag swings, and the swing is an opponent moving. Hit it coming in, chase it going out, hold fight pace throughout. Hardest week of the camp. Kicks to full power. NO BAG YET: shadow the same drills against an imagined opponent who advances and retreats, and keep the pace honest since pace is the real lesson here.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Teep the advance x15','it swings at you, stop it'],['10 leg kicks straight x3 each side','power can drop, form cannot'],['Chase kick x12 each','it swings away, body kick follows it'],['Knees x15 each','cup the top, pull it onto the knee'],['Check, return kick x12 each']],
   r:[['R1 volume','kick output, feet never stop'],['R2 the swing','time every kick to it coming in'],['R3 free','kicks and knees at fight pace']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['Walk-down combo x12','cut it off, combo, step with it'],['6-strike chains x10','hands and kicks, no pauses'],['Hit the return x12','it swings back, you are already throwing'],['Elbows in close x12 each','bag on your chest, short and sharp'],['Level fake into 1-2 x10']],
   r:[['R1 pressure','walk it down all round'],['R2 long chains','nothing under 5 strikes'],['R3 close range','elbows, uppercuts, knees'],['R4 fight pace','free, no coasting']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Hit the advance x15','1-2 as it swings in, that is timing'],['In-out on the swing x12','in behind the jab, out before it returns'],['Punch-out 30 sec x3','nonstop straights, form holds to the buzzer'],['Body-head tired x12','when the arms burn, dig the body']],
   r:[['R1 timing','only punch when it comes to you'],['R2 in-and-out','never flat, never square'],['R3','free, last 30 sec is a punch-out']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec on the bag. 1:00 rest. Hardest session of the camp.'],['30s all-out'],['30s push-ups'],['30s body shots'],['30s mountain climbers'],['30s sprawl into a burst'],['30s punch-out, straights only']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 25'],['Russian twists 3 x 50']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['The swing is the attack','it comes in, you make it miss'],['Slip the swing, 2-3 x15'],['Pivot off it, hook x12'],['Frame it off, knee x12','long guard into the clinch knee'],['Bait: wait, slip late, counter x10']],
   r:[['R1','pure reaction, no leads'],['R2','counter, angle, re-enter'],['R3','free, make it miss then make it pay']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands on the bag. 1:00 rest.'],['30s punch-out'],['30s push-up variations'],['30s hit the advance'],['30s slip-counter'],['30s up-downs'],['30s fight pace free']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 35'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','slow everything back down'],['Mobility 15 min','biggest week yet, take every minute'],['Film 10 min','cage cutting. Khabib or Merab, cutting not chasing.']],
   r:[]}
 }},

/* ================= WEEK 9 ================= */
{n:9,phase:'Phase 5 · Creation',theme:'Rhythm',note:'A readable rhythm is how you get hit. Fast, slow, pause, burst, on the bag now. Same strikes on a beat nobody can count. This is the week it starts being fun.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Broken-rhythm kicks x12','pause mid-combo, then kick'],['Fast-fast-slow kick chains x10'],['Double leg kick, same side x12 each'],['Kick on the half beat x12','kick while they reset'],['Fake the kick, kick anyway x10']],
   r:[['R1','change speed every combo'],['R2','pause, then explode'],['R3','free, no rhythm they can read']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['Fast-fast-slow chains x12'],['Pause mid-chain, restart x12'],['Triple jab into 2-3 x10'],['Half-beat cross x12'],['Burst: 6 strikes fast x8']],
   r:[['R1','speed changes only'],['R2','burst, reset, burst'],['R3','pause and go'],['R4','free, unreadable']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Rhythm jab x20','fast, slow, double, pause'],['Fast-fast-slow hands x15'],['Broken chains x12'],['Burst of 6 x10'],['Stutter step into 2 x12']],
   r:[['R1','vary the jab rhythm all round'],['R2','bursts only'],['R3','free rhythm']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s burst, reset, burst'],['30s push-ups'],['30s broken-rhythm shadow'],['30s mountain climbers'],['30s sprawl into a burst'],['30s free rhythm']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 25'],['Russian twists 3 x 50']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['Counter on the half beat x12','catch them mid-rhythm'],['Bait, then pull counter x12','give them a target on purpose'],['Slow the pace, then counter fast x12'],['Feint, draw the shot, counter x12'],['Check hook off a rhythm break x12']],
   r:[['R1','bait and counter'],['R2','counter on the half beat'],['R3','free, make them commit then punish']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s bursts max'],['30s push-up variations'],['30s fast-fast-slow'],['30s bait and counter'],['30s up-downs'],['30s free rhythm boxing']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 35'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Shadow 40-50%, 15 min','play with tempo, no power'],['Mobility 15 min','in order, long exhales, no bouncing: 90/90 x10 then 60 sec each side, couch stretch 90 sec each side, frog rocks x10 then 60 sec, elephant walks x10, cossack squats x8 each, pigeon 60 sec each'],['Film 10 min','pace changes. Max Holloway, count the beats.']],
   r:[]}
 }},

/* ================= WEEK 10 ================= */
{n:10,phase:'Phase 5 · Creation',theme:'Free',note:'No prescribed combos. Everything you built, unscripted, on the bag and in the air. Run the 5-point checkpoint Sunday, then book the trial class.',
 d:{
  mon:{tm:{work:180,rest:60,rounds:3},
   t:[['Teeps only x20','clean means full hip and the foot back to stance. Count them'],['Roundhouse x10 each','full pivot, recover balanced, count them'],['Every kick behind a hand x12','jab kick, cross kick, your pick'],['Both stances, 2 min each'],['Entry, kick, exit x12','get in, land it, get out clean']],
   r:[['R1','orthodox free'],['R2','southpaw free'],['R3','switch freely, mid-combo']]},
  tue:{tm:{work:180,rest:60,rounds:4},
   t:[['Long range only, 3 min','jab and teep, step out after everything. Nothing inside'],['Close range, 3 min','get behind the hands, finish every exchange with a kick'],['Exits, 3 min','every exchange ends with a pivot or a 45 step, never stand and admire'],['Off the back foot, 3 min','he walks you down, counter and angle off'],['Free, 3 min','checkpoints: hands home, exhale every strike, never square']],
   r:[['R1','you lead the exchange'],['R2','you counter the exchange'],['R3','your choice, switch mid-round'],['R4 fight sim','imagine a full round against someone real']]},
  wed:{tm:{work:180,rest:60,rounds:3},
   t:[['Jab only, 3 min','step jab, double jab, body jab, feint. Count 30 clean'],['Lead hand and feet, 3 min','circle both ways, the cross stays home'],['Open and close with the jab, 3 min','every combo starts and ends on it'],['End on a slip or roll, 3 min','every combo closes with defense, then answer'],['Free, 3 min','chin down, elbows in, breathe out on every punch']],
   r:[['R1','free, pretend it is round 1'],['R2','free, pretend you are down'],['R3','free, pretend you are ahead and managing']]},
  thu:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec. 1:00 rest.'],['30s free max output'],['30s push-ups'],['30s free shadow'],['30s mountain climbers'],['30s sprawl into free'],['30s free, whatever comes']],
   r:[['Finisher, 5 min'],['Plank 3 x 60 sec'],['Hollow hold 3 x 45 sec'],['Leg raises 3 x 25'],['Russian twists 3 x 50']]},
  fri:{tm:{work:180,rest:60,rounds:3},
   t:[['Movement only, 3 min','the caller runs it: slip left, slip right, roll. No punches back'],['Defend then one counter, 3 min','adds checks and long guard'],['Defend first, then fire, 3 min','the caller mixes attacks and combos'],['Counter and exit, 3 min','same, plus angle out after every counter'],['Free reaction, 3 min','first answer to any imagined shot is a named defense, never a lean back']],
   r:[['R1','pure reaction, no leads'],['R2','defend, counter, angle, repeat'],['R3','free']]},
  sat:{tm:{work:180,rest:60,rounds:5},
   t:[['Rotate every 30 sec, hands only. 1:00 rest.'],['30s free max'],['30s push-up variations'],['30s free hands'],['30s free counters'],['30s up-downs'],['30s fight sim pace']],
   r:[['Finisher, 5 min'],['Hollow rocks 3 x 35'],['Side plank 3 x 45 sec each'],['Bicycles 3 x 50']]},
  sun:{tm:null,
   t:[['Film one full round','then run the checkpoint below'],['1. Hands','return to guard every time, zero drops'],['2. Feet','never cross, never square, never flat'],['3. Pivot','every kick pivots, every landing balanced'],['4. Flow','1-2-3 is one motion, not three decisions'],['5. Gas','last round looks like the first']],
   r:[['Pass all 5?','Book the free trial class. You are gym-ready.'],['Miss any?','Rerun the phase that owns it, not the whole camp.']]}
 }}
];

const CATS = [
{cat:'Stance & Footwork',moves:[
 {name:'Stance',tag:'Orthodox. Bladed, not square.',steps:['Feet just past shoulder width, lead toe at the target, rear foot 45, rear heel up.','Weight 50/50, knees soft. Hands: lead at the eyebrow, rear on the cheek.'],cue:'Square and flat-footed is how you get slept. Stay bladed, stay on the balls of your feet.',vid:'MMA stance fundamentals orthodox'},
 {name:'Step-Drag',tag:'Move without crossing your feet.',steps:['Near foot steps, far foot drags to restore the width. Every direction.','Width never changes, so you can strike or defend on any frame.'],cue:'The moment your feet cross or come together you cannot punch and you cannot defend.',vid:'boxing footwork step drag drill'},
 {name:'Pivot',tag:'Change the angle you face.',steps:['Plant the lead foot, swing the rear foot around it.','Now you are on their side while they still face where you were.'],cue:'Pivot on the ball of the lead foot, not the heel. Hands stay up through the turn.',vid:'boxing pivot footwork drill'},
 {name:'Switch Stance',tag:'Trade orthodox for southpaw.',steps:['Small hop, feet trade places. Lead hand becomes rear hand.','Opens the other side of the body for kicks and changes every angle.'],cue:'Do it between strikes, not during one. Switching while they punch is how you get caught mid-air.',vid:'switch stance striking MMA'},
 {name:'Cutting the Angle',tag:'Step off the centerline, then hit.',steps:['Step your lead foot outside their lead foot, then pivot in.','You end up facing their chest while they face empty air.'],cue:'Angle first, then punch. Punching then angling is just running away.',vid:'cutting angles striking footwork'},
 {name:'In-and-Out',tag:'Enter, land, leave.',steps:['Explode in behind a strike, land, immediately step-drag out or pivot off.'],cue:'Never end a combo standing where you threw it. That is where the return shot lands.',vid:'in and out footwork boxing'}
]},

{cat:'Punches',numbox:'<b>1</b> jab · <b>2</b> cross · <b>3</b> lead hook · <b>4</b> rear hook · <b>5</b> lead uppercut · <b>6</b> rear uppercut. So 1-2-3 is jab, cross, lead hook. Every combo in the program uses these.',moves:[
 {name:'Jab (1)',tag:'Lead straight. Range finder, setup, interrupter.',steps:['Straight out, fist turns palm-down on landing, retracts on the same line.','Body jab: bend the knees to change level, do not bend at the waist.'],cue:'No wind-up, no telegraph. The rear hand never leaves your cheek while it is out.',vid:'how to throw a jab technique breakdown'},
 {name:'Cross (2)',tag:'Rear straight. Your power hand.',steps:['Ball of the rear foot drives, hip and shoulder rotate through, hand follows.','Rear heel spins out. Lead hand stays home.'],cue:'It is a hip rotation with a hand attached. If your head travels past your front knee, you are falling into it.',vid:'cross punch hip rotation technique'},
 {name:'Lead Hook (3)',tag:'Lead-side horizontal. Head or ribs.',steps:['Elbow to about 90, roughly parallel to the floor.','Pivot the lead foot, turn the hips, the arm just carries the fist.'],cue:'Tight arc, whole body turns. Wide and loopy has no power and shows up a mile away.',vid:'lead hook technique boxing pivot'},
 {name:'Rear Hook (4)',tag:'Rear-side horizontal. Short range.',steps:['Rear arm to 90, back hip rotates through, swings across.'],cue:'Huge power, terrible range, and it opens your whole side. Finish with it, never lead with it.',vid:'rear hook boxing technique'},
 {name:'Lead Uppercut (5)',tag:'Rising, up the middle.',steps:['Small knee dip, drive up through the chin as the legs extend.'],cue:'Legs and hips lift it. If you wind the arm back first, they see it coming.',vid:'lead uppercut technique boxing'},
 {name:'Rear Uppercut (6)',tag:'Rising, rear hand. Splits a tight guard.',steps:['Small dip, drive up off the back leg and hip.'],cue:'Best punch in the game against someone hiding behind a high guard.',vid:'rear uppercut technique boxing'},
 {name:'Body Shots',tag:'Any punch, lower target.',steps:['Change level with the knees, keep the spine stacked, land on the ribs or the liver.','Then come back up top. The hands drop to protect the body, the head opens.'],cue:'Body work is an investment. It does not pay in round 1, it pays in round 3.',vid:'body punching technique level change'}
]},

{cat:'Kicks',moves:[
 {name:'Teep',tag:'Push kick. The jab of your legs.',steps:['Knee up first, then extend, sole or ball drives into the gut or sternum.','Snap it back to stance immediately, do not leave it hanging.'],cue:'Chamber the knee before you extend, or it becomes a slow front-raise they catch and dump you on.',vid:'teep push kick muay thai technique'},
 {name:'Roundhouse',tag:'The power kick. Lands with the shin.',steps:['Lead foot steps slightly out to open the hip.','Base foot pivots 45 to 90 away from the target. Hip turns all the way over.','Leg swings through like a bat, shin makes contact, not the foot.'],cue:'The base-foot pivot is the whole kick. No pivot means no power and a torqued knee.',vid:'muay thai roundhouse kick technique pivot'},
 {name:'Leg Kick',tag:'Roundhouse to the thigh.',steps:['Same mechanics, shin into the outside or inside of the thigh.','Kick through the leg, not at it.'],cue:'Nobody gets dropped by one. They get dropped by twenty. Keep buying it.',vid:'low kick technique muay thai'},
 {name:'Calf Kick',tag:'Low leg kick, below the knee.',steps:['Same pivot, target the outside of the calf just under the knee.','Shorter arc, faster, harder to check.'],cue:'Cheaper and faster than a thigh kick, and it wrecks mobility fast. Ask anyone who has eaten Gaethje calf kicks.',vid:'calf kick technique breakdown'},
 {name:'Body Kick',tag:'Roundhouse to the ribs.',steps:['Taller chamber, same pivot, shin lands just under the elbow on the liver or floating ribs.'],cue:'Aim through them, not at the surface. Turn the hip completely over or it just slaps.',vid:'body kick technique muay thai'},
 {name:'Head Kick',tag:'Roundhouse, high.',steps:['Same kick, more hip and more base-foot pivot. Range of motion decides the height.'],cue:'Only as high as your hips allow. Forcing it wrecks your balance and your back. Mobility earns this one.',vid:'head kick technique flexibility'},
 {name:'Switch Kick',tag:'Lead-leg roundhouse with a power switch.',steps:['Fast hop, feet trade places, immediately roundhouse with the new rear leg.'],cue:'The switch loads the hip so your lead-side kick lands like a rear kick instead of a slap.',vid:'switch kick muay thai technique'},
 {name:'Question Mark Kick',tag:'Fakes low, lands high.',steps:['Chamber exactly like a leg kick so they drop the elbow to check.','Snap the knee up and over the top into the head instead.'],cue:'It only works if your leg kick is real. The setup is 8 weeks of low kicks.',vid:'question mark kick technique'},
 {name:'Check',tag:'Block a leg kick with your shin.',steps:['Knee up, turn it out, point the shin at their incoming shin.','Bone meets bone. Their shin, your shin.'],cue:'Lift the knee. Just turning the foot leaves your thigh out there to get chopped.',vid:'how to check a leg kick'}
]},

{cat:'Knees & Elbows',moves:[
 {name:'Knee',tag:'Close-range. Hip thrust with a knee on it.',steps:['Hands control the head or the collar tie, thrust the hips forward, drive the knee up.','Toe pointed down, pull down with the hands as the knee rises.'],cue:'It is a hip thrust, not a leg lift. If your hips are not driving, it is a nudge.',vid:'muay thai knee technique clinch'},
 {name:'Elbow',tag:'Short, sharp, close only.',steps:['Elbow up, swing horizontally, land the point or the edge, body turns like a tight hook.'],cue:'Never hurts your hands, always opens theirs. Keep it short, turn the body.',vid:'muay thai elbow technique'}
]},

{cat:'Defense',moves:[
 {name:'Slip',tag:'Head off the line of a straight.',steps:['Jab comes: dip and rotate, head goes outside it.','Cross comes: rotate the other way, head goes inside it.'],cue:'Small dip from the legs and core. A big lean is just a slower way to get hit.',vid:'slipping punches boxing drill'},
 {name:'Roll',tag:'Under a hook, up the other side.',steps:['Knees bend, head travels a small U under the arc, come up in stance.'],cue:'Bend the knees, not the waist. Folding at the waist puts your head where the knee goes.',vid:'bob and weave technique boxing'},
 {name:'Parry',tag:'Tap a straight off line.',steps:['Small tap on their jab with the rear hand, on their cross with the lead.'],cue:'Redirect, do not reach. Reaching for it opens the lane you were covering.',vid:'parry technique boxing defense'},
 {name:'Catch',tag:'Absorb the jab in the glove.',steps:['Rear hand meets the jab, absorb it, immediately return.'],cue:'Catch and return is one motion. Catching without returning just teaches them to keep jabbing.',vid:'catch and return jab boxing'},
 {name:'Shell',tag:'High guard. Emergency shelter.',steps:['Fists to the forehead, elbows squeezed, take it on the arms.','Then pivot out or fire back.'],cue:'Temporary. Camping in a shell against kicks and knees just gives them a stationary target.',vid:'high guard shell defense boxing'},
 {name:'Long Guard',tag:'Frame with the lead arm.',steps:['Lead arm extended into their face or shoulder, measuring and blocking their line.','Buys you distance to reset or counter.'],cue:'It is a distance tool, not a block. Use it to make space, then work.',vid:'long guard technique MMA'},
 {name:'Pull',tag:'Lean back, they fall short.',steps:['Shift the weight to the back foot, head travels straight back out of range.','They miss by an inch and are extended.'],cue:'Pull straight back, not off to the side, and keep the feet under you so you can fire immediately.',vid:'pull counter technique boxing'},
 {name:'Shoulder Roll',tag:'Deflect off the lead shoulder.',steps:['Lead shoulder up, turn slightly, let their shot slide off it.','Rear hand covers the far side.'],cue:'Slick when it works, a highlight reel when it does not. Do not marry it.',vid:'shoulder roll defense technique'}
]},

{cat:'Counters',moves:[
 {name:'Check Hook',tag:'Hook and pivot away, as they come in.',steps:['They step in, you hook the lead hand and pivot off the lead foot at the same time.','They walk into it and you are gone before the return.'],cue:'The hook and the pivot are one movement. Hook first, pivot second, and you are still standing there.',vid:'check hook technique boxing'},
 {name:'Pull Counter',tag:'Make it miss, then land the cross.',steps:['Pull back off their jab, they fall short and extended.','Fire the cross into the gap before they retract.'],cue:'The gap is about half a second. Late means you eat their second shot.',vid:'pull counter cross technique'},
 {name:'Cross Counter',tag:'Over the top of their jab.',steps:['As their jab comes, your cross travels over the top of it, same instant.','Their extended arm becomes the rail your punch rides.'],cue:'Slip slightly outside as you throw or you trade straight punches and lose the exchange.',vid:'cross counter over the jab'},
 {name:'Roll Counter',tag:'Under the hook, into your own.',steps:['Roll under their hook, come up on the outside, fire 3-2.'],cue:'Come up already throwing. Coming up to look around is coming up to get hit.',vid:'roll and counter hook boxing'},
 {name:'Sprawl Counter',tag:'Stuff the shot, punish the head.',steps:['They change level, you sprawl, hips heavy.','Their head is now low and stationary. Uppercut or knee.'],cue:'Your BJJ base already owns the sprawl. Just add the strike on the way up.',vid:'sprawl to uppercut MMA counter'},
 {name:'Check and Return',tag:'Block the kick, kick back.',steps:['Check their low kick, and as your foot lands, immediately return your own.'],cue:'They are on one leg for a full beat after kicking. That beat is yours.',vid:'check and return kick muay thai'},
 {name:'Intercept',tag:'Hit them as they start.',steps:['They step in, the teep or the jab meets them mid-step.','Their forward momentum doubles the impact.'],cue:'Timing, not speed. You are hitting where they will be, not where they are.',vid:'intercepting teep timing muay thai'}
]},

{cat:'Feints & Rhythm',moves:[
 {name:'Feint',tag:'A lie your body tells.',steps:['Start the movement, sell it with the shoulder, hip, or eyes, then do not finish it.','Their reaction tells you what is open.'],cue:'A feint is not a slow punch. It is a full commitment that stops. Twitch it, do not wave it.',vid:'how to feint in boxing shoulder'},
 {name:'Level Change Fake',tag:'Sell the shot, hit high.',steps:['Drop your level like you are shooting a double, hands and eyes go low.','They react low, you come up throwing to the head.'],cue:'Your grappling background makes this one lethal, because your shot is actually real.',vid:'level change feint MMA striking'},
 {name:'Hand Feint into Kick',tag:'Flash high, land low.',steps:['Flash the jab to freeze the hands high, kick the leg while they are looking up.'],cue:'The most reliable setup in MMA. Nobody checks a kick they never saw start.',vid:'hand feint into leg kick setup'},
 {name:'Broken Rhythm',tag:'Fast, slow, pause, burst.',steps:['Deliberately vary the tempo inside a combo. Fast-fast-slow. Pause mid-chain, then finish.'],cue:'People time your rhythm, not your speed. Steady beat means they read you no matter how fast you are.',vid:'broken rhythm striking timing'},
 {name:'Half Beat',tag:'Land in the gap.',steps:['Throw in the space between their strikes, while they are resetting or retracting.'],cue:'The half beat is a real window and it is the difference between a good striker and a scary one.',vid:'half beat timing striking'},
 {name:'Baiting',tag:'Give them a target on purpose.',steps:['Deliberately leave a small opening, wait for them to take it, counter what you already knew was coming.'],cue:'You cannot bait what you cannot counter. Weeks 5 and 6 have to be solid first.',vid:'baiting and countering technique'}
]},

{cat:'Chaining & Concepts',moves:[
 {name:'Shadowboxing',tag:'The base of everything. Fight the air like it fights back.',steps:['Pick an opponent and put them somewhere. Same height, same stance, actually there.','Every strike goes at a target. Every combo gets a reaction you then deal with.'],cue:'Waving at nothing builds nothing. If you are not picturing someone, you are just doing cardio with your arms.',vid:'how to shadowbox properly beginner'},
 {name:'Hand-Kick-Hand',tag:'Switching weapons mid-combo.',steps:['Hands high pull the guard up, then the kick lands low. Then hands again while they are covering low.','Kick-hand-kick is the reverse: kick low, they drop, hands go high, kick low again.'],cue:'The switch is the point. Same level twice in a row is how you get read and countered.',vid:'linking punches into kicks combinations'},
 {name:'Chain into Low Kick',tag:'Punches buy the kick.',steps:['Throw the chain to the head. Their hands and eyes go up.','The rear leg kick lands on the last beat, while they are still up top.'],cue:'Never kick cold. The kick is the receipt for the punches you already sold.',vid:'punches into low kick combination'},
 {name:'Long Chain / Burst',tag:'Five, six, no pauses.',steps:['Strikes flow one into the next, each rotation loading the following one.','No reset between strikes. It is one movement with six contacts.'],cue:'If you are re-setting your stance between punches, that is six singles, not a chain. Let each rotation feed the next.',vid:'long boxing combinations flow drill'},
 {name:'Chase Kick',tag:'They gave ground. Take it.',steps:['They retreat or the bag swings away. Step with it and land the body kick as they move.'],cue:'Kick where they are going, not where they were. Momentum is doing half your work.',vid:'chasing kick timing muay thai'},
 {name:'Hit the Return',tag:'Strike the thing coming back at you.',steps:['The bag swings back toward you. You are already throwing before it arrives.','It arrives into your punch, not the other way around.'],cue:'This is timing, not speed. Same skill as catching someone stepping in.',vid:'heavy bag timing the swing'},
 {name:'Walk-Down',tag:'Pressure. Cut, do not chase.',steps:['Step to where they are going, not where they are. Take the space in front of them away.','Combo, step, combo. They never get to reset.'],cue:'Chasing straight forward means you eat counters all day. Cut them off at the angle instead.',vid:'cutting the cage pressure fighting'},
 {name:'Entry, Kick, Exit',tag:'Get in, land it, be gone.',steps:['Close the gap behind a strike, land the kick, immediately step-drag out or pivot off.'],cue:'The exit is the whole drill. Standing there admiring the kick is where the return lands.',vid:'entries and exits striking footwork'},
 {name:'Double Attack',tag:'Fake the kick, then kick anyway.',steps:['Start the kick and stop it. They react and commit to the block.','Throw the same kick again into the reaction they just spent.'],cue:'Works because the first one was real enough to buy. A lazy fake buys nothing.',vid:'kick feint double attack muay thai'},
 {name:'Pause and Restart',tag:'Stop mid-chain. Finish late.',steps:['Throw two, freeze for a beat, finish the chain.','They time your rhythm and start moving. You land into the gap they opened.'],cue:'Feels wrong and unnatural. That is exactly why it works.',vid:'broken rhythm pause combination'},
 {name:'Stutter Step',tag:'A feint with your feet.',steps:['A quick false step in. They react to the entry that is not coming yet.','Then the real step lands with the cross on it.'],cue:'Most people only feint with their hands. Feet lie better.',vid:'stutter step boxing entry'},
 {name:'Circling',tag:'Live on their weak side.',steps:['Circle away from their power hand. Orthodox opponent means circle toward their lead, to your left.','Constant small steps, stance width never changes.'],cue:'Circling into the power hand is walking into the shot that ends the night.',vid:'circling away from power hand boxing'},
 {name:'Free Flow',tag:'No script. Everything you own.',steps:['No prescribed combos. Kicks, hands, feints, counters, angles, whatever the imaginary exchange calls for.','If you catch yourself repeating one pattern, deliberately break it.'],cue:'This is the whole point of the camp. Scripted drills build the vocabulary, free flow is the sentence.',vid:'freestyle shadowboxing flow'},
 {name:'Torso Rotations',tag:'Warm the engine your punches run on.',steps:['Feet planted, hands up, twist left and right, let the arms swing loose.'],cue:'Every punch is a rotation. Warm the rotation before you load it.',vid:'torso rotation warm up drill'}
]},

{cat:'Bag Work',moves:[
 {name:'Bag Distance',tag:'Stand at range, not in a hug.',steps:['Set range so the roundhouse lands mid-shin and the cross lands at full extension.','Step back out to that range after every exchange.'],cue:'The bag cannot back you up, so you drift in and smother your own power. Reset after every combo.',vid:'heavy bag distance management'},
 {name:'Sitting Down on Shots',tag:'Where real power comes from.',steps:['Slight knee bend as the punch lands, weight drops through the rear foot into the floor.','The bag should jump on the chain, not slide away.'],cue:'Power goes floor, hips, hand. If the rear heel never drives, the ground never got involved.',vid:'sitting down on punches technique'},
 {name:'Kicking Through',tag:'A kick that stops at the surface is a slap.',steps:['Aim the shin at a point past the far side of the bag.','Hip fully turned over on contact, base foot fully pivoted.'],cue:'The bag folding around your shin is the sound of a real kick.',vid:'kicking through the heavy bag muay thai'},
 {name:'Shin Conditioning',tag:'The bag is the method.',steps:['Weeks 5-6 kick at 60-70%. Week 7 at 80. Week 8 on, full power.','The adaptation is progressive impact, nothing else.'],cue:'Sore shins early are normal. Bottle-rolling tricks are noise, the bag is the conditioning.',vid:'shin conditioning muay thai truth'},
 {name:'Working the Swing',tag:'The swing is an opponent moving.',steps:['Push it, let it swing. Coming at you is an advance: hit it or slip it.','Swinging away is a retreat: chase with a kick or cut the angle.'],cue:'A dead-still bag trains you for a dead-still opponent. Keep it moving.',vid:'heavy bag swing timing drill'},
 {name:'Bag Clinch',tag:'Knees and elbows in close.',steps:['Cup the top like a collar tie, pull it down onto the rising knee.','Elbows short and sharp with the bag against your chest.'],cue:'Pulling it down is half the knee. Your grappling hands already know this grip.',vid:'heavy bag clinch knees drill'},
 {name:'Punch-Out Drill',tag:'Output when the arms are gone.',steps:['Nonstop alternating straights, max speed, 30-60 sec.','Full extension and full retraction hold to the buzzer.'],cue:'The rep that gets sloppy is the one that matters. Slow down before you get ugly.',vid:'punch out drill heavy bag'},
 {name:'Wrapping Hands',tag:'Every bag session, no exceptions.',steps:['Loop the thumb, wrist x3, knuckles x3, between each finger, lock the thumb, finish at the wrist.','The job is a locked, straight wrist. Loose wraps are decoration.'],cue:'Bare knuckles on a bag is how a good week ends a training month.',vid:'how to wrap hands boxing 180 inch'}
]},

{cat:'Wrestling & Conditioning',moves:[
 {name:'Sprawl',tag:'Stuff the shot. Also a gasser.',steps:['Legs shoot back, hips drop heavy toward the floor, then pop up to stance.'],cue:'You know this. Just make sure you pop up in stance, not standing straight up.',vid:'sprawl technique wrestling'},
 {name:'Level Change',tag:'Drop straight down.',steps:['Bend the knees and hips, spine stays stacked, whole body drops.'],cue:'Down, not forward. Folding at the waist gives them your neck.',vid:'level change technique wrestling'},
 {name:'Up-Down',tag:'Burpee, no jump. Get off the floor fast.',steps:['Hands to the floor into a plank, explode back up into stance.'],cue:'Land in stance, hands up. Scrambling up flat-footed is scrambling up into a knee.',vid:'up downs conditioning drill'},
 {name:'Plank Shoulder Tap',tag:'Anti-rotation core.',steps:['Plank, tap the opposite shoulder, alternate. Hips do not rock.'],cue:'The still hips are the whole exercise. That anti-rotation is what your cross is built on.',vid:'plank shoulder tap form'},
 {name:'The Rest',tag:'Push-ups, climbers, hollow, leg raises, twists, side planks.',steps:['You lift 4-5x a week. You know these. Full range, clean form, no cheating the last reps.'],cue:'These are the tax you pay for the skill work, not the point of the session.',vid:'hollow hold form'}
]},

{cat:'Mobility',moves:[
 {name:'90/90 Hip Switch',tag:'The one that unlocks your kicks.',steps:['Sit down, front leg bent 90 in front, rear leg bent 90 out to the side, both knees on the floor.','Rotate both knees over to the other side. That is one rep.'],cue:'Both knees stay down the whole way. This is the single highest-value drill for roundhouse range.',vid:'90 90 hip switch mobility drill'},
 {name:'Deep Squat Hold',tag:'Hips, ankles, groin.',steps:['Full squat, hips below knees, heels down, elbows inside the knees pushing out.'],cue:'Chest tall. If the heels lift, wedge something thin under them and work toward flat.',vid:'deep squat hold mobility'},
 {name:'Leg Swings',tag:'Dynamic warm-up, hips and hams.',steps:['Wall for balance. Front-to-back x15, then side-to-side across the body x15. Switch.'],cue:'Relaxed, let the range grow. Do not force it cold.',vid:'leg swings dynamic warm up'},
 {name:'Pigeon',tag:'Deep hip opener.',steps:['Shin forward across the floor, rear leg straight back, sink the hips, fold over the front shin.'],cue:'Should be felt in the hip, never the knee. Back off if the knee talks.',vid:'pigeon pose hip opener'},
 {name:'T-Spine Opener',tag:'Upper back rotation. Punch power.',steps:['All fours, one hand behind the head, drive the elbow down and under, then rotate it open to the ceiling. x10 each.'],cue:'Rotate from the upper back and follow the elbow with your eyes. Do not arch the low back to fake it.',vid:'thoracic rotation open book drill'},
 {name:'Towel Dislocates',tag:'Shoulder range for punching.',steps:['Wide grip on a towel, arms straight, arc it overhead and behind, then back.'],cue:'Go wider if it is tight. Arms stay straight or you are cheating the range.',vid:'shoulder dislocates towel mobility'},
 {name:'Ankle Work',tag:'Circles + calf raises. The pivot.',steps:['Circles x10 each way, then x20 calf raises.'],cue:'Your entire kick is a base-foot pivot. Stiff ankles cap your kicks and your knees pay for it.',vid:'ankle mobility drills'},
 {name:'Neck Isometrics',tag:'Chin durability.',steps:['Palm on forehead, each temple, then the back. Press gently against it, 10 sec each.'],cue:'Gentle. This is a slow build over months, not a workout.',vid:'neck isometric exercises fighters'},
 {name:'Static Stretches',tag:'Cooldown holds.',steps:['Hamstrings, groin, shoulders, chest, lats, wrists. 60 sec each, ease in, breathe.'],cue:'After training only, never before. Static stretching cold blunts your power output.',vid:'post workout static stretching'}
]}
];
