import Foundation

/// Native port of the web converter (src/converter.js) and suggestion engine
/// (src/suggest.js). The dictionary ships as dictionary.json in the bundle's
/// Web/ folder (copied there by CI from src/dictionary.json).
///
/// Spelling of unknown words lives in Speller.swift (a port of src/spell.js).
final class Engine {

    static let shared = Engine()

    private(set) var dict: [String: String] = [:]

    // Learned ranking, stored on-device.
    private var picks: [String: String]
    private var words: [String: Int]
    /// Words the user taught by tapping a spelling chip. Merged over the
    /// bundled dictionary, so a word only ever has to be spelled once.
    private var custom: [String: String]
    private let defaults = UserDefaults.standard

    /// The dictionary bucketed by first letter. suggest() runs on every
    /// keystroke, and scanning all 1000+ entries three times per tap is the
    /// difference between keeping up with fast typing and lagging behind it;
    /// a prefix can only match keys that start with its own first letter.
    private var buckets: [Character: [(key: String, khmer: String)]] = [:]

    private init() {
        picks = (defaults.dictionary(forKey: "genz-picks") as? [String: String]) ?? [:]
        words = (defaults.dictionary(forKey: "genz-words") as? [String: Int]) ?? [:]
        custom = (defaults.dictionary(forKey: "genz-custom") as? [String: String]) ?? [:]
        if let url = Bundle.main.url(forResource: "dictionary", withExtension: "json", subdirectory: "Web"),
           let data = try? Data(contentsOf: url),
           let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: String] {
            dict = obj
        }
        dict.merge(custom) { _, mine in mine }
        for (k, v) in dict {
            if let f = k.first { buckets[f, default: []].append((k, v)) }
        }
    }

    // MARK: - Conversion

    private static let peelPrefixes = ["mish", "kom", "min", "nov", "hx", "ot", "jg", "nv"]

    private static let digraphs: [(String, String)] = [
        ("khm", "ខ្ម"), ("chh", "ឆ"),
        ("kh", "ខ"), ("ch", "ច"), ("th", "ថ"), ("ph", "ផ"),
        ("ng", "ង"), ("nh", "ញ"), ("sr", "ស្រ"), ("kr", "ក្រ"),
        ("pr", "ព្រ"), ("tr", "ត្រ"), ("kl", "ក្ល"), ("pl", "ផ្ល"),
        ("aa", "ា"), ("ae", "ែ"), ("ai", "ៃ"), ("ao", "ោ"), ("au", "ៅ"),
        ("ea", "ា"), ("ei", "ី"), ("eu", "ឺ"), ("ie", "ៀ"), ("ou", "ូ"), ("oo", "ូ"),
    ]

    private static let letters: [Character: String] = [
        "a": "ា", "b": "ប", "c": "ច", "d": "ដ", "e": "េ", "f": "ហ្វ",
        "g": "គ", "h": "ហ", "i": "ិ", "j": "ជ", "k": "ក", "l": "ល",
        "m": "ម", "n": "ន", "o": "ោ", "p": "ព", "q": "ក", "r": "រ",
        "s": "ស", "t": "ត", "u": "ុ", "v": "វ", "w": "វ", "x": "ស",
        "y": "យ", "z": "ហ្ស",
    ]

    private static let vowelSigns: Set<String> = ["ា", "េ", "ែ", "ៃ", "ោ", "ៅ", "ី", "ិ", "ឺ", "ុ", "ូ", "ៀ"]

    private func lookup(_ word: String) -> String? {
        return dict[word.lowercased()]
    }

    private func peel(_ word: String, depth: Int = 0) -> String? {
        if depth > 3 { return nil }
        let lower = word.lowercased()
        for prefix in Engine.peelPrefixes {
            guard lower.hasPrefix(prefix), lower.count > prefix.count,
                  let head = lookup(prefix) else { continue }
            let rest = String(lower.dropFirst(prefix.count))
            if let tail = lookup(rest) { return head + tail }
            if let deeper = peel(rest, depth: depth + 1) { return head + deeper }
        }
        return nil
    }

    func guess(_ word: String) -> String {
        var remain = Substring(word.lowercased())
        var out = ""
        while let first = remain.first {
            var kh: String? = nil
            var used = 1
            for (rom, k) in Engine.digraphs {
                if remain.hasPrefix(rom) {
                    kh = k
                    used = rom.count
                    break
                }
            }
            if kh == nil {
                kh = Engine.letters[first] ?? String(first)
            }
            if let k = kh {
                if out.isEmpty && Engine.vowelSigns.contains(k) { out += "អ" }
                out += k
            }
            remain = remain.dropFirst(used)
        }
        return out
    }

    /// Converts a whole romanized string to Khmer (text only).
    func convert(_ input: String) -> String {
        let parts = input.split(separator: " ").map(String.init)
        var out = ""
        var i = 0
        while i < parts.count {
            var matched = false
            var len = min(4, parts.count - i)
            while len >= 1 {
                let key = parts[i..<(i + len)].joined(separator: " ").lowercased()
                if let hit = dict[key] {
                    out += hit
                    i += len
                    matched = true
                    break
                }
                len -= 1
            }
            if matched { continue }

            let word = parts[i]
            i += 1
            let isAlpha = word.range(of: "^[a-zA-Z']+$", options: .regularExpression) != nil
            if !isAlpha {
                if !out.isEmpty { out += " " }
                out += word
                continue
            }
            if let peeled = peel(word) {
                out += peeled
            } else {
                out += Speller.spell(word, limit: 1).first ?? guess(word)
            }
        }
        return out
    }

    // MARK: - Suggestions

    private static let freq: [String: Int] = [
        "ខ្ញុំ": 9, "ទៅ": 9, "នៅ": 8, "អត់": 8, "ចង់": 8, "ហើយ": 8,
        "ទេ": 8, "បាន": 7, "មាន": 7, "អី": 7, "បង": 7, "អូន": 7,
        "ញ៉ាំ": 7, "ស្រឡាញ់": 7, "គេ": 6, "យើង": 6, "មក": 6, "ដឹង": 6,
        "ណាស់": 6, "នេះ": 6, "ផ្ទះ": 5, "នឹក": 5, "ចាំ": 5, "ម៉ែ": 5,
        "ប៉ា": 5, "កុំ": 5, "មិន": 5, "ជា": 4, "ណា": 4, "ដែរ": 4,
        "ម៉េច": 6, "ហ្នឹង": 6, "មើល": 5, "អូខេ": 5, "ចូលចិត្ត": 5,
        "ដាក់": 4, "ស្ដាប់": 4,
    ]

    enum Kind {
        case match  // straight out of the dictionary
        case spell  // built from the orthography rules; tapping it teaches it
        case guess  // letter-by-letter fallback for a word with no vowel
    }

    struct Suggestion {
        let key: String
        let khmer: String
        let kind: Kind
        let replaceWords: Int

        /// Anything not from the dictionary is shown low-confidence (gold).
        var isGuess: Bool { kind != .match }
    }

    /// True for text the suggester can work with: lowercase words of a-z and
    /// apostrophes, single spaces between them. This runs per keystroke, so
    /// it is a character walk, not a regular expression (those recompile the
    /// pattern on every call).
    private static func isTypable(_ s: String) -> Bool {
        if s.isEmpty || s.hasPrefix(" ") || s.hasSuffix(" ") || s.contains("  ") { return false }
        for ch in s where !(ch == " " || ch == "'" || (ch >= "a" && ch <= "z")) {
            return false
        }
        return true
    }

    func suggest(_ context: String, limit: Int = 3) -> [Suggestion] {
        let ctx = context.lowercased().trimmingCharacters(in: .whitespaces)
        guard Engine.isTypable(ctx) else { return [] }
        let wordsArr = ctx.split(separator: " ").map(String.init)
        let maxN = min(3, wordsArr.count)

        var best: [String: (key: String, score: Int, n: Int)] = [:]
        for n in 1...maxN {
            let tail = wordsArr.suffix(n).joined(separator: " ")
            guard let first = tail.first else { continue }
            for (key, khmer) in buckets[first] ?? [] {
                if key != tail && !key.hasPrefix(tail) { continue }
                var score = 0
                if picks[tail] == khmer { score += 1000 }
                if key == tail { score += 500 }
                score += (n - 1) * 600
                score += (words[khmer] ?? 0) * 40
                score += (Engine.freq[khmer] ?? 0) * 10
                score += max(0, 20 - key.count)
                if let prev = best[khmer], prev.score >= score { continue }
                best[khmer] = (key, score, n)
            }
        }

        let ranked = best.sorted { $0.value.score > $1.value.score }.prefix(limit)
        var out = ranked.map {
            Suggestion(key: $0.value.key, khmer: $0.key, kind: .match, replaceWords: $0.value.n)
        }

        guard let last = wordsArr.last else { return out }

        // Top up the strip with rule-based spellings of the last word. Tapping
        // one teaches it, so a word only has to be spelled once. Skipped
        // entirely when the dictionary already filled the strip: the speller
        // is the most expensive step of a keystroke and its output would be
        // thrown away.
        if out.count < limit {
            var taken = Set(out.map { $0.khmer })
            for khmer in Speller.spell(last, limit: limit) {
                if out.count >= limit { break }
                guard taken.insert(khmer).inserted else { continue }
                out.append(Suggestion(key: last, khmer: khmer, kind: .spell, replaceWords: 1))
            }
        }

        // A word with no vowel at all (xyz) has no syllable to spell.
        if out.isEmpty {
            out = [Suggestion(key: last, khmer: guess(last), kind: .guess, replaceWords: 1)]
        }
        return out
    }

    /// Accepting a chip: record the pick, and save a spelling as a new word.
    func accept(typed: String, suggestion s: Suggestion) {
        let key = typed.lowercased()
        if s.kind == .guess { return }
        if s.kind == .spell, !key.isEmpty,
           key.allSatisfy({ $0 == "'" || ($0 >= "a" && $0 <= "z") }) {
            custom[key] = s.khmer
            let isNew = dict[key] == nil
            dict[key] = s.khmer
            if let f = key.first {
                if isNew {
                    buckets[f, default: []].append((key, s.khmer))
                } else if let idx = buckets[f]?.firstIndex(where: { $0.key == key }) {
                    buckets[f]?[idx].khmer = s.khmer
                }
            }
            defaults.set(custom, forKey: "genz-custom")
        }
        learn(typed: key, khmer: s.khmer)
    }

    func learn(typed: String, khmer: String) {
        picks[typed] = khmer
        words[khmer] = (words[khmer] ?? 0) + 1
        defaults.set(picks, forKey: "genz-picks")
        defaults.set(words, forKey: "genz-words")
    }

    /// The user's own saved words as JSON. The keyboard types this out on a
    /// space-bar long press, because a keyboard extension has no other way to
    /// hand data to the user (no shared files without an App Group, which
    /// free-cert sideloading does not sign reliably).
    func exportCustomJSON() -> String {
        if custom.isEmpty { return "{}" }
        let body = custom.sorted { $0.key < $1.key }
            .map { "  \"\($0.key)\": \"\($0.value)\"" }
            .joined(separator: ",\n")
        return "{\n\(body)\n}"
    }
}
