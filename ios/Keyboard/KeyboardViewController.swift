import UIKit

/// Fully native Genz Keyboard: an iPhone-style QWERTY that turns romanized
/// Khmerlish into Khmer script. No WebView (keyboard extensions have a strict
/// memory limit that kills WebView-based keyboards).
class KeyboardViewController: UIInputViewController {

    private let engine = Engine.shared

    private let letterRows = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m"],
    ]
    private let symbolRows = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "$", "&", "@", "'"],
        [".", ",", "?", "!", "\""],
    ]

    private var buffer = ""
    private var shiftOn = false
    private var symbolsOn = false
    private var currentSuggestions: [Engine.Suggestion] = []

    private let romanLabel = UILabel()
    private var chipButtons: [UIButton] = []
    private let rowsContainer = UIStackView()
    private var heightSet = false
    private var delayTimer: Timer?
    private var repeatTimer: Timer?

    // MARK: - Colors (light iPhone look by default, brand dark in dark mode)

    private var isDark: Bool { traitCollection.userInterfaceStyle == .dark }
    private var trayColor: UIColor { isDark ? UIColor(hex: 0x201D19) : UIColor(hex: 0xD1D4DB) }
    private var keyColor: UIColor { isDark ? UIColor(hex: 0x4A453D) : .white }
    private var keyTextColor: UIColor { isDark ? UIColor(hex: 0xF2EDE4) : UIColor(hex: 0x1C1C1E) }
    private var specialColor: UIColor { isDark ? UIColor(hex: 0x302C26) : UIColor(hex: 0xABAFBA) }
    private var mutedColor: UIColor { isDark ? UIColor(hex: 0x8A8578) : UIColor(hex: 0x6C6C70) }
    private var goldColor: UIColor { UIColor(hex: 0xE8A93D) }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        rebuildRows()
        refresh()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !heightSet {
            heightSet = true
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let c = view.heightAnchor.constraint(equalToConstant: isPad ? 330 : 272)
            c.priority = UILayoutPriority(999)
            c.isActive = true
        }
        applyColors()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        applyColors()
        rebuildRows()
        refresh()
    }

    // MARK: - UI construction

    private func buildUI() {
        view.backgroundColor = trayColor

        let root = UIStackView()
        root.axis = .vertical
        root.spacing = 6
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
            root.topAnchor.constraint(equalTo: view.topAnchor, constant: 4),
            root.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -6),
        ])

        // Prediction bar: typed roman on the left, Khmer chips filling the rest.
        let bar = UIStackView()
        bar.axis = .horizontal
        bar.spacing = 8
        bar.alignment = .center
        bar.heightAnchor.constraint(equalToConstant: 42).isActive = true

        romanLabel.font = UIFont.systemFont(ofSize: 13)
        romanLabel.setContentHuggingPriority(.required, for: .horizontal)
        romanLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        bar.addArrangedSubview(romanLabel)

        let chips = UIStackView()
        chips.axis = .horizontal
        chips.spacing = 2
        chips.distribution = .fillEqually
        for i in 0..<3 {
            let b = UIButton(type: .system)
            b.tag = i
            b.titleLabel?.font = UIFont.systemFont(ofSize: 20)
            b.layer.cornerRadius = 8
            b.addTarget(self, action: #selector(chipTapped(_:)), for: .touchDown)
            chipButtons.append(b)
            chips.addArrangedSubview(b)
        }
        bar.addArrangedSubview(chips)
        root.addArrangedSubview(bar)

        rowsContainer.axis = .vertical
        rowsContainer.spacing = 9
        rowsContainer.distribution = .fillEqually
        root.addArrangedSubview(rowsContainer)
    }

    private func keyButton(_ title: String, special: Bool = false) -> UIButton {
        let b = UIButton(type: .system)
        b.setTitle(title, for: .normal)
        b.titleLabel?.font = UIFont.systemFont(ofSize: special ? 17 : 22)
        b.backgroundColor = special ? specialColor : keyColor
        b.setTitleColor(keyTextColor, for: .normal)
        b.layer.cornerRadius = 6
        b.layer.shadowColor = UIColor.black.cgColor
        b.layer.shadowOpacity = isDark ? 0.5 : 0.28
        b.layer.shadowOffset = CGSize(width: 0, height: 1)
        b.layer.shadowRadius = 0
        b.addTarget(self, action: #selector(pressFeedbackDown(_:)), for: .touchDown)
        b.addTarget(self, action: #selector(pressFeedbackUp(_:)),
                    for: [.touchUpInside, .touchUpOutside, .touchCancel])
        return b
    }

    private func rebuildRows() {
        for v in rowsContainer.arrangedSubviews {
            rowsContainer.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
        let rows = symbolsOn ? symbolRows : letterRows

        // Row 1
        let r1 = UIStackView()
        r1.axis = .horizontal
        r1.spacing = 6
        r1.distribution = .fillEqually
        for k in rows[0] { r1.addArrangedSubview(letterKey(k)) }
        rowsContainer.addArrangedSubview(r1)

        // Row 2 (indented on the letters page, like iOS)
        let r2 = UIStackView()
        r2.axis = .horizontal
        r2.spacing = 6
        r2.distribution = .fillEqually
        r2.isLayoutMarginsRelativeArrangement = true
        if !symbolsOn {
            r2.layoutMargins = UIEdgeInsets(top: 0, left: 18, bottom: 0, right: 18)
        }
        for k in rows[1] { r2.addArrangedSubview(letterKey(k)) }
        rowsContainer.addArrangedSubview(r2)

        // Row 3: shift + letters + backspace
        let r3 = UIStackView()
        r3.axis = .horizontal
        r3.spacing = 6
        r3.distribution = .fill

        let shift = keyButton(shiftOn ? "⬆" : "⇧", special: true)
        if shiftOn {
            shift.backgroundColor = keyTextColor
            shift.setTitleColor(trayColor, for: .normal)
        }
        shift.addTarget(self, action: #selector(shiftTapped), for: .touchDown)
        shift.isEnabled = !symbolsOn
        shift.alpha = symbolsOn ? 0 : 1
        r3.addArrangedSubview(shift)

        var midKeys: [UIButton] = []
        for k in rows[2] {
            let b = letterKey(k)
            midKeys.append(b)
            r3.addArrangedSubview(b)
        }

        let bksp = keyButton("⌫", special: true)
        bksp.addTarget(self, action: #selector(backspaceDown), for: .touchDown)
        bksp.addTarget(self, action: #selector(backspaceUp),
                       for: [.touchUpInside, .touchUpOutside, .touchCancel])
        r3.addArrangedSubview(bksp)

        if let first = midKeys.first {
            for b in midKeys.dropFirst() {
                b.widthAnchor.constraint(equalTo: first.widthAnchor).isActive = true
            }
            shift.widthAnchor.constraint(equalTo: first.widthAnchor, multiplier: 1.35).isActive = true
            bksp.widthAnchor.constraint(equalTo: shift.widthAnchor).isActive = true
        }
        rowsContainer.addArrangedSubview(r3)

        // Row 4: 123 / globe / space / return
        let r4 = UIStackView()
        r4.axis = .horizontal
        r4.spacing = 6
        r4.distribution = .fill

        let mode = keyButton(symbolsOn ? "ABC" : "123", special: true)
        mode.addTarget(self, action: #selector(modeTapped), for: .touchDown)
        mode.widthAnchor.constraint(equalToConstant: 54).isActive = true
        r4.addArrangedSubview(mode)

        let globe = keyButton("🌐", special: true)
        globe.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        globe.widthAnchor.constraint(equalToConstant: 46).isActive = true
        r4.addArrangedSubview(globe)

        let space = keyButton("space", special: false)
        space.titleLabel?.font = UIFont.systemFont(ofSize: 15)
        space.setTitleColor(mutedColor, for: .normal)
        space.addTarget(self, action: #selector(spaceTapped), for: .touchDown)
        r4.addArrangedSubview(space)

        let ret = keyButton("⏎", special: false)
        ret.backgroundColor = goldColor
        ret.setTitleColor(UIColor(hex: 0x141312), for: .normal)
        ret.addTarget(self, action: #selector(returnTapped), for: .touchDown)
        ret.widthAnchor.constraint(equalToConstant: 66).isActive = true
        r4.addArrangedSubview(ret)

        rowsContainer.addArrangedSubview(r4)
    }

    private func letterKey(_ title: String) -> UIButton {
        let shown = (shiftOn && !symbolsOn) ? title.uppercased() : title
        let b = keyButton(shown, special: false)
        b.addTarget(self, action: #selector(charTapped(_:)), for: .touchDown)
        return b
    }

    private func applyColors() {
        view.backgroundColor = trayColor
        romanLabel.textColor = mutedColor
    }

    // MARK: - Press feedback

    @objc private func pressFeedbackDown(_ sender: UIButton) {
        sender.alpha = 0.6
    }

    @objc private func pressFeedbackUp(_ sender: UIButton) {
        UIView.animate(withDuration: 0.08) { sender.alpha = 1.0 }
    }

    // MARK: - Typing

    @objc private func charTapped(_ sender: UIButton) {
        guard var t = sender.currentTitle else { return }
        if shiftOn && !symbolsOn {
            shiftOn = false
            rebuildRows()
        } else {
            t = t.lowercased()
        }
        buffer += t
        refresh()
    }

    @objc private func shiftTapped() {
        shiftOn.toggle()
        rebuildRows()
    }

    @objc private func modeTapped() {
        symbolsOn.toggle()
        shiftOn = false
        rebuildRows()
    }

    @objc private func spaceTapped() {
        if buffer.isEmpty {
            textDocumentProxy.insertText(" ")
        } else {
            commitBuffer()
        }
    }

    @objc private func returnTapped() {
        commitBuffer()
        textDocumentProxy.insertText("\n")
    }

    @objc private func chipTapped(_ sender: UIButton) {
        let i = sender.tag
        guard i < currentSuggestions.count else { return }
        let s = currentSuggestions[i]
        textDocumentProxy.insertText(s.khmer)
        if !buffer.isEmpty {
            engine.accept(typed: buffer, suggestion: s)
        }
        buffer = ""
        refresh()
    }

    private func commitBuffer() {
        guard !buffer.isEmpty else { return }
        let khmer: String
        // Space accepts the top chip, whether it came from the dictionary or
        // from the speller. Only the letter-map fallback is not worth keeping.
        if let top = currentSuggestions.first, top.kind != .guess {
            khmer = top.khmer
            engine.accept(typed: buffer, suggestion: top)
        } else {
            khmer = engine.convert(buffer)
        }
        textDocumentProxy.insertText(khmer)
        buffer = ""
        refresh()
    }

    @objc private func backspaceDown() {
        doBackspace()
        delayTimer?.invalidate()
        delayTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            self?.repeatTimer = Timer.scheduledTimer(withTimeInterval: 0.06, repeats: true) { [weak self] _ in
                self?.doBackspace()
            }
        }
    }

    @objc private func backspaceUp() {
        delayTimer?.invalidate()
        repeatTimer?.invalidate()
    }

    private func doBackspace() {
        if !buffer.isEmpty {
            buffer.removeLast()
            refresh()
        } else {
            textDocumentProxy.deleteBackward()
        }
    }

    // MARK: - Prediction bar

    private func refresh() {
        romanLabel.text = buffer.isEmpty ? "វាយ Khmerlish…" : buffer
        currentSuggestions = engine.suggest(buffer)
        for (i, b) in chipButtons.enumerated() {
            if i < currentSuggestions.count {
                let s = currentSuggestions[i]
                b.isHidden = false
                b.setTitle(s.khmer, for: .normal)
                b.setTitleColor(s.isGuess ? goldColor : keyTextColor, for: .normal)
            } else {
                b.isHidden = true
                b.setTitle(nil, for: .normal)
            }
        }
    }
}

private extension UIColor {
    convenience init(hex: Int) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255.0,
            green: CGFloat((hex >> 8) & 0xFF) / 255.0,
            blue: CGFloat(hex & 0xFF) / 255.0,
            alpha: 1
        )
    }
}
