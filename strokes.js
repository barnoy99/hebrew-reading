/* strokes.js — how each letter is written, not just what it looks like.

   Coordinates live in a 0..100 box (x right, y DOWN), read off the real Rubik
   glyphs. They are a skeleton, not an outline: the faint guide she traces is
   still the actual font glyph, so these only need to be close enough to say
   "start here, go that way, in this order".

   One table drives three things:
     - the numbered arrows on the guide,
     - the direction / order check,
     - the demonstration animation shown when she gets it wrong.

   >>> STROKE ORDER IS THE ONE THING TO REVIEW. <<<
   Conventions vary between teachers, and teaching the wrong habit is worse
   than teaching none. Open _strokes.html to watch all 22 animate, and correct
   anything wrong here — each letter is just a list of point lists.           */

/* א is deliberately absent: its three short strokes meeting on a diagonal do
   not trace well at this age and the guide read badly. Letters without an
   entry here are simply skipped by the writing mode (Engine.writeQueue filters
   on STROKES), so removing one is all it takes to retire it. */
const STROKES = {
  bet:    [[[30,25],[70,25],[76,33],[76,68]], [[78,74],[20,74]]],
  gimel:  [[[64,24],[62,50],[72,76]], [[36,46],[60,62]]],
  dalet:  [[[78,26],[20,26]], [[60,28],[60,76]]],
  he:     [[[24,26],[74,26],[74,76]], [[26,42],[26,76]]],
  vav:    [[[58,24],[58,76]]],
  zayin:  [[[34,26],[70,26]], [[52,28],[52,76]]],
  het:    [[[24,26],[74,26],[74,76]], [[26,26],[26,76]]],
  tet:    [[[28,24],[28,58],[36,72],[62,74],[72,60],[72,24]], [[58,24],[56,42]]],
  yod:    [[[44,28],[60,26],[56,48]]],
  kaf:    [[[30,26],[66,26],[74,36],[74,62],[66,74],[30,74]]],
  lamed:  [[[40,6],[60,20],[60,60],[30,76]]],
  mem:    [[[44,26],[30,40],[30,74]], [[44,26],[72,26],[72,74],[28,74]]],
  nun:    [[[64,24],[64,66],[58,74],[32,74]]],
  samekh: [[[70,26],[30,26],[24,40],[24,62],[30,74],[66,74],[74,60],[74,38],[70,26]]],
  ayin:   [[[30,26],[46,54]], [[72,24],[58,52],[66,74],[38,76]]],
  pe:     [[[30,26],[66,26],[74,36],[74,62],[66,74],[30,74]], [[66,34],[50,42],[52,56],[70,56]]],
  tsadi:  [[[28,26],[52,52]], [[72,24],[54,52],[48,74],[74,74]]],
  kuf:    [[[24,26],[70,26],[70,94]], [[28,32],[28,54]]],
  resh:   [[[24,26],[66,26],[70,32],[70,76]]],
  shin:   [[[26,26],[30,56],[46,72]], [[50,28],[48,58]], [[74,26],[72,58],[56,72],[46,72]]],
  tav:    [[[24,26],[74,26],[74,76]], [[30,26],[30,66],[20,76]]]
};

/* Tolerances for the direction/order check, in the same 0..100 units.
   startNear/endNear together are what distinguish "she drew stroke 2 first"
   from "she drew stroke 1": a start check alone is not enough, because for a
   letter like ה both strokes begin near the left edge. */
const STROKE_RULES = {
  startNear: 20,   // her stroke must begin this close to the reference start
  pathNear:  22    // and follow the whole reference path this closely, compared
                   // point-by-point after resampling both to even spacing
};
