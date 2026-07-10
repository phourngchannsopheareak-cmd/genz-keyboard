import Foundation

/// Native port of the rule-based speller (src/spell.js). Keep the two in step:
/// every table and weight here mirrors that file.
///
/// The dictionary can only type words someone already added. This spells ANY
/// romanized word from Khmer orthography rules, so `pteah` -> ផ្ទះ even if it
/// was never in dictionary.json.
///
/// Khmer writes each consonant sound twice, once in the a-series and once in
/// the o-series (t = ត or ទ). Romanized text throws that distinction away, so
/// the rules genuinely cannot know which was meant. `spell` returns the 2-3
/// most likely spellings; the user taps one and it is saved.
enum Speller {

    private static let coeng = "្"   // combining subscript marker
    private static let bantoc = "់"  // shortens the vowel

    private struct Cons {
        let kh: String
        let series: String
        let weight: Double
    }

    // MARK: - Tables

    private static let cons: [String: [Cons]] = [
        "chh": [Cons(kh: "ឆ", series: "a", weight: 3), Cons(kh: "ឈ", series: "o", weight: 1)],
        "kh": [Cons(kh: "ខ", series: "a", weight: 3), Cons(kh: "ឃ", series: "o", weight: 1)],
        "ch": [Cons(kh: "ច", series: "a", weight: 3), Cons(kh: "ជ", series: "o", weight: 2), Cons(kh: "ឆ", series: "a", weight: 1)],
        "ny": [Cons(kh: "ញ", series: "o", weight: 3)],
        "th": [Cons(kh: "ថ", series: "a", weight: 3), Cons(kh: "ធ", series: "o", weight: 1)],
        "ph": [Cons(kh: "ផ", series: "a", weight: 3), Cons(kh: "ភ", series: "o", weight: 1)],
        "ng": [Cons(kh: "ង", series: "o", weight: 3)],
        "nh": [Cons(kh: "ញ", series: "o", weight: 3)],
        "k": [Cons(kh: "ក", series: "a", weight: 3), Cons(kh: "គ", series: "o", weight: 2)],
        "g": [Cons(kh: "គ", series: "o", weight: 3)],
        "j": [Cons(kh: "ជ", series: "o", weight: 3), Cons(kh: "ច", series: "a", weight: 1)],
        "d": [Cons(kh: "ដ", series: "a", weight: 3), Cons(kh: "ឌ", series: "o", weight: 1)],
        "t": [Cons(kh: "ត", series: "a", weight: 3), Cons(kh: "ទ", series: "o", weight: 2)],
        "n": [Cons(kh: "ន", series: "o", weight: 3), Cons(kh: "ណ", series: "a", weight: 1)],
        "b": [Cons(kh: "ប", series: "a", weight: 3)],
        "p": [Cons(kh: "ព", series: "o", weight: 3), Cons(kh: "ប", series: "a", weight: 2), Cons(kh: "ផ", series: "a", weight: 1)],
        "m": [Cons(kh: "ម", series: "o", weight: 3)],
        "y": [Cons(kh: "យ", series: "o", weight: 3)],
        "r": [Cons(kh: "រ", series: "o", weight: 3)],
        "l": [Cons(kh: "ល", series: "o", weight: 3), Cons(kh: "ឡ", series: "a", weight: 1)],
        "v": [Cons(kh: "វ", series: "o", weight: 3)],
        "w": [Cons(kh: "វ", series: "o", weight: 3)],
        "s": [Cons(kh: "ស", series: "a", weight: 3)],
        "h": [Cons(kh: "ហ", series: "a", weight: 3)],
        "f": [Cons(kh: "ហ្វ", series: "a", weight: 3)],
        "z": [Cons(kh: "ហ្ស", series: "a", weight: 3)],
        "q": [Cons(kh: "ក", series: "a", weight: 1)],
        "x": [Cons(kh: "ស", series: "a", weight: 1)],
        "c": [Cons(kh: "ក", series: "a", weight: 1)],
    ]

    /// These sonorants keep the FIRST consonant's a-series when they sit below
    /// it. ស្រ stays a-series (srei = ស្រី), but ផ្ទ flips to o (pteah = ផ្ទះ).
    private static let sonorant: Set<String> = ["ង", "ញ", "ន", "ម", "យ", "រ", "ល", "វ"]

