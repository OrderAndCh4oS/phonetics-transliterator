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

        let response = fs.readFileSync(`../${this._filePath}/${dictionary}.txt`, 'UTF-8');

        const lines = response.split(/\r?\n/);

        for(const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if(!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
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
        this._filePath = 'found-data/translations'
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
        this._filePath = 'processors/maps'
    }

    run() {
        if(typeof this._text !== 'string') throw new Error('Set some text before running');
        this._currentLevel = this.firstCharsLevel;
        while(this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if(char in this._currentLevel &&
                (this._foundCharCount !== 0)) {
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

const trie = new TrieWordStepper();

trie.loadTextDict('de');
console.log(trie._loadedDictionaries['de'])
// console.log('\n\n');
// console.log('Title, by Author\n---\n');
// console.log(trie.translateText(``));

console.log('Ländliches Lied, by Emanuel Geibel\n---\n');
console.log(trie.translateText(`Und wenn die Primel schneeweiss blickt\nAm Bach aus dem Wiesengrund,\nUnd wenn am Bach die Kirschblüth’ nickt\nUnd die Vöglein pfeifen im Wald allstund:\nDa flickt der Fischer das Netz in Ruh,\nDenn der See liegt heiter im Sonnenglanz;\nDa sucht das Mädel die rothen Schuh,\nUnd schnürt das Mieder sich eng zum Tanz,\nUnd denket still,\nOb der Liebste nicht kommen will.\nEs klingt die Fiedel, es brummt der Bass,\nDer Dorfschulz sitzet im Schank beim Wein,\nDie Tänzer drehn sich ohn’ Unterlass\nAn der Lind’ im Abendschein.\nUnd geht’s nach Haus um Mitternacht,\nGlüh-Würmchen trägt das Laternchen vor;\nDa küsset der Bube sein Dirnel sacht,\nUnd sagt ihr leis’ ein Wörtchen in’s Ohr,\nUnd sie denken Beid’,\nO du selige fröhliche Maienzeit!`));

trie.loadTextDict('en_UK');

console.log('\n\n');
console.log('O the sight entrancing, by Thomas Moore\n---\n');
console.log(trie.translateText(`O the sight entrancing,\nWhen morning’s beam is glancing\nO’er files array’d\nWith helm and blade,\nAnd plumes in the gay wind dancing.\nWhen hearts are all high beating,\nAnd the trumpet’s voice repeating\nThat song whose breath\nMay lead to death,\nBut never to retreating.\nThen if a cloud comes over\nThe brow of sire or lover,\nThink ’tis the shade\nBy vict’ry made,\nWhose wings right o’er us hover.\nYet ’tis not helm or feather\nFor ask yon despot whether\nHis plumèd bands\nCould bring such hands\nAnd hearts as ours together.\nLeave pomps to those who need ’em,\nAdorn but man with freedom,\nAnd proud he braves\nThe gaudiest slaves\nThat crawl where monarchs lead ’em.\nThe sword may pierce the beaver,\nStone walls in time my sever,\n’Tis mind alone,\nWorth steel and stone,\nThat keeps men free for ever!`));

console.log('\n\n');
console.log('The Fortune-teller (Die Kartenlegerin), by Pierre Béranger\n---\n');
console.log(trie.translateText(`Has mother finally fallen asleep\nOver her book of sermons?\nYou, my needle, now lie still,\nStop this constant sewing!\nOh, what things can I expect,\nOh, how will it all end?\nIf I am not deceived,\nOne, I think of, will appear,\nJolly good, here he comes,\nThe knave of hearts has done his duty.\nA rich widow? Dear, oh dear.\nYes, he woos her, I’m undone,\nOh! the wicked scoundrel.\nHeartache and much vexation,\nA school with restricting walls,\nBut the king of diamonds will take pity\nAnd comfort me.\nA nicely delivered present,\nHe elopes with me, a journey\nMoney and happiness in abundance.\nThis king of diamonds\nMust be a prince or king,\nWhich means that it won’t take much\nFor me to be a princess.\nHere’s a foe, who strives to soil\nMy name before His Majesty,\nAnd a fair-haired man is there as well.\nA secret comes to light,\nAnd I escape just in time,\nFarewell, O life of splendour,\nAh, that was a cruel blow.\nThe one is gone, a crowd\nSurges around me\nThat I can scarcely count them all.\nWhat’s this? A dumb female apparition,\nA wheezing old woman coming my way,\nTo banish love and happiness\nBefore my youth has gone?\nAh, it’s mother, who’s woken up,\nOpening wide her mouth to scold.\nNo, the cards never lie.`));

