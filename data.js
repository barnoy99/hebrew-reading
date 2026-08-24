/* data.js — all content lives here. Swap the theme by editing THEME + GARDEN. */

const CHILD = { name: 'אליה' };

/* ---------- ניקוד ----------
   Simple vowels only. No חטפים, no פתח גנובה, no קמץ קטן, no שווא.
   `order` = unlock stage. Vowels sharing an order are taught together
   (קמץ/פתח both say "a"; צירה/סגול both say "e").
   `after:true` means the mark follows the letter instead of sitting under it. */
const VOWELS = [
  { id:'kamatz', mark:'ָ',       name:'קָמָץ',  sound:'a', order:1 },
  { id:'patah',  mark:'ַ',       name:'פַּתָּח',  sound:'a', order:1 },
  { id:'hirik',  mark:'ִ',       name:'חִירִיק', sound:'i', order:2 },
  { id:'holam',  mark:'ֹ',       name:'חוֹלָם',  sound:'o', order:3 },
  { id:'shuruk', mark:'וּ', name:'שׁוּרוּק', sound:'u', order:4, after:true },
  { id:'tsere',  mark:'ֵ',       name:'צֵירֵה',  sound:'e', order:5 },
  { id:'segol',  mark:'ֶ',       name:'סֶגּוֹל',  sound:'e', order:5 }
];

/* ---------- אותיות ----------
   dagesh:true  -> v1 always renders the plosive form (בּ כּ פּ).
   confuse      -> visually similar letters, used for hard distractors only.  */
const LETTERS = [
  { id:'alef',   ch:'א', name:'אָלֶף',  sound:'',   silent:true, confuse:['ayin'] },
  { id:'bet',    ch:'ב', name:'בֵּית',   sound:'b',  dagesh:true, confuse:['kaf','nun'] },
  { id:'gimel',  ch:'ג', name:'גִּימֶל', sound:'g',  confuse:['nun','tsadi'] },
  { id:'dalet',  ch:'ד', name:'דָּלֶת',  sound:'d',  confuse:['resh','kaf'] },
  { id:'he',     ch:'ה', name:'הֵא',    sound:'h',  confuse:['het','tav'] },
  { id:'vav',    ch:'ו', name:'וָו',    sound:'v',  confuse:['zayin','yod'] },
  { id:'zayin',  ch:'ז', name:'זַיִן',   sound:'z',  confuse:['vav'] },
  { id:'het',    ch:'ח', name:'חֵית',   sound:'ch', confuse:['he','tav'] },
  { id:'tet',    ch:'ט', name:'טֵית',   sound:'t',  confuse:['mem'] },
  { id:'yod',    ch:'י', name:'יוֹד',   sound:'y',  confuse:['vav'] },
  { id:'kaf',    ch:'כ', name:'כַּף',    sound:'k',  dagesh:true, confuse:['bet','dalet'] },
  { id:'lamed',  ch:'ל', name:'לָמֶד',  sound:'l',  confuse:[] },
  { id:'mem',    ch:'מ', name:'מֵם',    sound:'m',  confuse:['tet','samekh'] },
  { id:'nun',    ch:'נ', name:'נוּן',    sound:'n',  confuse:['gimel','bet'] },
  { id:'samekh', ch:'ס', name:'סָמֶךְ',  sound:'s',  confuse:['mem'] },
  { id:'ayin',   ch:'ע', name:'עַיִן',   sound:'',   silent:true, confuse:['tsadi','alef'] },
  { id:'pe',     ch:'פ', name:'פֵּא',    sound:'p',  dagesh:true, confuse:[] },
  { id:'tsadi',  ch:'צ', name:'צַדִּי',   sound:'ts', confuse:['ayin','gimel'] },
  { id:'kuf',    ch:'ק', name:'קוֹף',   sound:'k',  confuse:[] },
  { id:'resh',   ch:'ר', name:'רֵישׁ',   sound:'r',  confuse:['dalet'] },
  { id:'shin',   ch:'ש', name:'שִׁין',   sound:'sh', confuse:[] },
  { id:'tav',    ch:'ת', name:'תָּו',    sound:'t',  confuse:['he','het'] }
];

/* What Eliya already knows, as of today. Adjust freely in the parent panel. */
const START_LETTERS = ['alef','bet','gimel','dalet','he','resh','tav','lamed'];
const START_VOWELS  = ['kamatz','patah','hirik'];

/* Order new letters arrive in: frequent + visually distinct first,
   with confusable partners deliberately spaced apart.                */
const LETTER_ORDER = [
  'mem','shin','yod','nun','vav','kuf','samekh','het',
  'kaf','pe','tsadi','ayin','zayin','tet'
];

/* ---------- מילים אמיתיות ----------
   Offered only when every required letter AND vowel is unlocked.
   Stored literally — never generated.                              */
