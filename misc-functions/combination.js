const fs = require('fs');

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
    _currentDictionary = null;
    _loadedDictionaries = {};
    _filePath = 'translations';

    constructor() {}

    get firstCharsLevel() {
        return this._loadedDictionaries[this._currentDictionary];
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
        currentCharNode.addPhonetic(phonetic);
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

    loadTextDict(dictionary) {
        this._currentDictionary = dictionary;
        if(this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};

        let response = fs.readFileSync(`./${this._filePath}/${dictionary}.txt`, 'UTF-8');

        const lines = response.split(/\r?\n/);

        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!word) continue;
            this.addWord(word.toLowerCase(), phonetic || '');
        }
    }
}

class TrieStepperAbstract extends Trie {
    _currentLevel = null;
    _foundCharCount = 0;
    _lastNodeWithResult = null;
    _lastResultCursor = null;
    _currentNode = null;
    _lastChar = null;
    _cursor = 0;
    _result = [];
    _text = null;

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
        return this._result.map(r => r instanceof Set ? Array.from(r)[0] : r).join('');
    }

    set text(text) {
        // Todo: remove need for the extra space;
        this._text = typeof text === 'string' ? ' ' + text.toLowerCase() : null;
    }

    translateText(text) {
        if(typeof text !== 'string') throw new Error('Text must be a string');
        this._text = ' ' + text.toLowerCase(); // Todo: remove need for this space;
        this.run();
        const result = this.result;
        this.clear();
        return result.trim();
    }

    run() {}

    reset() {
        this._currentLevel = this.firstCharsLevel;
        this._lastNodeWithResult = null;
        this._foundCharCount = 0;
    }

    clear() {
        this._currentLevel = this.firstCharsLevel;
        this._foundCharCount = 0;
        this._lastNodeWithResult = null;
        this._lastResultCursor = null;
        this._currentNode = null;
        this._lastChar = null;
        this._cursor = 0;
        this._result = [];
        this._text = null;
    }

    isLetter(str) {return /\p{L}/u.test(str);}
}

class TrieWordStepper extends TrieStepperAbstract {
    constructor() {
        super();
        this._filePath = 'translations';
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel &&
                (this._foundCharCount !== 0 || !this.isLetter(this._text[this._cursor - 1]))) {
                this._foundCharCount++;
                this._currentNode = this._currentLevel[char];
                if(this._currentNode.word && !this.isLetter(this._text[this._cursor + 1])) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._currentLevel = this._currentNode.nextCharsLevel;
            } else if(this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult.phonetics);
                this._lastAddedCursor = this._cursor;
                this._cursor = this._lastResultCursor;
                this.reset();
            } else {
                for(let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    this._result.push(this._text[i]);
                }
                this._lastAddedCursor = this._cursor + 1;
                this.reset();
            }
            this._lastChar = char;
            this._cursor++;
        }
    }
}

class TrieOrthographyStepper extends TrieStepperAbstract {
    constructor() {
        super();
        this._filePath = 'processors/maps';
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length + 1) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel) {
                this._foundCharCount++;
                this._currentNode = this._currentLevel[char];
                if(this._currentNode.word) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._currentLevel = this._currentNode.nextCharsLevel;
            } else if(this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult.phonetics);
                this._lastAddedCursor = this._cursor;
                this._cursor = this._lastResultCursor;
                this.reset();
            } else {
                for(let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    this._result.push(this._text[i]);
                }
                this._lastAddedCursor = this._cursor + 1;
                this.reset();
            }
            this._lastChar = char;
            this._cursor++;
        }
    }
}

class Rule {
    _toReplace;
    _replacement;
    _prefix;
    _suffix;

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

    get toReplace() {
        return this._toReplace;
    }

    get replacement() {
        return this._replacement;
    }

