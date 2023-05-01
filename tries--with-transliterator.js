const fs = require('fs');

/**
 * Reads a file from the local file system and returns its content as a string.
 * If the file cannot be read, returns null. The file path is relative to the
 * current working directory.
 *
 * @param {string} file - The name of the file to be loaded.
 * @returns {?Buffer} A string representing the content of the file if the file
 *                    is successfully loaded, or null if the file cannot be loaded.
 */
function loadFile(file) {
    try {
        let response = fs.readFileSync(`./${file}`, 'UTF-8');
        if (!response) throw new Error(`Failed to load ${file}`);
        return response;
    } catch (e) {
        return null;
    }
}

/**
 * Represents a node in a trie data structure that stores a character, the phonetics
 * associated with that character, the word formed by that character and its predecessors,
 * and a map of the next characters in the word sequence.
 */
class CharNode {
    /**
     * The character stored in this node.
     * @type {string}
     */
    _char;

    /**
     * A Set of phonetics associated with this character.
     * @type {Set<string>}
     */
    _phonetics = new Set();

    /**
     * The word formed by this character and its predecessors.
     * @type {?string}
     */
    _word = null;

    /**
     * A map of the next characters in the word sequence.
     * @type {Object<string, CharNode>}
     */
    _nextCharsLevel = {};

    /**
     * Constructs a new CharNode with the given character.
     *
     * @param {string} char - The character stored in this node.
     */
    constructor(char) {
        this._char = char;
    }

    /**
     * Returns the character stored in this node.
     *
     * @returns {string} The character stored in this node.
     */
    get char() {
        return this._char;
    }

    /**
     * Returns the Set of phonetics associated with this character.
     *
     * @returns {Set<string>} The Set of phonetics associated with this character.
     */
    get phonetics() {
        return this._phonetics;
    }

    /**
     * Returns the word formed by this character and its predecessors.
     *
     * @returns {?string} The word formed by this character and its predecessors,
     *                    or null if no word has been set.
     */
    get word() {
        return this._word;
    }

    /**
     * Returns the map of the next characters in the word sequence.
     *
     * @returns {Object<string, CharNode>} The map of the next characters in the word sequence.
     */
    get nextCharsLevel() {
        return this._nextCharsLevel;
    }

    /**
     * Adds a phonetic to the Set of phonetics associated with this character.
     *
     * @param {string} phonetic - The phonetic to add.
     */
    addPhonetic(phonetic) {
        this._phonetics.add(phonetic);
    }

    /**
     * Sets the word formed by this character and its predecessors.
     *
     * @param {string} word - The word to set.
     */
    setWord(word) {
        this._word = word;
    }
}

/**
 * A data structure used for efficient retrieval of data.
 *
 * @class
 */
class Trie {
    /**
     * The current language code being used.
     *
     * @type {string | null}
     * @private
     */
    _currentLanguageCode = null;
    /**
     * A dictionary of loaded dictionaries.
     *
     * @type {Object}
     * @private
     */
    _loadedDictionaries = {};

    /**
     * Gets the first characters level of the currently loaded language dictionary.
     *
     * @returns {Object} The first characters level of the currently loaded language dictionary.
     */
    get firstCharsLevel() {
        return this._loadedDictionaries[this._currentLanguageCode];
    }

    /**
     * Adds a word and its phonetic pronunciation(s) to the Trie.
     *
     * @param {string} word - The word to be added.
     * @param {string} phonetic - The phonetic pronunciation(s) of the word to be added, separated by a comma and a space.
     */
    addWord(word, phonetic) {
        const charsArr = word.split('');
        let currentCharLevel = this.firstCharsLevel;
        let currentCharNode;
        let currentChar;
        do {
            currentChar = charsArr.shift();
            if (currentChar in currentCharLevel) {
                currentCharNode = currentCharLevel[currentChar];
                currentCharLevel = currentCharLevel[currentChar].nextCharsLevel;
                continue;
            }
            currentCharLevel[currentChar] = new CharNode(currentChar);
            currentCharNode = currentCharLevel[currentChar];
            currentCharLevel = currentCharLevel[currentChar].nextCharsLevel;
        } while (charsArr.length);
        const phoneticOptions = phonetic.split(', ');
        for (const phoneticOption of phoneticOptions) {
            currentCharNode.addPhonetic(phoneticOption);
        }
        currentCharNode.setWord(word);
    }

