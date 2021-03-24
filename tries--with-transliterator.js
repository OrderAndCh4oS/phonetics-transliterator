const fs = require('fs');

function loadFile(file) {
    try {
        let response = fs.readFileSync(`./${file}`, 'UTF-8');
        if(!response) throw new Error(`Failed to load ${file}`);
        return response;
    } catch(e) {
        return null;
    }
}

class CharNode {
    _char;
    _phonetics = new Set();
    _word = null;
    _nextCharsLevel = {};

    constructor(char) {
        this._char = char;
    }

    get char() {
        return this._char;
    }

    get phonetics() {
        return this._phonetics;
    }

    get word() {
        return this._word;
    }

    get nextCharsLevel() {
        return this._nextCharsLevel;
    }

    addPhonetic(phonetic) {
        this._phonetics.add(phonetic);
    }

    setWord(word) {
        this._word = word;
    }
}

class Trie {
    _currentLanguageCode = null;
    _loadedDictionaries = {};

    constructor() { }

    get firstCharsLevel() {
        return this._loadedDictionaries[this._currentLanguageCode];
    }

    addWord(word, phonetic) {
        const charsArr = word.split('');
        let currentCharLevel = this.firstCharsLevel;
        let currentCharNode;
        let currentChar;
        do {
            currentChar = charsArr.shift();
            if(currentChar in currentCharLevel) {
                currentCharNode = currentCharLevel[currentChar];
                currentCharLevel = currentCharLevel[currentChar].nextCharsLevel;
                continue;
            }
            currentCharLevel[currentChar] = new CharNode(currentChar);
            currentCharNode = currentCharLevel[currentChar];
            currentCharLevel = currentCharLevel[currentChar].nextCharsLevel;
        } while(charsArr.length);
        const phoneticOptions = phonetic.split(', ');
        for(const phoneticOption of phoneticOptions) {
            currentCharNode.addPhonetic(phoneticOption);
        }
        currentCharNode.setWord(word);
    }

    findCharNode(word) {
        const charsArr = word.split('');
        let currentCharLevel = this.firstCharsLevel;
        let currentChar;
        let currentCharNode;
        do {
            currentChar = charsArr.shift();
            if(!(currentChar in currentCharLevel)) return null;
            currentCharNode = currentCharLevel[currentChar];
            if(!charsArr.length) return currentCharNode;
            currentCharLevel = currentCharNode.nextCharsLevel;
        } while(charsArr.length);
        return null;
    }

    findPhonetics(word) {
        const result = this.findCharNode(word);
        return result ? result.phonetics : null;
    }

    hasDictionary(dictionary) {
        return Object.keys(this._loadedDictionaries).includes(dictionary);
    }
}

class TrieStepperAbstract extends Trie {
    _currentLevel = null;
    _lastNodeWithResult = null;
    _foundChars = false;
    _lastResultCursor = null;
    _currentNode = null;
    _cursor = 0;
    _result = [];
    _text = null;
    _prosody = 85;

    constructor() {
        super();
    }

    get cursor() {
        return this._cursor;
    }

    get lastPhoneticsSet() {
        if(!this._lastNodeWithResult) return null;
        return this._lastNodeWithResult.phonetics;
    }

    get result() {
        return this._result.map(r =>
            r instanceof CharNode
                ? [...r.phonetics][0]
                : r,
        ).join('');
    }

    get resultRaw() {
        return this._result.map(
            r => r instanceof CharNode
                ? {phonetics: [...r.phonetics], word: r.word}
                : {char: r},
        );
    }

    get pollyResult() {
        const ssmlStr = this._result.map(r => {
            if(r instanceof CharNode) {
                const cleanedText = [...r.phonetics][0].replace('/', '');
                return `<phoneme alphabet='ipa' ph='${cleanedText}'/>`;
            }
            return escapeSsml(r);
        }).join('')
            .replace(/\n\n/ug, '\r')
            .replace(/\n/ug, '<break strength="weak"/>');
        return `<speak><prosody rate="${this._prosody}%">${ssmlStr}</prosody></speak>`;
    }