    /// rom -> (a-series signs, o-series signs). The same sign sounds different
    /// per series, so a romanization is only reachable from the series that
    /// actually produces that sound. "" is the inherent vowel.
    private static let vowel: [String: (a: [String], o: [String])] = [
        "": (["" ], ["" ]),
        // No o-series sign sounds like plain "a", so an "a" forces the
        // a-series letter (srolanh -> ស្រឡាញ់, nas -> ណាស់).
        "a": (["ា", ""], []),
        "aa": (["ា"], []),
        "ea": ([], ["ា"]),
        "e": (["េ", "ែ", "ិ", "ឹ"], ["េ", "ិ", "ឹ"]),
        "ee": ([], ["ី", "េ"]),
        "i": (["ិ"], ["ិ", "ី"]),
        "ii": ([], ["ី"]),
        "ei": (["ី"], []),
        "ey": (["ី"], ["ៃ"]),
        "oe": (["ឹ"], []),
        "eu": (["ឺ", "ើ"], ["ើ", "ឺ", "ឹ"]),
        // Both inherent vowels already sound like "o" (bong = បង, pong = ពង់),
        // but the long one is written ូ (kon = កូន, toch = តូច).
        "o": (["", "ុ", "ូ"], ["", "ុ", "ូ", "ោ"]),
        "oa": ([], ["ា"]),
        "or": (["ោ", ""], ["ូ", ""]),
        "er": (["ើ"], ["ើ"]),
        "eur": (["ើ"], ["ើ"]),
        "ur": (["ូ"], ["ូ"]),
        // An o-series inherent vowel closed by ់ reads "u" (yub = យប់).
        "u": (["ុ"], ["ុ", "ូ", ""]),
        "uu": ([], ["ូ"]),
        "ue": (["ួ"], ["ួ"]),
        "oue": (["ួ"], ["ួ"]),
        "ou": (["ូ", "ួ"], ["ៅ", "ូ"]),
        "oo": ([], ["ូ", "ោ"]),
        "uo": (["ួ"], ["ួ"]),
        "ua": (["ួ"], ["ួ"]),
        "ae": (["ែ", "ើ"], ["ែ"]),
        "aeu": (["ើ"], []),
        "oea": (["ឿ"], ["ឿ"]),
        "ie": (["ៀ"], ["ា", "ៀ"]),
        "ia": (["ៀ"], ["ា", "ៀ"]),
        "ai": (["ៃ"], []),
        "ay": (["ៃ"], []),
        "ao": (["ោ"], []),
        "au": (["ៅ", "ោ"], []),
        "aw": (["ៅ"], []),
        "ov": ([], ["ៅ"]),
        "oy": (["ូ"], []),
    ]

    /// Vowel + final m/h fuse into one written unit.
    private static let fused: [String: (a: [String], o: [String])] = [
        "am": (["ំ", "ាំ"], ["ាំ"]),
        "aam": (["ាំ"], []),
        "oam": ([], ["ាំ"]),
        "eam": ([], ["ាំ"]),
        "om": (["ុំ"], ["ំ", "ុំ"]),
        "um": ([], ["ុំ", "ំ"]),
        "im": (["ិម"], ["ិម"]),
        "ah": (["ះ"], []),
        "eah": ([], ["ះ"]),
        "oh": (["ុះ"], []),
        "uh": ([], ["ុះ", "ោះ"]),
        "eh": (["េះ"], []),
        "ih": ([], ["េះ"]),
        "aoh": (["ោះ"], []),
        "oih": (["ោះ"], []),
    ]

    /// Khmerlish often writes the ះ ending with a final "s" (pteas = ផ្ទះ,
    /// nis = នេះ). A real final ស exists too, so these are offered alongside
    /// the plain-coda spelling. "as"/"os" are usually a true ស់ (ណាស់, អស់).
    private static let fusedS: [String: (a: [String], o: [String], bonus: Double)] = [
        "as": (["ះ"], [], 0.2),
        "eas": ([], ["ះ"], 1.6),
        "is": (["េះ"], ["េះ"], 1.6),
        "es": (["េះ"], ["េះ"], 1.2),
        "os": (["ុះ"], [], 0.2),
        "us": ([], ["ុះ"], 1.2),
        "ous": (["ោះ"], ["ោះ"], 1.4),
        "oas": (["ោះ"], ["ោះ"], 1.4),
    ]

    /// A `p` or `ch` heading a cluster is the aspirated letter (pteah = ផ្ទះ,
    /// chhma = ឆ្មា), except before `r` (preah = ព្រះ, chraen = ច្រើន).
    private static func clusterBase(_ unit: String, _ next: String?) -> [String: Double]? {
        if next == "r" { return nil }
        if unit == "p" { return ["ផ": 2.5] }
        if unit == "ch" { return ["ឆ": 2.5] }
        return nil
    }

