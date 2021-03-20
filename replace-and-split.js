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
    _firstCharsLevel = {};

    constructor() {}

    addWord(word, phonetic) {
        const charsArr = word.split('');
        let currentCharLevel = this._firstCharsLevel;
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
        let currentCharLevel = this._firstCharsLevel;
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
}

const getWords = (text) =>
    text
        .replace(/[\n\r]+/g, ' ')
        .replace(/[^\p{L}\p{M}\p{Zs}\p{So}\s-]+/ug, '')
        .replace(/\s\s+/g, ' ')
        .split(' ');

const words = getWords(`O the sight entrancing,
When morning’s beam is glancing
O’er files array’d
With helm and blade,
And plumes in the gay wind dancing.
When hearts are all high beating,
And the trumpet’s voice repeating
That song whose breath
May lead to death,
But never to retreating.
Then if a cloud comes over
The brow of sire or lover,
Think ’tis the shade
By vict’ry made,
Whose wings right o’er us hover.
Yet ’tis not helm or feather
For ask yon despot whether
His plumèd bands
Could bring such hands
And hearts as ours together.
Leave pomps to those who need ’em,
Adorn but man with freedom,
And proud he braves
The gaudiest slaves
That crawl where monarchs lead ’em.
The sword may pierce the beaver,
Stone walls in time my sever,
’Tis mind alone,
Worth steel and stone,
That keeps men free for ever!`);

let response = fs.readFileSync('./en-dict.json');
let en = JSON.parse(response);
const trie = new Trie();
Object.entries(en).map(entry => {
    trie.addWord(entry[0], entry[1]);
});

console.log(words.map(w => {
    const phonetics = trie.findPhonetics(w.toLowerCase());
    if(!phonetics) return w
    return [...phonetics][0]
}).join(' '));