    /**
     * Finds the CharNode of a given word in the Trie.
     *
     * @param {string} word - The word to search for in the Trie.
     * @returns {CharNode|null} The CharNode of the word in the Trie, or null if not found.
     */
    findCharNode(word) {
        const charsArr = word.split('');
        let currentCharLevel = this.firstCharsLevel;
        let currentChar;
        let currentCharNode;
        do {
            currentChar = charsArr.shift();
            if (!(currentChar in currentCharLevel)) return null;
            currentCharNode = currentCharLevel[currentChar];
            if (!charsArr.length) return currentCharNode;
            currentCharLevel = currentCharNode.nextCharsLevel;
        } while (charsArr.length);
        return null;
    }

    /**
     * Finds the phonetic pronunciations of a given word in the Trie.
     *
     * @param {string} word - The word to search for in the Trie.
     * @returns {Set<string>|null} The set of phonetic pronunciations of the word in the Trie, or null if not found.
     */
    findPhonetics(word) {
        const result = this.findCharNode(word);
        return result ? result.phonetics : null;
    }

    /**
     * Checks if a given dictionary has been loaded into the Trie.
     *
     * @param {string} dictionary - The language dictionary to check if it has been loaded.
     * @returns {boolean} True if the dictionary has been loaded, false otherwise.
     */
    hasDictionary(dictionary) {
        return Object.keys(this._loadedDictionaries).includes(dictionary);
    }
}

/**
 * A class representing an abstract Trie stepper.
 * @extends Trie
 */
class TrieStepperAbstract extends Trie {
    /**
     * The current level of the Trie.
     * @type {object|null}
     * @private
     */
    _currentLevel = null;

    /**
     * The last node with a result in the Trie.
     * @type {CharNode|null}
     * @private
     */
    _lastNodeWithResult = null;

    /**
     * Indicates whether all characters in the current search term have been found.
     * @type {boolean}
     * @private
     */
    _foundChars = false;

    /**
     * The index of the last character in the current search term that returned a result.
     * @type {number|null}
     * @private
     */
    _lastResultCursor = null;

    /**
     * The current node in the Trie.
     * @type {CharNode|null}
     * @private
     */
    _currentNode = null;

    /**
     * The current position of the cursor in the search term.
     * @type {number}
     * @private
     */
    _cursor = 0;

    /**
     * An array representing the result of the search in the Trie.
     * @type {Array}
     * @private
     */
    _result = [];

    /**
     * The search term to look for in the Trie.
     * @type {string|null}
     * @private
     */
    _text = null;

    /**
     * The prosody level to use in text-to-speech synthesis.
     * @type {number}
     * @private
     */
    _prosody = 85;

    /**
     * Gets the current position of the cursor in the search term.
     * @type {number}
     * @readonly
     */
    get cursor() {
        return this._cursor;
    }

    /**
     * Gets the last set of phonetics returned by a search in the Trie.
     * @type {Set|null}
     * @readonly
     */
    get lastPhoneticsSet() {
        if (!this._lastNodeWithResult) return null;
        return this._lastNodeWithResult.phonetics;
    }

    /**
     * Gets the result of the search in the Trie, as a string.
     * @type {string}
     * @readonly
     */
    get result() {
        return this._result.map(r =>
            r instanceof CharNode
                ? [...r.phonetics][0]
                : r,
        ).join('');
    }


    /**
     * Gets the raw result of the search in the Trie, as an array of objects containing the word and its phonetics or a character.
     * @type {Array}
     * @readonly
     */
    get resultRaw() {
        return this._result.map(
            r => r instanceof CharNode
                ? {phonetics: [...r.phonetics], word: r.word}
                : {char: r},
        );
    }

    /**
     * Gets the text-to-speech synthesis result of the search in the Trie, as an SSML string.
     * @type {string}
     * @readonly
     */
    get pollyResult() {
        const ssmlStr = this._result.map(r => {
            if (r instanceof CharNode) {
                const cleanedText = [...r.phonetics][0].replace('/', '');
                return `<phoneme alphabet='ipa' ph='${cleanedText}'/>`;
            }
            return escapeSsml(r);
        }).join('')
            .replace(/\n\n/ug, '\r')
            .replace(/\n/ug, '<break strength="weak"/>');
        return `<speak><prosody rate="${this._prosody}%">${ssmlStr}</prosody></speak>`;
    }