    /// Word-final "am" is ាំ (chnam = ឆ្នាំ); inside a word it is ំ (កំពង់).
    private static let fusedLast: [String: (a: [String], o: [String])] = [
        "am": (["ាំ", "ំ"], ["ាំ"])
    ]

    /// Coda consonants. A final sound can be spelled with either series'
    /// letter (bat = បាទ, but dak = ដាក់).
    private static let coda: [String: [(String, Double)]] = [
        "ng": [("ង", 3)], "nh": [("ញ", 3)], "ch": [("ច", 3)], "kh": [("ខ", 3)],
        "th": [("ថ", 3)], "ph": [("ប", 3)],
        "k": [("ក", 3), ("ខ", 2), ("គ", 1)],
        "g": [("ង", 2), ("ក", 2)],
        "n": [("ន", 3), ("ណ", 1)],
        "m": [("ម", 3)], "y": [("យ", 3)], "l": [("ល", 3)], "s": [("ស", 3)],
        "t": [("ត", 3), ("ទ", 2)],
        "d": [("ត", 2), ("ដ", 1)],
        "p": [("ប", 3), ("ព", 1)],
        "b": [("ប", 3)], "r": [("រ", 3)], "j": [("ច", 2)], "c": [("ក", 2)],
        "v": [("វ", 3)], "w": [("វ", 3)], "x": [("ស", 2)],
    ]

    /// ់ only ever shortens the inherent vowel or ា.
    private static let bantocVowels: Set<String> = ["", "ា"]

    private static let bantocBias: [String: Double] = [
        "ស": 1.0, "ង": 0.8, "ញ": 0.8, "ក": 0.2, "ប": 0.2, "ត": 0.0,
        "ច": 0.0, "យ": -0.2, "ន": -0.4, "ម": -0.8, "ល": -0.4, "រ": -0.8, "វ": -0.4,
    ]

    /// Clusters Khmer allows to start a syllable.
    private static let legalOnsets: Set<String> = [
        "kr", "kl", "kn", "kh", "khl", "khn", "khm", "chr", "chn", "chm",
        "thn", "thm", "phn", "phl", "phs", "pt", "pd", "pn", "pl", "pr",
        "sd", "st", "sr", "sl", "sm", "sn", "sk", "sb", "sp", "sv",
        "tr", "dr", "br", "bl", "mr", "ml", "mn", "vr", "gn", "jr", "nh",
        "ng", "ch", "th", "ph", "chh", "kt", "tv", "dt",
    ]

    private static let consKeys: [String] = cons.keys.sorted { $0.count > $1.count }
    private static let vowelChars: Set<Character> = ["a", "e", "i", "o", "u"]

    /// Every single-scalar base consonant, for testing whether a partial
    /// spelling ends on something a subscript can hang under.
    private static let khCons: Set<String> = Set(
        cons.values.flatMap { $0 }.map { $0.kh }.filter { $0.unicodeScalars.count == 1 }
    )

    // MARK: - Segmentation

    /// Split a consonant run into its roman units ("chh"/"kh" before "c"/"h").
    private static func splitCons(_ run: String) -> [String]? {
        var out: [String] = []
        var rest = Substring(run)
        while !rest.isEmpty {
            guard let hit = consKeys.first(where: { rest.hasPrefix($0) }) else { return nil }
            out.append(hit)
            rest = rest.dropFirst(hit.count)
        }
        return out
    }

    private struct Run {
        let isVowel: Bool
        var text: String
    }

    private static func runs(_ word: String) -> [Run] {
        var out: [Run] = []
        for ch in word {
            let isV = vowelChars.contains(ch)
            if var last = out.last, last.isVowel == isV {
                last.text.append(ch)
                out[out.count - 1] = last
            } else {
                out.append(Run(isVowel: isV, text: String(ch)))
            }
        }
        return out
    }

    private struct Syllable {
        var onset: String
        var vowel: String
        var coda: String
    }