    get prefix() {
        return this._prefix;
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

    loadRuleFile(languageCode) {
        const charGroupRegex = /^::\p{L}+?::\s+?=\s+?[\p{L}|]+/gmu;
        const ruleRegex = /^[\p{L}\[\]|]+?\s+->\s+[\p{L}\p{M}\[\]<>|0]+\s+\/\s+.*?$/gmu;
        let response = fs.readFileSync(`./processors/rules/preprocessors/${languageCode}.txt`, 'UTF-8');
        const charGroups = response.match(charGroupRegex).reduce((obj, m) => {
            const [key, value] = m.split(/\s+=\s+/);
            return {...obj, [key]: value};
        }, {});
        const rules = response.match(ruleRegex);
        this._rules = rules.map(r => new Rule(r, charGroups));
    }

    process(word) {
        return this._rules.reduce((w, r) => r.apply(w), word);
    }
}

const trie = new TrieOrthographyStepper();

// const germanRuleProcessor = new RuleProcessor();
//
// germanRuleProcessor.loadRuleFile('de');
//
// trie.loadTextDict('de');
//
// const randomDeWords = [
//     [ 'Friedenspfeifen', '/ˈfɾiːdɛnzpfaefən/' ],
//     [ 'vorgesagten', '/foːɐ̯gəˈzaktən/' ],
//     [ 'einklammerndes', '/ˈʔaenˌklammɛɾndəs/' ],
//     [ 'allfälliges', '/ˈʔallfɛllɪgəs/' ],
//     [ 'türmten', '/ˈtʏɾmtən/' ],
//     [ 'verschreibst', '/fɛːɐ̯ˈʃɾaepst/' ],
//     [ 'starrsinnigen', '/ˈʃtaɾɾzɪnnɪgən/' ],
//     [ 'Entmutigungen', '/ʔɛntˈmuːtɪgʊŋən/' ],
//     [ 'salzigeren', '/ˈzaltsɪgɐ̯ən/' ],
//     [ 'vorwegnahmst', '/foːɐ̯ˈvɛkˌnɑmst/' ],
//     [ 'luftdichte', '/ˈlʊftˌdɪçtə/' ],
//     [ 'einzusparenden', '/ʔaenˈtsuːˌʃpɑːɾɛndən/' ],
//     [ 'ausdrehender', '/ˈʔaosˌdɾeːɛndɐ̯/' ],
//     [ 'eingeht', '/ʔaengəˈht/' ],
//     [ 'ansprecht', '/ˈʔanˌʃpɾɛçt/' ],
//     [ 'fünfjährigen', '/ˈfʏnfjɛɾɪgən/' ],
//     [ 'Parlamentsbeschlüssen', '/ˈpaɾlɑmɛntsbɛʃlʏszən/' ],
//     [ 'unschmackhafteren', '/ˈʔʊnˌʃmakhaftɐ̯ən/' ],
//     [ 'Erhalts', '/ʔɛːɐˈhalts/' ],
//     [ 'Schadensersatzes', '/ˈʃɑːdɛnzɛɾzatsəs/' ],
//     [ 'ungewöhnliche', '/ʔʊngəˈvønlɪçə/' ],
//     [ 'abholt', '/ˈʔapˌhɔlt/' ],
//     [ 'waghalsigeres', '/ˈvakalzɪgɐ̯əs/' ],
//     [ 'unbeschäftigteres', '/ʔʊnbəˈʃɛftɪktɐ̯əs/' ],
//     [ 'setzende', '/ˈzɛtsɛndə/' ],
//     [ 'anschwindeln', '/ˈʔanˌʃvɪndɛln/' ],
//     [ 'loslassende', '/ˈlɔslaszɛndə/' ],
//     [ 'abzuwendenden', '/ʔapˈtsuːˌvɛndɛndən/' ],
//     [ 'böserer', '/ˈbøːzɐ̯ɐ̯/' ],
//     [ 'welterfahrene', '/ˈvɛltɛɾfɑɾənə/' ],
//     [ 'Verbots', '/fɛːɐ̯ˈbɔts/' ],
//     [ 'verstehend', '/fɛːɐ̯ˈʃteːɛnt/' ],
//     [ 'unverzichtbares', '/ʔʊnfɛːɐ̯tsɪçtˈbaɽəs/' ],
//     [ 'durchgebissenem', '/ˈdʊɾtsgebɪszənəm/' ],
//     [ 'abgebrachte', '/ʔapgəˈbraxtə/' ],
//     [ 'Stichpunkt', '/ˈʃtɪçpʊŋkt/' ],
//     [ 'Update', '/ˈʔʊpdɑtə/' ],
//     [ 'Schirmherrin', '/ˈʃɪɾmɛɾɾɪn/' ],
//     [ 'hereinführt', '/hɛˈɾaenˌfyɾt/' ],
//     [ 'anzunäherndem', '/ʔanˈtsuːˌnɛːɛɾndəm/' ],
//     [ 'reinwaschendes', '/ˈɾaenvaʃɛndəs/' ],
//     [ 'aufheizende', '/ˈʔaofˌhaetsɛndə/' ],
//     [ 'wegjagend', '/ˈvɛkˌjɑːgɛnt/' ],
//     [ 'Ärztinnen', '/ˈʔɛɾtstɪnnən/' ],
//     [ 'hereinragen', '/hɛˈɾaenˌɾɑːgən/' ],
//     [ 'überwerfende', '/ˈʔyːbɛɾvɛɾfɛndə/' ],
//     [ 'Töpfer', '/ˈtœpfər/' ],
//     [ 'Furcht', '/fʊʁçt/' ],
//     [ 'zimperlicheren', '/ˈtsɪmpɐ̯lɪçɐ̯ən/' ],
//     [ 'vergönnst', '/fɛːɐ̯ˈgœnnst/' ],
//     [ 'Höchstgeschwindigkeit', '/hœçstgɛʃvɪndɪkˈkəiːt/' ],
//     [ 'Kamelstuten', '/ˈkɑːmɛlstutən/' ],
//     [ 'verfassungswidrigeren', '/fɛːɐ̯ˈfaszʊŋsvɪdɾɪgɐ̯ən/' ],
//     [ 'Formstahl', '/ˈfɔɾmstɑl/' ],
//     [ 'unerreichbar', '/ʔʊnʔɛːɐɾaeçˈbaɽ/' ],
//     [ 'westdeutschen', '/ˈvɛstˌdɔøʧən/' ],
//     [ 'stenographischer', '/ˈʃteːnɔgɾafɪʃɐ̯/' ],
//     [ 'berüchtigtestes', '/bəˈɾʏçtɪktɛstəs/' ],
//     [ 'versiegelt', '/fɛːɐ̯ˈziːgɛlt/' ],
//     [ 'Findelhaus', '/ˈfɪndɛlaos/' ],
//     [ 'beschaulichsten', '/bəˈʃaolɪçstən/' ],
//     [ 'frecher', '/ˈfɾɛçɐ̯/' ],
//     [ 'Autorenrecht', '/ˈaotoɾɛnɾɛçt/' ],
//     [ 'Arbeitsprozess', '/ˈʔaɾbaetspɾotsɛss/' ],
//     [ 'verzagend', '/fɛːɐ̯ˈtsɑːgɛnt/' ],
//     [ 'hinführst', '/ˈhɪnˌfyɾst/' ],
//     [ 'ausrückte', '/ˈʔaosˌɾʏktə/' ],
//     [ 'hineinzulesende', '/hɪˈnaenˈtsuːˌleːzɛndə/' ],
//     [ 'Goldkäufen', '/ˈgɔltkɔøfən/' ],
//     [ 'teilnahmsloseres', '/ˈtaelnɑmsloːsɐ̯əs/' ],
//     [ 'Umschiffungen', '/ˈʔʊmˌʃɪffʊŋən/' ],
//     [ 'Bergarbeiterschaft', '/bəˈɾgaɾbaetɛɾstshaft/' ],
//     [ 'Gesamtleistungen', '/gəzamtˈləɪstʊŋən/' ],
//     [ 'stechende', '/ˈʃtɛçɛndə/' ],
//     [ 'Terme', '/ˈtɛɾmə/' ],
//     [ 'aufgelistetes', '/ʔaofgəˈlɪstətəs/' ],
//     [ 'zustatten', '/ˈtsuːˌʃtatən/' ],
//     [ 'unterschreite', '/ˈʔʊntɛɾstsˈɾəiːtə/' ],
//     [ 'zurückzuzahlendes', '/ˈtsuːˌɾʏktsutsɑlɛndəs/' ],
//     [ 'Betriebsferien', '/bətɾiːpsˈfɐ̯iːən/' ],
//     [ 'Artikulation', '/ʔaɾtikulɑˈtsĭoːn/' ],
//     [ 'schieferer', '/ˈʃiːfɐ̯ɐ̯/' ],
//     [ 'Spezifikationssprache', '/ˈʃpeːtsifikɑtsĭonsspɾaxə/' ],
//     [ 'Indices', '/ˈʔɪnditsəs/' ],
//     [ 'Falkenjagd', '/ˈfalkɛnjakt/' ],
//     [ 'verschraubendes', '/fɛːɐ̯ˈʃɾaobɛndəs/' ],
//     [ 'mitgehörtes', '/mɪtgəˈhœɾtəs/' ],
//     [ 'unentrinnbaren', '/ʔʊnʔɛntɾɪnnˈbaɽən/' ],
//     [ 'nichtproportionalen', '/nɪçtpɾopɔɾˈtsĭoːnalən/' ],
//     [ 'Ehrensachen', '/ˈʔeɾɛnzaxən/' ],
//     [ 'Ausbildungsteile', '/ˈʔaosbɪldʊŋstəiːlə/' ],
//     [ 'gewehtes', '/gəˈvetəs/' ],
//     [ 'dazulernend', '/daˈtsuːˌlɛɾnɛnt/' ],
//     [ 'exponiertester', '/ˈʔɛksponiːɾtɛstɐ̯/' ],
//     [ 'anwinkle', '/ˈʔanˌvɪŋklə/' ],
//     [ 'Ausschusses', '/ˈʔaosˌʃʊszəs/' ],
//     [ 'abgreife', '/ˈʔapˌgɾaefə/' ],
//     [ 'ausmessendes', '/ˈʔaosˌmɛszɛndəs/' ],
//     [ 'eintönig', '/ˈʔaenˌtøːnɪç/' ],
//     [ 'strukturiertet', '/ʃtɾʊkˈtuːɐiːɾtət/' ]
// ]
//
// for(const word of randomDeWords) {
//     word.push(trie.translateText(germanRuleProcessor.process(`${word[0]}`)))
// }
// console.log(randomDeWords)

// console.log(trie.translateText(germanRuleProcessor.process('stählernes')));
// // ˈʃtɛlɛɾnəs <-- Dict
// // ʃteːleənes <-- Epitran
// // ʃteːleənes <-- Combination
//
// console.log(trie.translateText(germanRuleProcessor.process('spritzigerem')));
// // ˈʃpɾɪtsɪgɐ̯əm <-- Dict
// // ʃpriːt͡siçeːrem <-- Epitran
// // ʃpriːt͡siçeːrem <-- Combination
//
// console.log(trie.translateText(germanRuleProcessor.process('eingetrockneter')));
// // ʔaengəˈtɾɔknətɐ̯ <-- Dict
// // aiŋetroknetə <-- Epitran
// // aiŋetroknetə <-- Combination
//
// console.log(trie.translateText(germanRuleProcessor.process('abgenötigten')));
// // ʔapgəˈnøːtɪktən̯ <-- Dict
// // apɡeːnøːtiktən <-- Epitran
// // apɡeːnøːtiktən <-- Combination
//
// console.log(trie.translateText(germanRuleProcessor.process('Hochzeitsgeschenken')));
// // ˈhɔxtsaetsgɛʃɛŋkən̯ <-- Dict
// // hoxt͡saitsɡeːʃənkən <-- Epitran
// // hoxt͡saitsɡeːʃənkən <-- Combination
//
// /**
//  * French
//  */
const frenchRuleProcessor = new RuleProcessor();
frenchRuleProcessor.loadRuleFile('fr_FR');
trie.loadTextDict('fr_FR');
// console.log(trie.translateText(frenchRuleProcessor.process('acceptes')));
// // aksɛpt <-- Dict
// // aksɛpt <-- Epitran
// // aksɛpt <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('antihistaminique')));
// // ɑ̃tiistaminik <-- Dict
// // antjistaminik <-- Epitran
// // antjistaminik <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('énucléassions')));
// // ɑenykleasjɔ̃ <-- Dict
// // enykleasjɔn <-- Epitran
// // enykleasjɔn <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('éradiquez')));
// // eʁadike <-- Dict
// // eradikɛz <-- Epitran
// // eradikɛz <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('régularisez')));
// // ʁegylaʁize <-- Dict
// // reɡlarizɛz <-- Epitran
// // reɡlarizɛz <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('bêchais')));
// // bɛʃɛ <-- Dict
// // bɛʃɛ <-- Epitran
// // bɛʃɛ <-- Combination
// console.log(trie.translateText(frenchRuleProcessor.process('fédéraux')));
// // fedeʁo <-- Dict
// // federo <-- Epitran
// // federo <-- Combination
//
const randomFrWords = [
    [ 'préluderais', '/pʁelydəʁɛ/' ],
    [ 'dédommagé', '/dedɔmaʒe/' ],
    [ 'ceignîmes', '/sɛɲim/' ],
    [ 'inquisitoire', '/ɛ̃kizitwaʁ/' ],
    [ 'dégradèrent', '/degʁadɛʁ/' ],
    [ 'tournicotions', '/tuʁnikɔtjɔ̃/' ],
    [ 'écoutais', '/ekutɛ/' ],
    [ 'transportai', '/tʁɑ̃spɔʁtɛ/' ],
    [ 'gambadez', '/gɑ̃bade/' ],
    [ 'confinements', '/kɔ̃finmɑ̃/' ],
    [ 'enkysteraient', '/ɑ̃kistəʁɛ/' ],
    [ 'subsistâtes', '/sybzistat/' ],
    [ 'cri', '/kʁi/' ],
    [ 'feu', '/fø/' ],
    [ 'management', '/manadʒmɛnt/' ],
    [ 'lambinée', '/lɑ̃bine/' ],
    [ 'tartinaient', '/taʁtinɛ/' ],
    [ 'insérerai', '/ɛ̃seʁəʁɛ/' ],
    [ 'ristournassent', '/ʁistuʁnas/' ],
    [ 'déplomberont', '/deplɔ̃bəʁɔ̃/' ],
    [ 'pensèrent', '/pɑ̃sɛʁ/' ],
    [ 'rassirez', '/ʁasiʁe/' ],
    [ 'procréerons', '/pʁɔkʁeəʁɔ̃/' ],
    [ 'caillions', '/kajɔ̃/' ],
    [ 'approuvées', '/apʁuve/' ],
    [ 'cloqués', '/klɔke/' ],
    [ 'mousson', '/musɔ̃/' ],
    [ 'cloisonnâtes', '/klwazɔnat/' ],
    [ 'encapuchonnions', '/ɑ̃kapyʃɔnjɔ̃/' ],
    [ 'lénifiasse', '/lenifjas/' ],
    [ 'cadastrées', '/kadastʁe/' ],
    [ 'camionnais', '/kamjɔnɛ/' ],
    [ 'définitives', '/definitiv/' ],
    [ 'métis', '/metis/' ],
    [ 'kaléidoscopes', '/kaleidɔskɔp/' ],
    [ 'regorgèrent', '/ʁəgɔʁʒɛʁ/' ],
    [ 'dépraverait', '/depʁavəʁɛ/' ],
    [ 'rassiriez', '/ʁasiʁje/' ],
    [ 'mouillants', '/mujɑ̃/' ],
    [ 'gondolière', '/gɔ̃dɔljɛʁ/' ],
    [ 'rebrousses', '/ʁəbʁus/' ],
    [ 'acquittât', '/akita/' ],
    [ 'replâtrait', '/ʁəplatʁɛ/' ],
    [ 'arrivât', '/aʁiva/' ],
    [ 'roulée', '/ʁule/' ],
    [ 'débusqueras', '/debyskəʁa/' ],
    [ 'subvertirai', '/sybvɛʁtiʁɛ/' ],
    [ 'bouchèrent', '/buʃɛʁ/' ],
    [ 'emmitouflerons', '/ɑ̃mitufləʁɔ̃/' ],
    [ 'dirigeante', '/diʁiʒɑ̃t/' ],
    [ 'robotiserais', '/ʁɔbɔtizəʁɛ/' ],
    [ 'grimons', '/gʁimɔ̃/' ],
    [ 'menasses', '/mənas/' ],
    [ 'polycopierais', '/pɔlikɔpjəʁɛ/' ],
    [ 'sacrifièrent', '/sakʁifjɛʁ/' ],
    [ 'réabonnons', '/ʁeabɔnɔ̃/' ],
    [ 'hégélien', '/egeljɛ̃/' ],
    [ 'déshydraté', '/dezidʁate/' ],
    [ 'conciliassions', '/kɔ̃siljasjɔ̃/' ],
    [ 'parasitisme', '/paʁazitism/' ],
    [ 'enorgueillissiez', '/ɑ̃nɔʁgœjisje/' ],
    [ 'insensées', '/ɛ̃sɑ̃se/' ],
    [ 'décongèles', '/dekɔ̃ʒɛl/' ],
    [ 'espérerai', '/ɛspeʁəʁɛ/' ],
    [ 'sauvette', '/sovɛt/' ],
    [ 'votants', '/vɔtɑ̃/' ],
    [ 'accastilleront', '/akastijəʁɔ̃/' ],
    [ 'transbahutât', '/tʁɑ̃sbayta/' ],
    [ 'accédés', '/aksede/' ],
    [ 'tournicoterai', '/tuʁnikɔtəʁɛ/' ],
    [ 'délirerait', '/deliʁəʁɛ/' ],
    [ 'bagarraient', '/bagaʁɛ/' ],
    [ 'mâchât', '/maʃa/' ],
    [ 'décomplexent', '/dekɔ̃plɛks/' ],
    [ 'rempli', '/ʁɑ̃pli/' ],
    [ 'abreuvait', '/abʁœvɛ/' ],
    [ 'acidités', '/asidite/' ],
    [ 'bouclent', '/bukl/' ],
    [ 'grognait', '/gʁɔɲɛ/' ],
    [ 'pensionnas', '/pɑ̃sjɔna/' ],
    [ 'quadrillé', '/kadʁije/' ],
    [ 'vivez', '/vive/' ],
    [ 'succombés', '/sykɔ̃be/' ],
    [ 'aménager', '/amenaʒe/' ],
    [ 'subjuguerait', '/sybʒygəʁɛ/' ],
    [ 'instituée', '/ɛ̃stitɥe/' ],
    [ 'redémarrée', '/ʁədemaʁe/' ],
    [ 'éliminassions', '/eliminasjɔ̃/' ],
    [ 'adressons', '/adʁɛsɔ̃/' ],
    [ 'refilassions', '/ʁəfilasjɔ̃/' ],
    [ 'forages', '/fɔʁaʒ/' ],
    [ 'consciente', '/kɔ̃sjɑ̃t/' ],
    [ 'cartonneuse', '/kaʁtɔnøz/' ],
    [ 'extrémisme', '/ɛkstʁemism/' ],
    [ 'redescende', '/ʁədesɑ̃d/' ],
    [ 'réservé', '/ʁezɛʁve/' ],
    [ 'ensachassiez', '/ɑ̃saʃasje/' ],
    [ 'handicaperai', '/ʼɑ̃dikapəʁɛ/' ],
    [ 'nacreraient', '/nakʁəʁɛ/' ],
    [ 'existaient', '/ɛgzistɛ/' ]
]

for(const word of randomFrWords) {
    word.push(trie.translateText(frenchRuleProcessor.process(word[0])))
}

console.log(randomFrWords)
