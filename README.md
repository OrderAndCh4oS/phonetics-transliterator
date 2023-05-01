# International Phonetic Alphabet (IPA) Transliterator

The IPA Transliterator is a JavaScript library that translates text to the International Phonetic Alphabet (IPA) using a set of phonological rules and a dictionary of words. The library uses a trie data structure to efficiently search for words in the dictionary and apply phonological rules to the words. The library also supports pre- and post-processing of rules using custom rule processors.

## Usage

To use the IPA Transliterator, include the `ipa.js` file in your HTML file:

```html
<script src="ipa.js"></script>
```

Then, create a new instance of the `TrieWordStepper` class and load the dictionary for the language you want to translate:

```javascript
const trieWord = new TrieWordStepper();
trieWord.loadDictionary('en');
```

You can then create a new instance of the `TrieOrthographyStepper` class and add it as an orthography stepper to the `TrieWordStepper` instance:

```javascript
const trieOrthography = new TrieOrthographyStepper();
trieOrthography.loadDictionary('en');
trieWord.addOrthographyStepper(trieOrthography);
```

You can also add custom rule processors to the `TrieOrthographyStepper` instance:

```javascript
const ruleProcessor = new RuleProcessor();
trieOrthography.addRulePreprocessor(ruleProcessor);
trieOrthography.addRulePostprocessor(ruleProcessor);
```

Finally, you can translate a piece of text using the `translateText` method of the `TrieWordStepper` instance:

```javascript
const text = 'Hello world!';
const result = trieWord.translateText(text);
console.log(result); // həˈloʊ wɔrld
```

## License

The IPA Transliterator is released under the MIT License. See the LICENSE file for details.

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