    /// A medial consonant run hands the next syllable the longest legal onset
    /// it can take: `kr` is legal so akrok splits a-krok, `mp` is not so
    /// kampong splits kam-pong.
    private static func syllabify(_ word: String) -> [Syllable]? {
        var parts = runs(word.lowercased())
        guard !parts.isEmpty else { return nil }

        var sylls: [Syllable] = []
        var onset = ""

        var i = 0
        while i < parts.count {
            let part = parts[i]
            if !part.isVowel {
                if i == parts.count - 1 {
                    if sylls.isEmpty { return nil }
                    sylls[sylls.count - 1].coda = part.text
                    onset = ""
                } else {
                    onset = part.text
                }
                i += 1
                continue
            }

            var coda = ""
            if i + 1 < parts.count - 1, !parts[i + 1].isVowel {
                guard let units = splitCons(parts[i + 1].text) else { return nil }
                var take = units.count
                while take > 1 && !legalOnsets.contains(units.suffix(take).joined()) { take -= 1 }
                coda = units.prefix(units.count - take).joined()
                parts[i + 1].text = units.suffix(take).joined()
            }

            sylls.append(Syllable(onset: onset, vowel: part.text, coda: coda))
            onset = ""
            i += 1
        }

        return sylls.isEmpty ? nil : sylls
    }

    // MARK: - Spelling

    private struct Onset {
        let text: String
        let series: String
        let score: Double
    }

    private struct Candidate {
        let text: String
        let score: Double
    }

    /// Build the written onset and work out which series governs the vowel.
    /// `sub` writes the whole onset as subscripts, hanging under the previous
    /// syllable's final consonant (angkor -> អ + ង + ្គ + រ).
    private static func onsetForms(_ romOnset: String, sub: Bool) -> [Onset] {
        if romOnset.isEmpty {
            return sub ? [] : [Onset(text: "អ", series: "a", score: 0)]
        }
        guard let units = splitCons(romOnset) else { return [] }

        // Scores are penalties (best option = 0) so a longer spelling never
        // outranks a shorter one just by collecting more positive weight.
        var combos: [(letters: [Cons], score: Double)] = [([], 0)]
        for (u, unit) in units.enumerated() {
            guard let options = cons[unit] else { return [] }
            let heading = u == 0 && units.count > 1
            let bonus = heading ? (clusterBase(unit, units.count > 1 ? units[1] : nil) ?? [:]) : [:]
            let best = options.map { $0.weight + (bonus[$0.kh] ?? 0) }.max() ?? 1
            var next: [(letters: [Cons], score: Double)] = []
            for combo in combos {
                for opt in options {
                    let w = opt.weight + (bonus[opt.kh] ?? 0)
                    next.append((combo.letters + [opt], combo.score + log(w / best)))
                }
            }
            combos = Array(next.sorted { $0.score > $1.score }.prefix(6))
        }

        return combos.map { combo in
            let letters = combo.letters
            let base = letters[0]
            let text = sub
                ? letters.map { coeng + $0.kh }.joined()
                : base.kh + letters.dropFirst().map { coeng + $0.kh }.joined()
            // The last consonant governs the series, unless it is a sonorant
            // sitting under an a-series base, which keeps the base's series.
            let last = letters[letters.count - 1]
            var series = last.series
            if letters.count > 1 && sonorant.contains(last.kh) && base.series == "a" {
                series = "a"
            }
            return Onset(text: text, series: series, score: combo.score)
        }
    }

    private struct Split {
        let vowel: String
        let units: [String]
        let bonus: Double
    }

    /// `r`, `y` and `w` after a vowel may spell part of the vowel (ber -> បើ)
    /// or a real final consonant (bay -> បាយ), so both readings are offered.
    private static func vowelCodaSplits(_ rawVowel: String, _ rawCoda: String) -> [Split]? {
        var unitList: [String] = []
        if !rawCoda.isEmpty {
            guard let parsed = splitCons(rawCoda) else { return nil }
            unitList = parsed
        }

        var splits = [Split(vowel: rawVowel, units: unitList, bonus: 0)]
        var v = rawVowel
        var rest = unitList
        while let head = rest.first, vowel[v + head] != nil {
            v += head
            rest = Array(rest.dropFirst())
            splits.append(Split(vowel: v, units: rest, bonus: 0.15))
        }
        return splits
    }

    /// An unlisted vowel run (proue) falls back to its longest known prefix.
    private static func vowelTable(_ v: String) -> (a: [String], o: [String]) {
        if let hit = vowel[v] { return hit }
        var n = v.count - 1
        while n >= 1 {
            let prefix = String(v.prefix(n))
            if let hit = vowel[prefix] { return hit }
            n -= 1
        }
        return ([], [])
    }

    private static func spellSyllable(_ syl: Syllable, sub: Bool, isLast: Bool) -> [Candidate] {
        let onsets = onsetForms(syl.onset, sub: sub)
        guard !onsets.isEmpty else { return [] }
        guard let splits = vowelCodaSplits(syl.vowel, syl.coda) else { return [] }

        var out: [Candidate] = []
        for on in onsets {
            for split in splits {
                spellOne(&out, on, split, isLast: isLast, relax: false)
            }
        }

        // The series rules can legitimately rule out every spelling. Rather
        // than give up, relax the series and take the penalty.
        if out.isEmpty {
            for on in onsets {
                for split in splits {
                    spellOne(&out, on, split, isLast: isLast, relax: true)
                }
            }
        }

        return Array(out.sorted { $0.score > $1.score }.prefix(8))
    }

