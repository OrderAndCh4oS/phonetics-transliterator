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
            this._prefix = this._prefix.replace(charGroupRegex, value)
                .replace(/#/u, '^');
            this._suffix = this._suffix?.replace(charGroupRegex, value)
                .replace(/#/u, '$') || '';
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
        return new RegExp(`(${this._prefix})(${this._toReplace})(${this._suffix})`, 'u');
    }

    apply(word) {
        return word.replace(this.regex, (_m, a, _b, c) => a + this._replacement + c);
    }
}

class RuleProcessor {
    _rules = [];
    _charGroups;

    constructor(charGroups) {
        this._charGroups = charGroups;
    }

    addRule(rule) {
        this._rules.push(new Rule(rule, charGroups));
    }

    process(word) {
        return this._rules.reduce((w, r) => r.apply(w), word)
    }
}

const charGroups = {
    '::vowel::': 'a|ä|e|i|o|ö|u|ü',
    '::consonant::': 'b|c|ch|ck|d|dt|f|g|h|j|k|l|m|n|p|pf|r|s|sch|t|tsch|tz|tzsch|v|w|z|ʀ',
};

const rules = [
    't -> z / _ ion',
    's -> sch / # _ (p|t)',
    's -> <zed> / # _ (::vowel::)',
    'b -> p / _ #|(::consonant::)(::vowel::)',
    'd -> t / _ #|(::consonant::)(::vowel::)',
    'g -> k / _ #|(::consonant::)(::vowel::)',
    'r -> 0 / e _ #',
    'r -> ə / [äeioöuü]h? _ #|(::consonant::)',
    'r -> 0 / a _ #|(::consonant::)',
    'e -> ə / _ #',
    'i -> ie /  _ #|(::consonant::)(::vowel::)',
    'e -> ee / [^ei] _ #|(::consonant::)(::vowel::)',
    'ü -> üh /  _ #|(::consonant::)(::vowel::)',
    'ö -> öo /  _ #|(::consonant::)(::vowel::)',
    'u -> uh /  [^e]_ #|(::consonant::)(::vowel::)',
    'o -> oo / [^oö] _ #|(::consonant::)(::vowel::)',
    'a -> aa / [^a] _ #|(::consonant::)(::vowel::)',
];

const ruleProcessor = new RuleProcessor(charGroups);

for(const rule of rules) {
    ruleProcessor.addRule(rule);
}

const words = [
    'bastion',
    'station',
];

console.log(words.map(word => ruleProcessor.process(word)));
