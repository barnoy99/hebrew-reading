/* strokes.js — how each letter is written.

   Coordinates live in a 0..100 box (x right, y DOWN), read off the real Rubik
   glyphs. They are a skeleton, not an outline: the faint guide she traces is
   the actual font glyph, so these only need to be close enough to show
   "start here, go this way, in this order".

   This table is now used for ONE thing — the demonstration animation and its
   numbered start dots. Nothing is scored against it.

   THE RULE APPLIED HERE, consistently:
     · every stroke starts at the top of what it draws and moves downward
     · a horizontal roof is drawn left→right and flows straight on into the
       right-hand descender, so it is one continuous pen movement
       (this is what makes ד and ר identical, as their shapes demand)
     · a detached left leg (ה ח ת) is a separate downward stroke, drawn after
     · round letters (ס ט) are one loop; open ones (ב כ פ נ) run roof → down →
       round into the base

   >>> PLEASE REVIEW: open _strokes.html to watch all 22 animate. <<<
   Per-letter stroke order is not published as text anywhere — Israeli
   worksheets put the arrows in images — so the rule above is applied from the
   documented general principles rather than copied from a source. If any
   letter is not how it is taught, say which and it is a one-line fix: each
   letter is just a list of point lists, in writing order.                    */

const STROKES = {
  /* diagonal spine top-right → bottom-left, then the two arms that hang off it */
  alef:   [[[74,22],[26,78]], [[26,30],[48,50]], [[52,50],[74,72]]],

  /* roof → right descender → round into the base, one movement */
  bet:    [[[28,26],[68,26],[76,34],[76,66],[74,74],[20,74]]],
  gimel:  [[[62,24],[60,52],[72,76]], [[36,44],[58,60]]],

  /* ד's roof runs PAST the stem — that overhang is what tells it from ר — so
     it cannot be one movement. Two strokes, but the roof runs the same way as
     ר's, which is the inconsistency that was there before. */
  dalet:  [[[20,26],[78,26]], [[62,28],[62,76]]],
  he:     [[[24,26],[70,26],[74,32],[74,76]], [[26,42],[26,76]]],
  vav:    [[[58,24],[58,76]]],
  zayin:  [[[34,26],[70,26]], [[52,28],[52,76]]],
  het:    [[[24,26],[70,26],[74,32],[74,76]], [[26,26],[26,76]]],
  tet:    [[[28,24],[28,58],[36,72],[62,74],[72,60],[72,24]], [[58,24],[56,42]]],
  yod:    [[[44,28],[60,26],[56,48]]],
  kaf:    [[[30,26],[66,26],[74,36],[74,62],[66,74],[30,74]]],
  lamed:  [[[40,6],[60,20],[60,60],[30,76]]],
  mem:    [[[46,28],[32,42],[32,70]], [[52,26],[70,26],[70,68],[60,74],[28,74]]],
  nun:    [[[64,24],[64,66],[58,74],[32,74]]],
  samekh: [[[30,26],[66,26],[74,38],[74,60],[66,74],[30,74],[24,62],[24,40],[30,26]]],
  ayin:   [[[30,26],[46,54]], [[72,24],[58,52],[66,74],[38,76]]],
  pe:     [[[30,26],[66,26],[74,36],[74,62],[66,74],[30,74]], [[66,34],[50,42],[52,56],[70,56]]],
  tsadi:  [[[28,26],[52,52]], [[72,24],[54,52],[48,74],[74,74]]],
  kuf:    [[[24,26],[70,26],[70,94]], [[28,32],[28,54]]],
  resh:   [[[24,26],[66,26],[70,32],[70,76]]],
  shin:   [[[26,26],[30,56],[46,72]], [[50,28],[48,58]], [[74,26],[72,58],[56,72],[46,72]]],
  tav:    [[[24,26],[70,26],[74,32],[74,76]], [[30,26],[30,66],[20,76]]]
};