const REAL_WORDS = [
  { w:'אַבָּא',  pic:'👨',  letters:['alef','bet'],              vowels:['patah','kamatz'] },
  { w:'גַּג',    pic:'🏠',  letters:['gimel'],                   vowels:['patah'] },
  { w:'דָּג',    pic:'🐟',  letters:['dalet','gimel'],           vowels:['kamatz'] },
  { w:'הַר',    pic:'⛰️',  letters:['he','resh'],               vowels:['patah'] },
  { w:'בַּד',    pic:'🧵',  letters:['bet','dalet'],             vowels:['patah'] },
  { w:'רַב',    pic:'👨‍🏫', letters:['resh','bet'],              vowels:['patah'] },
  { w:'אִמָּא',  pic:'👩',  letters:['alef','mem'],              vowels:['hirik','kamatz'] },
  { w:'יָד',    pic:'✋',  letters:['yod','dalet'],             vowels:['kamatz'] },
  { w:'מַיִם',   pic:'💧',  letters:['mem','yod'],               vowels:['patah','hirik'] },
  { w:'גַּן',    pic:'🌳',  letters:['gimel','nun'],             vowels:['patah'] },
  { w:'שֶׁמֶשׁ',  pic:'☀️',  letters:['shin','mem'],              vowels:['segol'] },
  { w:'בַּיִת',  pic:'🏡',  letters:['bet','yod','tav'],         vowels:['patah','hirik'] },
  { w:'לֵב',    pic:'❤️',  letters:['lamed','bet'],             vowels:['tsere'] },
  { w:'סוּס',   pic:'🐴',  letters:['samekh','vav'],            vowels:['shuruk'] },
  { w:'תּוּת',   pic:'🍓',  letters:['tav','vav'],               vowels:['shuruk'] },
  { w:'פִּיל',   pic:'🐘',  letters:['pe','yod','lamed'],        vowels:['hirik'] },
  { w:'דֹּב',    pic:'🐻',  letters:['dalet','bet'],             vowels:['holam'] },
  { w:'עֵץ',    pic:'🌲',  letters:['ayin','tsadi'],            vowels:['tsere'] },
  { w:'כֶּלֶב',  pic:'🐶',  letters:['kaf','lamed','bet'],       vowels:['segol'] },
  { w:'חָתוּל', pic:'🐱',  letters:['het','tav','vav','lamed'], vowels:['kamatz','shuruk'] },
  { w:'פָּרָה',  pic:'🐄',  letters:['pe','resh','he'],          vowels:['kamatz'] },
  { w:'נָחָשׁ',  pic:'🐍',  letters:['nun','het','shin'],        vowels:['kamatz'] },
  { w:'עוּגָה', pic:'🍰',  letters:['ayin','vav','gimel','he'], vowels:['shuruk','kamatz'] },
  { w:'תִּיק',   pic:'🎒',  letters:['tav','yod','kuf'],         vowels:['hirik'] },
  { w:'גָּמָל',  pic:'🐫',  letters:['gimel','mem','lamed'],     vowels:['kamatz'] },
  { w:'סֵפֶר',  pic:'📖',  letters:['samekh','pe','resh'],      vowels:['tsere','segol'] },
  { w:'בָּנָנָה', pic:'🍌',  letters:['bet','nun','he'],          vowels:['kamatz'] }
];

/* ---------- הגן הקסום ---------- */
const THEME = {
  mascot: '🦄',
  mascotName: 'נוֹגָה',
  reward: '💎'
};

/* One item earned per completed round, in order. Nothing is ever lost. */
const GARDEN = [
  '🌸','🦋','🌷','✨','🍄','🌺','🐝','🌻','⭐','🌈',
  '🧚','🌹','🐰','💐','🦚','🌼','🐿️','🍀','🌟','🦄',
  '🏰','🐉','🦢','🌙','☁️','🕊️','🦉','🌳','💫','🎠'
];

/* Spoken prompts. Every one of these is also an on-screen icon. */
const SAY = {
  welcome:    'שָׁלוֹם ' + CHILD.name + '! בּוֹאִי נִקְרָא!',
  pickHeard:  'אֵיזוֹ הֲבָרָה שָׁמַעְתְּ?',
  findLetter: 'מִצְאִי אֶת כָּל הָאוֹתִיּוֹת',
  readAloud:  'קִרְאִי בְּקוֹל רָם',
  wasRight:   'יוֹפִי! נָכוֹן מְאוֹד!',
  tryThis:    'זֶה הָיָה זֶה. תִּלְחֲצִי עָלָיו',
  roundDone:  'כָּל הַכָּבוֹד! קִבַּלְתְּ מַתָּנָה לַגַּן!',
  realWord:   'זֹאת מִלָּה אֲמִתִּית!',
  sandbox:    'תִּלְחֲצִי עַל אוֹת, וְאַחַר כָּךְ עַל נְקֻדָּה'
};
