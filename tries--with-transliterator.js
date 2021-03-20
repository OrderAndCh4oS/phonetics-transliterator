const fs = require('fs');

async function loadFile(file) {
    let response = fs.readFileSync(`./${file}`, 'UTF-8');
    if(!response) throw new Error(`Failed to load ${file}`);
    return response;
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
    _currentDictionary = null;
    _loadedDictionaries = {};

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

    isLetter(str) {return /\p{L}/u.test(str);}
}

class TrieWordStepper extends TrieStepperAbstract {
    _orthographyStepper = null;

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
                let currentWord = '';
                for(let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    const char = this._text[i];
                    if(!this.isLetter(char)) {
                        this._result.push(char);
                        continue;
                    }
                    currentWord += char;
                    if(!this.isLetter(this._text[i + 1])) {
                        if(this._orthographyStepper) {
                            currentWord = this._orthographyStepper.translateText(currentWord);
                        }
                        this._result.push('/' + currentWord + '/');
                        currentWord = '';
                    }
                }
                this._lastAddedCursor = this._cursor + 1;
                this._cursor++;
                this.reset();
            }
        }
    }

    async loadDictionary(dictionary) {
        this._currentDictionary = dictionary;
        if(this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = await loadFile(`${dictionary}.txt`);
        const lines = response.split(/\r?\n/);
        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
        }
    }
}

class TrieOrthographyStepper extends TrieStepperAbstract {
    _ruleProcessor;

    constructor(ruleProcessor) {
        super();
        this._ruleProcessor = ruleProcessor;
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        this._text = this._ruleProcessor.process(this._text);
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length + 1) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel) {
                this._currentNode = this._currentLevel[char];
                if(this._currentNode.word) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._currentLevel = this._currentNode.nextCharsLevel;
            } else if(this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult);
                this._lastAddedCursor = this._cursor;
                this._cursor = this._lastResultCursor;
                this.reset();
            } else {
                for(let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    this._result.push(this._text[i]);
                }
                this._lastAddedCursor = this._cursor;
                this.reset();
            }
            this._cursor++;
        }
    }

    async loadDictionary(dictionary) {
        this._currentDictionary = dictionary;
        if(this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = await loadFile(`${dictionary}.txt`);
        const lines = response.split(/\r?\n/);
        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
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

    async loadRuleFile(languageCode) {
        const charGroupRegex = /^::\p{L}+?::\s+?=\s+?[\p{L}|]+/gmu;
        const ruleRegex = /^[\p{L}\[\]|]+?\s+->\s+[\p{L}\p{M}\[\]<>|0]+\s+\/\s+.*?$/gmu;
        const response = await loadFile(`rules/preprocessors/${languageCode}.txt`);
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

const trieWord = new TrieWordStepper();
const ruleProcessor = new RuleProcessor();
const trieOrthographyStepper = new TrieOrthographyStepper(ruleProcessor);

async function translate(language, text) {
    await trieWord.loadDictionary(`translations/${language}`);
    await trieOrthographyStepper.loadDictionary(`maps/${language}`);
    trieWord.addOrthographyStepper(trieOrthographyStepper);
    const result = trieWord.translateText(text);
    trieWord.clear();
    return result;
}

(async() => {
    console.log(await translate('fr_FR', `Mon enfant, ma sœur,
Songe à la douceur
D’aller là-bas vivre ensemble!
Aimer à loisir,
Aimer et mourir
Au pays qui te ressemble!
Les soleils mouillés
De ces ciels brouillés
Pour mon esprit ont les charmes
Si mystérieux
De tes traîtres yeux,
Brillant à travers leurs larmes.
Là, tout n’est qu’ordre et beauté,
Luxe, calme et volupté!
Vois sur ces canaux
Dormir ces vaisseaux
Dont l’humeur est vagabonde;
C’est pour assouvir
Ton moindre désir
Qu’ils viennent du bout du monde.
-Les soleils couchants
Revêtent les champs,
Les canaux, la ville entière,
D’hyacinthe et d’or;
Le monde s’endort
Dans une chaude lumière.
Là, tout n’est qu’ordre et beauté,
Luxe, calme et volupté!`));
})();

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