    set text(text) {
        // Todo: remove need for extra spaces;
        this._text = typeof text === 'string' ? ' ' + text.toLowerCase() + ' ' : null;
    }

    set prosody(value) {
        this._prosody = value;
    }

    translateText(text) {
        if(typeof text !== 'string') throw new Error('Text must be a string');
        this._text = ' ' + text.toLowerCase() + ' '; // Todo: remove need for spaces;
        this.run();
        const result = this.result;
        return result.trim();
    }

    async translateAudio(text, gender, prosody) {
        this._text = text;
        if(prosody) this._prosody = prosody;
        this.run();
        const pollySsml = this.pollyResult;
        this.clear();
        return await polly.synthesizeSpeech({
            Text: pollySsml,
            TextType: 'ssml',
            OutputFormat: 'mp3',
            VoiceId: getVoice(dictionary, gender || 'male'),
        }).promise();
    }

    reset() {
        this._currentLevel = this.firstCharsLevel;
        this._lastNodeWithResult = null;
        this._foundChars = false;
    }

    clear() {
        this._currentLevel = this.firstCharsLevel;
        this._lastNodeWithResult = null;
        this._lastResultCursor = null;
        this._currentNode = null;
        this._cursor = 0;
        this._result = [];
        this._text = null;
        this._foundChars = false;
    }

    isLetter(str) { return /\p{L}/u.test(str); }
}

class TrieWordStepper extends TrieStepperAbstract {
    _orthographyStepper = null;
    _currentWord = '';

    addOrthographyStepper(orthographyStepper) {
        this._orthographyStepper = orthographyStepper;
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel &&
                (this._foundChars || !this.isLetter(this._text[this._cursor - 1]))) {
                this._foundChars = true;
                this._currentNode = this._currentLevel[char];
                this._currentLevel = this._currentNode.nextCharsLevel;
                if(this._currentNode.word && !this.isLetter(this._text[this._cursor + 1])) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._cursor++;
            } else if(this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult);
                this._cursor = this._lastResultCursor + 1;
                this._lastAddedCursor = this._cursor;
                this.reset();
            } else {
                for(let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    const char = this._text[i];
                    if(!this.isLetter(char)) {
                        this._result.push(char);
                        continue;
                    }
                    this._currentWord += char;
                    if(!this.isLetter(this._text[i + 1])) {
                        if(this._orthographyStepper) {
                            this._currentWord = this._orthographyStepper.translateText(
                                this._currentWord);
                            this._orthographyStepper.clear();
                        }
                        this._result.push('#' + this._currentWord + '#');
                        this._currentWord = '';
                    }
                }
                this._lastAddedCursor = this._cursor + 1;
                this._cursor++;
                this.reset();
            }
        }
    }

    loadDictionary(dictionary) {
        this._currentLanguageCode = dictionary;
        if(this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = loadFile(`./combined-dictionaries/${dictionary}.txt`);
        const lines = response.split(/\r?\n/);
        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
        }
    }
}

class TrieOrthographyStepper extends TrieStepperAbstract {
    _rulePreprocessors = {};
    _rulePostprocessors = {};

    constructor() {
        super();
    }

    get result() {
        let result = this._result.map(r =>
            r instanceof CharNode
                ? [...r.phonetics][0]
                : r,
        ).join('');
        if(this._currentLanguageCode in this._rulePreprocessors) {
            result = this._rulePostprocessors[this._currentLanguageCode].process(result);
        }
        return result;
    }

    addRulePreprocessorForLanguage(ruleProcessor, languageCode) {
        ruleProcessor.loadRuleFile(languageCode, 'preprocessor');
        this._rulePreprocessors[languageCode] = ruleProcessor;
    }

