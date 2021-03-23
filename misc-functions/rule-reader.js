const {readFileSync} = require('fs');

const charGroupRegex = /^::[\p{L}\p{M}_]+?::\s+?=\s+?[\p{L}\p{M}|]+/gmu;
const ruleRegex = /^[\p{L}\p{M}\[\]|]+?\s+->\s+[\p{L}\p{M}<>0]+\s+\/\s+.*?$/gmu;

function loadRuleFile(languageCode) {
    let response = readFileSync(`../processors/rules/preprocessors/${languageCode}.txt`, 'UTF-8');
    const charGroups = response.match(charGroupRegex).reduce((obj, m) => {
        const [key, value] = m.split(/\s+=\s+/);
        return {...obj, [key]: value}
    }, {})
    const rules = response.match(ruleRegex)
    return {charGroups, rules};
}

const {charGroups,rules} = loadRuleFile('de')

console.log(Object.entries(charGroups).map(cg => cg[0]+' = '+cg[1]).join('\n'));
console.log(rules.join('\n'));
// console.log(loadRuleFile('fr'));