    /**
     * Set the text to be translated. Adds extra spaces to the beginning and end of the string, and converts it to lowercase.
     *
     * @param {string} text - The text to be translated.
     * @returns {void}
     */
    set text(text) {
        // Todo: remove need for extra spaces;
        this._text = typeof text === 'string' ? ' ' + text.toLowerCase() + ' ' : null;
    }

    /**
     * Set the prosody value used for the synthesized speech.
     *
     * @param {number} value - The prosody value to be set.
     * @returns {void}
     */
    set prosody(value) {
        this._prosody = value;
    }

    /**
     * Translates the given text using the TrieStepperAbstract and returns the result.
     * @param {string} text - The text to translate.
     * @returns {string} The translated text.
     * @throws {Error} If the input text is not a string.
     */
    translateText(text) {
        if (typeof text !== 'string') throw new Error('Text must be a string');
        this._text = ' ' + text.toLowerCase() + ' '; // Todo: remove need for spaces;
        this.run();
        const result = this.result;
        return result.trim();
    }

    /**
     * Translates the given text to audio using Amazon Polly and returns a Promise that resolves with the audio data.
     * @param {string} text - The text to translate.
     * @param {string} [gender='male'] - The gender of the voice to use for the audio.
     * @param {number} [prosody] - The prosody rate to use for the audio.
     * @returns {Promise<AudioStream>} A Promise that resolves with the audio data.
     */
    async translateAudio(text, gender, prosody) {
        this._text = text;
        if (prosody) this._prosody = prosody;
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

    /**
     * Reset the internal state of the TrieStepperAbstract instance.
     * This method resets some properties to their initial values, making the instance ready to run a new translation,
     * but retains any text that has been set on the instance.
     *
     * @function
     * @returns {void}
     */
    reset() {
        this._currentLevel = this.firstCharsLevel;
        this._lastNodeWithResult = null;
        this._foundChars = false;
    }

    /**
     * Clear the internal state of the TrieStepperAbstract instance.
     * This method resets all properties to their initial values, making the instance ready to run a new translation.
     *
     * @function
     * @returns {void}
     */
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

    /**
     * Returns whether the given character is a letter or not.
     * @param {string} str - The character to test.
     * @returns {boolean} True if the character is a letter, false otherwise.
     */
    isLetter(str) {
        return /\p{L}/u.test(str);
    }
}

/**
 * A class for stepping through words in a text using a trie data structure.
 * Extends the abstract `TrieStepperAbstract` class.
 */
class TrieWordStepper extends TrieStepperAbstract {
    _orthographyStepper = null;
    _currentWord = '';

    /**
     * Adds an orthography stepper to the trie word stepper.
     * @param {TrieOrthographyStepper} orthographyStepper - An orthography stepper to add.
     */
    addOrthographyStepper(orthographyStepper) {
        this._orthographyStepper = orthographyStepper;
    }