    addRulePostprocessorForLanguage(ruleProcessor, languageCode) {
        ruleProcessor.loadRuleFile(languageCode, 'postprocessor');
        this._rulePostprocessors[languageCode] = ruleProcessor;
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        if(this._currentLanguageCode in this._rulePreprocessors) {
            this._text = this._rulePreprocessors[this._currentLanguageCode].process(this._text);
        }
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel) {
                this._currentNode = this._currentLevel[char];
                this._currentLevel = this._currentNode.nextCharsLevel;
                if(this._currentNode.word) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._cursor++;
            } else if(this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult);
                this._cursor = this._lastResultCursor + 1;
                this._lastAddedCursor = this._cursor;
                this.reset();
            } else {
                for(let i = this._lastAddedCursor || 0; i <= this._cursor; i++) {
                    this._result.push(this._text[i]);
                }
                this._lastAddedCursor = this._cursor + 1;
                this._cursor++;
                this.reset();
            }
        }
    }

    loadDictionary(dictionary) {
        this._currentLanguageCode = dictionary;
        if(this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = loadFile(`./processors/maps/${dictionary}.txt`);
        const lines = response ? response.split(/\r?\n/) : [];
        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
        }
    }
}

class Rule {
    _toReplace = '';
    _replacement = '';
    _prefix = null;
    _suffix = null;