    private static func spellOne(
        _ out: inout [Candidate], _ on: Onset, _ split: Split, isLast: Bool, relax: Bool
    ) {
        let v = split.vowel
        let base = on.score + split.bonus - (relax ? 1.5 : 0)
        let codaUnit = split.units.last ?? ""

        // A vowel plus a final m or h fuses into one written unit (kom -> កុំ).
        var fusedHit = fused[v + codaUnit]
        if isLast, let final = fusedLast[v + codaUnit] { fusedHit = final }
        if let hit = fusedHit {
            let fusedSigns = on.series == "a" ? hit.a : hit.o
            for (i, sign) in fusedSigns.enumerated() {
                out.append(Candidate(text: on.text + sign, score: base + 1.2 - Double(i) * 0.5))
            }
        }
        if let hit = fusedS[v + codaUnit] {
            let sSigns = on.series == "a" ? hit.a : hit.o
            for sign in sSigns {
                out.append(Candidate(text: on.text + sign, score: base + hit.bonus))
            }
        }

        // A trailing h is often just a long-vowel marker, not ះ (ah -> អា).
        let bare = codaUnit == "h" ? "" : codaUnit
        let table = vowelTable(v)
        let signs: [String]
        if relax {
            var seen = Set<String>()
            signs = (table.a + table.o).filter { seen.insert($0).inserted }
        } else {
            signs = on.series == "a" ? table.a : table.o
        }

        for (vi, sign) in signs.enumerated() {
            let vScore = base - Double(vi) * 0.7
            if bare.isEmpty {
                out.append(Candidate(text: on.text + sign, score: vScore - (codaUnit == "h" ? 0.9 : 0)))
                continue
            }
            let codas = coda[bare] ?? []
            let bestCoda = codas.map { $0.1 }.max() ?? 1
            for (codaKh, codaWeight) in codas {
                let stem = on.text + sign + codaKh
                let cScore = vScore + log(codaWeight / bestCoda)
                out.append(Candidate(text: stem, score: cScore))
                // ់ shortens the inherent vowel or ា, and almost always sits
                // on the last syllable (angkor is អង្គរ, never អាង់កោ).
                if bantocVowels.contains(sign) {
                    let bias = (bantocBias[codaKh] ?? 0) - (isLast ? 0 : 2.0)
                    out.append(Candidate(text: stem + bantoc, score: cScore + bias))
                }
            }
        }
    }

    // MARK: - Public API

    /// spell("pteah") -> ["ផ្ទះ", ...] best first, deduped.
    static func spell(_ word: String, limit: Int = 3) -> [String] {
        guard !word.isEmpty,
              word.range(of: "^[a-zA-Z]+$", options: .regularExpression) != nil,
              let sylls = syllabify(word) else { return [] }

        var beam = [Candidate(text: "", score: 0)]
        for (s, syl) in sylls.enumerated() {
            let isLast = s == sylls.count - 1
            let plain = spellSyllable(syl, sub: false, isLast: isLast)
            // Inside a word, a syllable's onset may instead hang as a subscript
            // under the previous syllable's final consonant (angkor -> អង្គរ).
            let subbed = (s > 0 && !syl.onset.isEmpty)
                ? spellSyllable(syl, sub: true, isLast: isLast) : []
            if plain.isEmpty && subbed.isEmpty { return [] }

            var next: [Candidate] = []
            for partial in beam {
                for opt in plain {
                    next.append(Candidate(text: partial.text + opt.text, score: partial.score + opt.score))
                }
                let endsOnConsonant = partial.text.unicodeScalars.last.map {
                    khCons.contains(String($0))
                } ?? false
                if !subbed.isEmpty && endsOnConsonant {
                    for opt in subbed {
                        next.append(Candidate(text: partial.text + opt.text, score: partial.score + opt.score - 0.6))
                    }
                }
            }
            if next.isEmpty { return [] }
            beam = Array(next.sorted { $0.score > $1.score }.prefix(14))
        }

        var seen = Set<String>()
        var out: [String] = []
        for cand in beam where seen.insert(cand.text).inserted {
            out.append(cand.text)
            if out.count >= limit { break }
        }
        return out
    }
}