    /**
     * Runs the trie word stepper.
     * Throws an error if no text has been set before running.
     */
    run() {
        if (typeof this._text !== 'string') throw new Error('Set some text before running');
        this._currentLevel = this.firstCharsLevel;
        while (this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if (char in this._currentLevel &&
                (this._foundChars || !this.isLetter(this._text[this._cursor - 1]))) {
                this._foundChars = true;
                this._currentNode = this._currentLevel[char];
                this._currentLevel = this._currentNode.nextCharsLevel;
                if (this._currentNode.word && !this.isLetter(this._text[this._cursor + 1])) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._cursor++;
            } else if (this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult);
                this._cursor = this._lastResultCursor + 1;
                this._lastAddedCursor = this._cursor;
                this.reset();
            } else {
                for (let i = this._lastAddedCursor; i <= this._cursor; i++) {
                    const char = this._text[i];
                    if (!this.isLetter(char)) {
                        this._result.push(char);
                        continue;
                    }
                    this._currentWord += char;
                    if (!this.isLetter(this._text[i + 1])) {
                        if (this._orthographyStepper) {
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

    /**
     * Loads a dictionary into the trie data structure.
     * @param {string} dictionary - The dictionary to load.
     */
    loadDictionary(dictionary) {
        this._currentLanguageCode = dictionary;
        if (this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = loadFile(`./combined-dictionaries/${dictionary}.txt`);
        const lines = response.split(/\r?\n/);
        for (const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if (!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
        }
    }
}

/**
 * A class that represents a trie data structure for orthography (spelling)
 * lookup and conversion. This class extends the `TrieStepperAbstract` class,
 * adding the ability to preprocess and postprocess text based on language-specific
 * rules.
 *
 * @extends {TrieStepperAbstract}
 */
class TrieOrthographyStepper extends TrieStepperAbstract {
    /**
     * A map of rule preprocessor objects for each language.
     * @type {Object.<string, RuleProcessor>}
     * @private
     */
    _rulePreprocessors = {};

    /**
     * A map of rule postprocessor objects for each language.
     * @type {Object.<string, RuleProcessor>}
     * @private
     */
    _rulePostprocessors = {};

    /**
     * Returns the result of the trie traversal, with any necessary
     * language-specific preprocessing and postprocessing applied.
     * @type {string}
     * @readonly
     */
    get result() {
        let result = this._result.map(r =>
            r instanceof CharNode
                ? [...r.phonetics][0]
                : r,
        ).join('');
        if (this._currentLanguageCode in this._rulePreprocessors) {
            result = this._rulePostprocessors[this._currentLanguageCode].process(result);
        }
        return result;
    }

    /**
     * Adds a rule preprocessor for the given language.
     * @param {string} languageCode - The language code for which to add the processor.
     */
    addRulePreprocessorForLanguage(languageCode) {
        const ruleProcessor = new RuleProcessor();
        ruleProcessor.loadRuleFile(languageCode, 'preprocessor');
        this._rulePreprocessors[languageCode] = ruleProcessor;
    }

    /**
     * Adds a rule postprocessor for the given language.
     * @param {string} languageCode - The language code for which to add the processor.
     */
    addRulePostprocessorForLanguage(languageCode) {
        const ruleProcessor = new RuleProcessor();
        ruleProcessor.loadRuleFile(languageCode, 'postprocessor');
        this._rulePostprocessors[languageCode] = ruleProcessor;
    }

    /**
     * Runs the trie traversal, applying any necessary language-specific preprocessing.
     */
    run() {
        if (typeof this._text !== 'string') throw new Error('Set some text before running');
        if (this._currentLanguageCode in this._rulePreprocessors) {
            this._text = this._rulePreprocessors[this._currentLanguageCode].process(this._text);
        }
        this._currentLevel = this.firstCharsLevel;
        while (this._cursor < this._text.length) {
            const char = this._text[this._cursor];
            if (char in this._currentLevel) {
                this._currentNode = this._currentLevel[char];
                this._currentLevel = this._currentNode.nextCharsLevel;
                if (this._currentNode.word) {
                    this._lastNodeWithResult = this._currentNode;
                    this._lastResultCursor = this._cursor;
                }
                this._cursor++;
            } else if (this._lastNodeWithResult) {
                this._result.push(this._lastNodeWithResult);
                this._cursor = this._lastResultCursor + 1;
                this._lastAddedCursor = this._cursor;
                this.reset();
            } else {
                for (let i = this._lastAddedCursor || 0; i <= this._cursor; i++) {
                    this._result.push(this._text[i]);
                }
                this._lastAddedCursor = this._cursor + 1;
                this._cursor++;
                this.reset();
            }
        }
    }

    /**
     * Loads a dictionary into the trie data structure.
     * @param {string} dictionary - The dictionary to load.
     */
    loadDictionary(dictionary) {
        this._currentLanguageCode = dictionary;
        if (this.hasDictionary(dictionary)) return;
        this._loadedDictionaries[dictionary] = {};
        const response = loadFile(`./processors/maps/${dictionary}.txt`);
        const lines = response ? response.split(/\r?\n/) : [];
        for (const line of lines) {
            const [word, phonetic] = line.split(/\t/);
            if (!(word && phonetic)) continue;
            this.addWord(word.toLowerCase(), phonetic);
        }
    }
}

class Rule {
    /**
     * The string to replace in the word.
     * @type {string}
     * @private
     */
    _toReplace = '';

    /**
     * The replacement string to use.
     * @type {string}
     * @private
     */
    _replacement = '';

    /**
     * The prefix string to match in the word.
     * @type {?string}
     * @private
     */
    _prefix = null;

    /**
     * The suffix string to match in the word.
     * @type {?string}
     * @private
     */
    _suffix = null;

    /**
     * Creates a new rule from the given string and character groups.
     * @param {string} rule - The rule string to parse.
     * @param {Object<string, string>} charGroups - The character groups to use for prefix/suffix matching.
     */
    constructor(rule, charGroups) {
        const [strings, match] = rule.split(/\s+\/\s+/u);
        [this._toReplace, this._replacement] = strings.split(/\s+->\s+/u);
        [this._prefix, this._suffix] = match.split(/\s?_\s?/u);

        // Replace any character groups in prefix/suffix with their respective values
        for (const [key, value] of Object.entries(charGroups)) {
            const charGroupRegex = new RegExp(key, 'gu');
            this._prefix = this._prefix ? this._prefix.replace(charGroupRegex, value)
                .replace(/#/u, '^') : '';
            this._suffix = this._suffix ? this._suffix.replace(charGroupRegex, value)
                .replace(/#/u, '$') : '';
        }

        // Remove any zero in the replacement string
        this._replacement = this._replacement.replace(/0/u, '');
    }

    /**
     * The regex pattern for this rule.
     * @type {RegExp}
     */
    get regex() {
        return new RegExp(`(${this._prefix})(${this._toReplace})(${this._suffix})`, 'ug');
    }

    /**
     * Applies this rule to the given word.
     * @param {string} word - The word to apply the rule to.
     * @returns {string} The resulting transformed word.
     */
    apply(word) {
        return word.replace(this.regex, (_m, a, _b, c) => a + this._replacement + c);
    }
}

/**
 * A class that processes words using a set of language rules.
 */
class RuleProcessor {
    /**
     * The list of rules to be applied to words.
     * @private
     * @type {Rule[]}
     */
    _rules = [];

    /**
     * Loads the language rules for the specified language and rule type.
     * @param {string} languageCode - The language code to load rules for.
     * @param {string} type - The type of rules to load (e.g. "stemming", "inflection").
     */
    loadRuleFile(languageCode, type) {
        const response = loadFile(`processors/rules/${type}s/${languageCode}.txt`);
        if (!response) return;
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

    /**
     * Processes a word by applying all loaded rules to it.
     * @param {string} word - The word to process.
     * @returns {string} The processed word.
     */
    process(word) {
        if (!this._rules.length) return word;
        return this._rules.reduce((w, r) => r.apply(w), word);
    }
}

const trieWord = new TrieWordStepper();
const trieOrthography = new TrieOrthographyStepper();

/**
 * Translates the given text to the specified language using the provided trie-based dictionary and orthography steppers.
 * @param {string} language - The language code to translate the text to.
 * @param {string} text - The text to translate.
 * @returns {string} The translated text.
 */
function translate(language, text) {
    trieWord.loadDictionary(language);
    trieOrthography.loadDictionary(language);
    trieOrthography.addRulePreprocessorForLanguage(language);
    trieOrthography.addRulePostprocessorForLanguage(language);
    trieWord.addOrthographyStepper(trieOrthography);
    const result = trieWord.translateText(text);
    trieWord.clear();
    return result;
}


/**
 * Logs the translation of the given text to the console.
 * @param {string} languageCode - The language code to translate the text to.
 * @param {string} title - The title of the text being translated.
 * @param {string} text - The text to translate.
 */
function logTranslation(languageCode, title, text) {
    const result = translate(languageCode, text);
    const textLines = text.split(/\n/);
    const resultLines = result.split('\n');
    console.log(`${languageCode}: ${title}`);
    console.log('----\n');
    for (let i = 0; i < Math.max(textLines.length, resultLines.length); i++) {
        if (i < textLines.length) console.log(textLines[i]);
        if (i < resultLines.length) console.log(resultLines[i]);
        console.log('');

    }
    console.log('----\n\n');
}

const examples = [
    {languageCode: 'de', title: 'Erlkönig', text: 'Wer reitet so spät durch Nacht und Wind?\nEs ist der Vater mit seinem Kind:\nEr hat den Knaben wohl in dem Arm,\nEr fasst ihn sicher, er hält ihn warm.\n„Mein Sohn, was birgst du so bang dein Gesicht?“\n„Siehst, Vater, du den Erlkönig nicht?\nDen Erlenkönig mit Kron’ und Schweif?“\n„Mein Sohn, es ist ein Nebelstreif.“\n„Du liebes Kind, komm, geh mit mir!\nGar schöne Spiele spiel’ ich mit dir;\nManch’ bunte Blumen sind an dem Strand,\nMeine Mutter hat manch gülden Gewand.“\n„Mein Vater, mein Vater, und hörest du nicht,\nWas Erlenkönig mir leise verspricht?“\n„Sei ruhig, bleibe ruhig, mein Kind:\nIn dürren Blättern säuselt der Wind.“\n„Willst, feiner Knabe, du mit mir gehn?\nMeine Töchter sollen dich warten schön;\nMeine Töchter führen den nächtlichen Rein\nUnd wiegen und tanzen und singen dich ein.“\n„Mein Vater, mein Vater, und siehst du nicht dort\nErlkönigs Töchter am düstern Ort?“\n„Mein Sohn, mein Sohn, ich seh es genau:\nEs scheinen die alten Weiden so grau.“\n„Ich liebe dich, mich reizt deine schöne Gestalt;\nUnd bist du nicht willig, so brauch ich Gewalt.“\n„Mein Vater, mein Vater, jetzt fasst er mich an!\nErlkönig hat mir ein Leids getan!“\nDem Vater grausets, er reitet geschwind,\nEr hält in Armen das ächzende Kind,\nErreicht den Hof mit Mühe und Not:\nIn seinen Armen das Kind war tot.'},
    {languageCode: 'fr_FR', title: 'L’Heure exquise', text: 'La lune blanche\nLuit dans les bois;\nDe chaque branche\nPart une voix\nSous la ramée...\nÔ bien aimée.\nL\'étang reflète,\nProfond miroir,\nLa silhouette\nDu saule noir\nOù le vent pleure...\nRêvons, c\'est l\'heure.\nUn vaste et tendre\nApaisement\nSemble descendre\nDu firmament\nQue l\'astre irise...\nC\'est l\'heure exquise.'},
    {languageCode: 'es_ES', title: 'El curandero', text: 'Hoy al portal ha venido\nun saltimbanqui de aquellos\nque en los pueblos donde acuden\ndicen que son curanderos;\nestos traen mil invenciones\nde bálsamos y remedios\ny hoy que ha nacido el del mundo\nviene uno que habla por ciento.\n\nO li pastorcilli,\nO li zagaleco\nvenite al pórtalo\naqui videremo\nque io so magistro\ndi tuti remedio,\ndi grande, di chiqui,\ndi malo, di bueno.\n\nR.: Venid, pastorcillos,\nvenid zagalejos,\nveamos qué dice\nel tal curandero\nal Niño precioso\nque lo oye riyendo.\n\nO, e cosi espantosi,\nO, e grandi consuelo\nli balsamo porto\nque sana los muertos,\ndoy dientes a viecas,\ndoy ochios a tuertos,\na los corcubatus\nles pongo derechos\ny a los porfiatos\nles curo lo necio.\n\nJesús solamente\npudiera hacer eso.\nCarissimi, sapia\nque io so maiestro\ndi femina, di huomo,\ndi bianchi, di negro,\ndi grandi, di chiqui,\ndi malo, di bueno.\n\nPues por los hijares\nhablando le vemos,\nR.\n\nCoplas\n1. Al huomo corcubatu\nen la prensa le meto\ne a catro o cinque volta\nil corpo li indereso,\nma l’anima si fuche,\nio non mi curo de eso.\n\nTal modo de curar\nes muy enfermo.\nAtengo me al Niño,\nque el yugo que ha puesto\nremedia los hombres\ny no tiene riesgo.\n\nEs máximo doctore il bambineto\n\n2. Al torto en la sua testa\nle formo un arbugero\ne un ochio di cristalo\nli encaco pur adentro,\nma si lusse sus echa,\nnon so qué faré in questo.\n\nEso es desentortar\ny quedar ciegos.\nSin eso peligro\nAmor ha dispuesto\nabrirnos los ojos\na nuestro remedio.\n\nCol sole qui a nasciuto, io lo credo.\n\n3. Senza dolore mio,\nio saco in un momento\nla mola e si la encia\nsi vene con el hierro\nio non riparo nunca\nen hoso más o menos.\n\nComo es la habilidad\nes el efecto:\nel Niño sí saca\nal hombre algún hueso\nes dándole esposa\nsu halago y consuelo.\n\nMa con serpente e poma il suo tormento.\n\n4. Feridas de la testa,\ndi collo, gamba e petto,\nmio bálsamo las cura\n'},
];

for (const {languageCode, title, text} of examples) {
    logTranslation(languageCode, title, text);
}

/**
 * Extras for Polly processing
 */
const getVoice = (language, gender) => {
    switch (language) {
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