    constructor(rule, charGroups) {
        const [strings, match] = rule.split(/\s+\/\s+/u);
        [this._toReplace, this._replacement] = strings.split(/\s+->\s+/u);
        [this._prefix, this._suffix] = match.split(/\s?_\s?/u);
        for(const [key, value] of Object.entries(charGroups)) {
            const charGroupRegex = new RegExp(key, 'gu');
            this._prefix = this._prefix ? this._prefix.replace(charGroupRegex, value)
                .replace(/#/u, '^') : '';
            this._suffix = this._suffix ? this._suffix.replace(charGroupRegex, value)
                .replace(/#/u, '$') : '';
        }
        this._replacement = this._replacement.replace(/0/u, '');
    }

    get regex() {
        return new RegExp(`(${this._prefix})(${this._toReplace})(${this._suffix})`, 'ug');
    }

    apply(word) {
        return word.replace(this.regex, (_m, a, _b, c) => a + this._replacement + c);
    }
}

class RuleProcessor {
    _rules = [];

    loadRuleFile(languageCode, type) {
        const response = loadFile(`processors/rules/${type}s/${languageCode}.txt`);
        if(!response) return;
        const charGroupRegex = /^::\p{L}+?::\s+?=\s+?[\p{L}|]+/gmu;
        const ruleRegex = /^[\p{L}\[\]|]+?\s+->\s+[\p{L}\p{M}\[\]<>|0]+\s+\/\s+.*?$/gmu;
        const foundCharGroups = response.match(charGroupRegex);
        const charGroups = foundCharGroups
            ? foundCharGroups.reduce((obj, m) => {
                const [key, value] = m.split(/\s+=\s+/);
                return {...obj, [key]: value};
            }, {})
            : {};
        const rules = response.match(ruleRegex);
        this._rules = rules
            ? rules.map(r => new Rule(r, charGroups))
            : [];
    }

    process(word) {
        if(!this._rules.length) return word;
        return this._rules.reduce((w, r) => r.apply(w), word);
    }
}

const trieWord = new TrieWordStepper();
const trieOrthography = new TrieOrthographyStepper();

function translate(language, text) {
    trieWord.loadDictionary(language);
    trieOrthography.loadDictionary(language);
    trieOrthography.addRulePreprocessorForLanguage(new RuleProcessor(), language);
    trieOrthography.addRulePostprocessorForLanguage(new RuleProcessor(), language);
    trieWord.addOrthographyStepper(trieOrthography);
    const result = trieWord.translateText(text);
    trieWord.clear();
    return result;
}

function logTranslation(languageCode, title, text) {
    const result = translate(languageCode, text);
    const textLines = text.split(/\n/);
    const resultLines = result.split('\n');
    console.log(`${languageCode}: ${title}`);
    console.log('----\n');
    for(let i = 0; i < Math.max(textLines.length, resultLines.length); i++) {
        if(i < textLines.length) console.log(textLines[i]);
        if(i < resultLines.length) console.log(resultLines[i]);
        console.log('');

    }
    console.log('----\n\n');
}

const examples = [
    // {languageCode: 'de', title: 'Erlkönig', text: 'Wer reitet so spät durch Nacht und Wind?\nEs ist der Vater mit seinem Kind:\nEr hat den Knaben wohl in dem Arm,\nEr fasst ihn sicher, er hält ihn warm.\n„Mein Sohn, was birgst du so bang dein Gesicht?“\n„Siehst, Vater, du den Erlkönig nicht?\nDen Erlenkönig mit Kron’ und Schweif?“\n„Mein Sohn, es ist ein Nebelstreif.“\n„Du liebes Kind, komm, geh mit mir!\nGar schöne Spiele spiel’ ich mit dir;\nManch’ bunte Blumen sind an dem Strand,\nMeine Mutter hat manch gülden Gewand.“\n„Mein Vater, mein Vater, und hörest du nicht,\nWas Erlenkönig mir leise verspricht?“\n„Sei ruhig, bleibe ruhig, mein Kind:\nIn dürren Blättern säuselt der Wind.“\n„Willst, feiner Knabe, du mit mir gehn?\nMeine Töchter sollen dich warten schön;\nMeine Töchter führen den nächtlichen Rein\nUnd wiegen und tanzen und singen dich ein.“\n„Mein Vater, mein Vater, und siehst du nicht dort\nErlkönigs Töchter am düstern Ort?“\n„Mein Sohn, mein Sohn, ich seh es genau:\nEs scheinen die alten Weiden so grau.“\n„Ich liebe dich, mich reizt deine schöne Gestalt;\nUnd bist du nicht willig, so brauch ich Gewalt.“\n„Mein Vater, mein Vater, jetzt fasst er mich an!\nErlkönig hat mir ein Leids getan!“\nDem Vater grausets, er reitet geschwind,\nEr hält in Armen das ächzende Kind,\nErreicht den Hof mit Mühe und Not:\nIn seinen Armen das Kind war tot.'},
    // {languageCode: 'de', title: 'Widmung', text: 'Du meine Seele, du mein Herz,\nDu meine Wonn’, o du mein Schmerz,\nDu meine Welt, in der ich lebe,\nMein Himmel du, darein ich schwebe,\nO du mein Grab, in das hinab\nIch ewig meinen Kummer gab!\nDu bist die Ruh, du bist der Frieden,\nDu bist vom Himmel mir beschieden.\nDass du mich liebst, macht mich mir wert,\nDein Blick hat mich vor mir verklärt,\nDu hebst mich liebend über mich,\nMein guter Geist, mein bess’res Ich!'},
    // {languageCode: 'fr_FR', title: 'Le corbeau et le renard', text: 'Maître Corbeau, sur un arbre perché,\nTenait en son bec un fromage.\nMaître Renard, par l\'odeur alléché,\nLui tint à peu près ce langage:\nHé! Bonjour, Monsieur du Corbeau.\nQue vous êtes joli! Que vous me semblez beau!\nSans mentir, si votre ramage\nSe rapporte à votre plumage,\nVous êtes le phénix des hôtes de ces bois.\nA ces mots le corbeau ne se sent pas de joie;\nEt, pour montrer sa belle voix,\nIl ouvre un large bec, laisse tomber sa proie.\nLe renard s\'en saisit, et dit: Mon bon monsieur,\nApprenez que tout flatteur\nVit aux dépens de celui qui l\'écoute:\nCette leçon vaut bien un fromage, sans doute.\nLe corbeau, honteux et confus,\nJura, mais un peu tard, qu\'on ne l\'y prendrait plus.'},
    // {languageCode: 'fr_FR', title: 'L’Heure exquise', text: 'La lune blanche\nLuit dans les bois;\nDe chaque branche\nPart une voix\nSous la ramée...\nÔ bien aimée.\nL\'étang reflète,\nProfond miroir,\nLa silhouette\nDu saule noir\nOù le vent pleure...\nRêvons, c\'est l\'heure.\nUn vaste et tendre\nApaisement\nSemble descendre\nDu firmament\nQue l\'astre irise...\nC\'est l\'heure exquise.'},
    // {languageCode: 'it', title: 'Pensieri notturni di Filli', text: 'Nel dolce dell’oblio\nbenchè riposi\nla mia Filli adorata veglia\ncoi pensier suoi\ne in quella quiete\nAmor non cessa mai\ncon varie forme\nla sua pace turbar\nmentr’ella dorme.\n\nGiacchè il sonno a lei dipinge\nla sembianza del suo bene.\nNella quiete ne pur finge\nd’abbracciar le sue catene.\n\nCosì fida ella vive\nal cuor che adora\ne nell’ombre respira\nla luce di quel sol\nper cui sospira.\n\nHa l’inganno il suo diletto\nse i pensier mossi d’affetto\nstiman ver ciò che non sanno.\nMa se poi si risveglia un tal errore\nil pensier ridice a noi\nha l’inganno il suo dolore.'},
    // {languageCode: 'ru', title: 'Uvy, zachem ona blistaet', text: 'Увы, зачем она блистает\nМинутной, нежной красотой?\nОна приметно увядает\nВо цвете юности живой…\nУвянет! Жизнью молодою\nНе долго наслаждаться ей;\nНе долго радовать собою\nСчастливый круг семьи своей,\nБеспечной, милой остротою\nБеседы наши оживлять\nИ тихой, ясною душою\nСтрадальца душу услаждать.\nСпешу в волненье дум тяжелых,\nСокрыв уныние мое,\nНаслушаться речей веселых\nИ наглядеться на нее.\nСмотрю на все ее движенья,\nВнимаю каждый звук речей,\nИ миг единый разлученья\nУжасен для души моей'}
    // {languageCode: 'da', title: 'Hun er saa hvid (Op. 18, No. 2)', text: `Hun er så hvid, min Hjertens kjær\nEt mere hvidt ei finnes der\nJeg elsker henne, ei det sker\nAt jeg kan elske henne mer!\n\nNu er hun død, min Hjertens kjær\nLangt mere hvidt hun smiler der\nNu er hun død, o Hjertegru\nOg mer jeg elsker henne nu!`}
    // {languageCode: 'el', title: 'Ωδή Δεκάτη. Ο Βωμός της Πατρίδος', text: ` στροφή πρώτη.\nTρέξατε αδέλφια, τρέξατε\nψυχαί θερμαί, γενναίαι·\nεις τον βωμόν τριγύρω\nτης πατρίδος αστράπτοντα\nτρέξατε πάντες.\nΑς παύσωσ' η διχόνοιαι\nπου ρίχνουσι τα έθνη\nτυφλά, υπό τα σκληρότατα\nονύχια των αγρύπνων\nδολίων τυράννων.\nTρέξατ' εδώ· συμφώνως\nτους χορούς ας συμπλέξωμεν,\nπροσφέρων ο καθένας\nλαμπράν θυσίαν, πολύτιμον,\nεις την πατρίδα.\nEδώ ας καθιερώσωμεν\nτα πάθη μας προθύμως·\nτ' άρματα ημείς αδράξαμεν\nμόνον δια 'να πληγώσωμεν\nτου Oσμάν τα στήθη.`}
    // {languageCode: 'sv', title: 'En etsi valtaa, loistoa', text: '1. Giv mig ej glans, ej guld, ej prakt\ni signad juletid.\nGiv mig Guds ära, änglavakt\noch över jorden frid.\nGiv mig en fest som gläder mest\nden konung jag har bett till gäst.\nGiv mig ej glans, ej guld, ej prakt,\ngiv mig en änglavakt.\n\n2. Giv mig ett hem på fosterjord,\nen gran med barn i ring,\nen kväll i ljus med Herrens ord\noch mörker däromkring.\nGiv mig ett bo med samvetsro,\nmed glad förtröstan, hopp och tro.\nGiv mig ett hem på fosterjord\noch ljus av Herrens ord.\n\n3. Till hög, till låg, till rik, till arm,\nkom, helga julefrid.\nKom barnaglad, kom hjärtevarm\ni världens vintertid.\nDu ende som ej skiftar om,\nmin Herre och min Konung, kom.\nTill hög, till låg, till rik, till arm,\nkom glad och hjärtevarm.'},
    // {languageCode: 'fi', title: 'En etsi valtaa, loistoa', text: '1. En etsi valtaa, loistoa,\nen kaipaa kultaakaan,\nma pyydän taivaan valoa\nja rauhaa päälle maan.\nSe joulu suo, mi onnen tuo\nja mielet nostaa Luojan luo.\nEi valtaa eikä kultaakaan,\nvaan rauhaa päälle maan.\n\n2. Suo mulle maja rauhaisa\nja lasten joulupuu,\nJumalan sanan valoa,\njoss\' sieluin kirkastuu!\nTuo kotihin, jos pieneenkin\nnyt joulujuhla suloisin,\nJumalan sanan valoa\nja mieltä jaloa!\n\n3. Luo köyhän niinkuin rikkahan\nsaa, joulu ihana!\nPimeytehen maailman\ntuo taivaan valoa!\nSua halajan, sua odotan,\nsa Herra maan ja taivahan,\nnyt köyhän niinkuin rikkaan luo\nsuloinen joulus tuo!'},
    // {languageCode: 'hu', title: 'Isten élő Lelke jöjj', text: '1. Isten élő Lelke, jöjj, áldva szállj le rám,\nÉgi lángod járja át szívem és a szám!\nOldj fel, küldj el, tölts el tűzzel!\nIsten élő Lelke, jöjj, áldva szállj le rám!\n\n2. Isten élő Lelke, jöjj, légy vezérem itt,\nÓ, segíts, hogy hagyjam el bűnök útjait!\nOldj fel, küldj el, tölts el tűzzel!\nIsten élő Lelke, jöjj, légy vezérem itt!\n\n3. Isten élő Lelke, jöjj, hadd lehessek szent,\nJézusommal légyek egy már e földön lent!\nOldj fel, küldj el, tölts el tűzzel!\nIsten élő Lelke, jöjj, hadd lehessek szent!\n\n4. Isten élő Lelke, jöjj, győzedelmet adj,\nS majd a végső harcon át mennybe fölragadj!\nOldj fel, küldj el, tölts el tűzzel!\nIsten élő Lelke, jöjj, győzedelmet adj!'},
    // {languageCode: 'is', title: 'Kvölds í blíða blænum', text: 'Kvölds í blíða blænum\nberst mín sál til þín,\nyst í úthafs sænum,\næskufoldin mín.\nVakir sól við sundin,\nsofnar blómagrundin\ndaggarskrúði skín.\n\nRoðna raðir tinda,\nríkir alkyrrð vær,\nblítt á björg og rinda\nblíki hinsta slær.\nLétt er barnalundin\nljúf og himnesk stundin'},
    // {languageCode: 'la', title: '', text: 'Cecilia virgo, tuas laudes universa concinit musicorum turba,\nut tuis meritis supplices a Deo exaudiri possint.\nIuncta voce et uno corde tuum nomen invocant,\nut luctum mundi in paradisi gloriam mutare digneris;\ntuosque pupilos, tutelaris Virgo, aspicere velis,\npiam Dominam, inclamantes, et semper dicentes:\nSancta Cecilia, ora pro nobis.'},
    // {languageCode: 'es_ES', title: 'El curandero', text: 'Hoy al portal ha venido\nun saltimbanqui de aquellos\nque en los pueblos donde acuden\ndicen que son curanderos;\nestos traen mil invenciones\nde bálsamos y remedios\ny hoy que ha nacido el del mundo\nviene uno que habla por ciento.\n\nO li pastorcilli,\nO li zagaleco\nvenite al pórtalo\naqui videremo\nque io so magistro\ndi tuti remedio,\ndi grande, di chiqui,\ndi malo, di bueno.\n\nR.: Venid, pastorcillos,\nvenid zagalejos,\nveamos qué dice\nel tal curandero\nal Niño precioso\nque lo oye riyendo.\n\nO, e cosi espantosi,\nO, e grandi consuelo\nli balsamo porto\nque sana los muertos,\ndoy dientes a viecas,\ndoy ochios a tuertos,\na los corcubatus\nles pongo derechos\ny a los porfiatos\nles curo lo necio.\n\nJesús solamente\npudiera hacer eso.\nCarissimi, sapia\nque io so maiestro\ndi femina, di huomo,\ndi bianchi, di negro,\ndi grandi, di chiqui,\ndi malo, di bueno.\n\nPues por los hijares\nhablando le vemos,\nR.\n\nCoplas\n1. Al huomo corcubatu\nen la prensa le meto\ne a catro o cinque volta\nil corpo li indereso,\nma l’anima si fuche,\nio non mi curo de eso.\n\nTal modo de curar\nes muy enfermo.\nAtengo me al Niño,\nque el yugo que ha puesto\nremedia los hombres\ny no tiene riesgo.\n\nEs máximo doctore il bambineto\n\n2. Al torto en la sua testa\nle formo un arbugero\ne un ochio di cristalo\nli encaco pur adentro,\nma si lusse sus echa,\nnon so qué faré in questo.\n\nEso es desentortar\ny quedar ciegos.\nSin eso peligro\nAmor ha dispuesto\nabrirnos los ojos\na nuestro remedio.\n\nCol sole qui a nasciuto, io lo credo.\n\n3. Senza dolore mio,\nio saco in un momento\nla mola e si la encia\nsi vene con el hierro\nio non riparo nunca\nen hoso más o menos.\n\nComo es la habilidad\nes el efecto:\nel Niño sí saca\nal hombre algún hueso\nes dándole esposa\nsu halago y consuelo.\n\nMa con serpente e poma il suo tormento.\n\n4. Feridas de la testa,\ndi collo, gamba e petto,\nmio bálsamo las cura\n'},
    {languageCode: 'yi', title: 'Schlof mayn Kind', text: 'איר ֿפרעסט די שײנקײט און שּפײַט אױס,\nדי שטערן גײען אױס ֿפַאר חרּפה;\nאונטער אײַערע ברעמען איז ענג ֿפַאר גאָט,\nאױבן װערט דער הימל שװַארצער.\nאיר טוליעט צום בוזעם לײדן און זינד,\nֿפַאר אײַער געלעכטער דערשרעקט איר זיך זעלבער,\nמײדלשע ֿפיס לעקט איר, װי הינט,\nאײַער נשמה קען ֿפַאר הונגער נישט שלאָפן.\nאיבער אײַערע בעטן נעכטיקט ַא קללה,\nביטערע ליּפן קושט איר און ציטערט;\nטרױמעריש שּפילט דאָרטן ערגעץ די נַאכט.\nנאָר איר ֿפרעסט דאָס גליק און שּפײט אױס.\nאון אז גאָט איז אײך מוחל אײער עלנט, און ּפרואװט\nנַאכטיקע װעלטן אין אײער הַארץ װיגן, -\nליגט איר ֿפארשּפעטיקטע מידע און הערט,\nװי עס גענעצט דער האָן אין גרױען בַאגינען.'.split('').reverse().join('')},
];

for(const {languageCode, title, text} of examples) {
    logTranslation(languageCode, title, text);
}

/**
 * Extras for Polly processing
 */
const getVoice = (language, gender) => {
    switch(language) {
        case 'de':
            return gender === 'male' ? 'Hans' : 'Vicki';
        case 'fr_FR':
            return gender === 'male' ? 'Mathieu' : 'Celine';
        case 'en_UK':
            return gender === 'male' ? 'Brian' : 'Emma';
        case 'en_US':
            return gender === 'male' ? 'Joey' : 'Kimberly';
        case 'es_ES':
            return gender === 'male' ? 'Enrique' : 'Lucia';
        default:
            return gender === 'male' ? 'Brian' : 'Emma';
    }
};

function escapeSsml(str) {
    return str
        .replace(/"/ug, '&quot;')
        .replace(/&/ug, '&amp;')
        .replace(/'/ug, '&apos;')
        .replace(/</ug, '')
        .replace(/>/ug, '');
}
