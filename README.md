# International Phonetic Alphabet (IPA) Transliterator

The IPA Transliterator is a JavaScript library that translates text to the International Phonetic Alphabet (IPA) using a dictionary of words and a set of phonological rules. The library uses a trie data structure to efficiently search for words in the dictionary and apply phonological rules to the words. The library also supports pre and post processing of rules using custom rule processors.

## Usage

Set a language
```js
const language = 'en_UK'; 
```

Create a new instance of the `TrieWordStepper` class and load the dictionary for the language you want to translate:

```javascript
const trieWord = new TrieWordStepper();
trieWord.loadDictionary(language);
```

The TrieOrthographySteppers provide rules for generating phonetics where there may be gaps in an IPA dictionary
You can then create a new instance of the `TrieOrthographyStepper` class and add it as an orthography stepper to the `TrieWordStepper` instance:

```javascript
const trieOrthography = new TrieOrthographyStepper();
trieOrthography.loadDictionary(language);
trieWord.addOrthographyStepper(trieOrthography);
```

You can add custom rule processors to the `TrieOrthographyStepper` instance:

```javascript
trieOrthography.addRulePreprocessor(language);
trieOrthography.addRulePostprocessor(language);
```

Finally, you can translate a piece of text using the `translateText` method of the `TrieWordStepper` instance:

```javascript
const text = 'Hello world!';
const result = trieWord.translateText(text);
console.log(result); // həˈloʊ wɔrld!
```

## License

The IPA Transliterator is released under the MIT License. See the LICENSE file for details.

## Epitran

The orthography stepper uses rules and processes heavily borrowed from Epitran https://github.com/dmort27/epitran

## Other Resources

Berklee Resources:
https://guides.library.berklee.edu/c.php?g=890821

Choral Public Domain Library
https://www.cpdl.org/wiki/index.php/Main_Page
https://www.cpdl.org/wiki/index.php/Category:Works_by_language

ToPhonetics
https://tophonetics.com/

Lieder.net
https://www.lieder.net/

Translation site
https://easypronunciation.com/


