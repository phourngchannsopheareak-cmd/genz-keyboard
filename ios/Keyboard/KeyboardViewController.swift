import UIKit

/// Fully native Genz Keyboard: an iPhone-style QWERTY that turns romanized
/// Khmerlish into Khmer script. No WebView (keyboard extensions have a strict
/// memory limit that kills WebView-based keyboards).
///
/// The press feel deliberately copies the Apple keyboard:
/// - letter keys show a balloon with the tapped letter instead of dimming
/// - the gray function keys invert to white while pressed (and space inverts
///   to gray), snapping on touch and easing back on release
/// - every key plays the system keyboard click and a light haptic
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
    private var chipButtons: [KeyButton] = []
    private let chipsStack = UIStackView()
    private var chipSeparators: [UIView] = []
    private let rowsContainer = UIStackView()
    private var letterButtons: [KeyButton] = []
    private var shiftButton: KeyButton?
    private var heightSet = false
    private var delayTimer: Timer?
    private var repeatTimer: Timer?

    // The balloon that shows which letter is under the finger.
    private let popupView = UIView()
    private let popupLabel = UILabel()

    private let haptic = UIImpactFeedbackGenerator(style: .light)

    // MARK: - Colors (Apple keyboard palette, light and dark)

    private var isDark: Bool { traitCollection.userInterfaceStyle == .dark }
    private var trayColor: UIColor { isDark ? UIColor(hex: 0x212123) : UIColor(hex: 0xD1D4DB) }
    private var keyColor: UIColor { isDark ? UIColor(hex: 0x6B6B6E) : .white }
    private var specialColor: UIColor { isDark ? UIColor(hex: 0x464649) : UIColor(hex: 0xADB3BC) }
    private var keyTextColor: UIColor { isDark ? .white : .black }
    private var mutedColor: UIColor { isDark ? UIColor(white: 1, alpha: 0.55) : UIColor(hex: 0x6C6C70) }
    private var goldColor: UIColor { UIColor(hex: 0xE8A93D) }
    private var goldPressedColor: UIColor { UIColor(hex: 0xD3942C) }
    private var popupColor: UIColor { isDark ? UIColor(hex: 0x757579) : .white }
    private var separatorColor: UIColor { isDark ? UIColor(white: 1, alpha: 0.16) : UIColor(white: 0, alpha: 0.18) }
    private var chipFlashColor: UIColor { isDark ? UIColor(white: 1, alpha: 0.10) : UIColor(white: 0, alpha: 0.08) }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        rebuildRows()
        refresh()
        haptic.prepare()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !heightSet {
            heightSet = true
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            // Taller than a plain keyboard to fit the two-row candidate bar.
            let c = view.heightAnchor.constraint(equalToConstant: isPad ? 352 : 294)
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

    // MARK: - Click feel

    /// The system keyboard click plus a light tap. The click respects the
    /// user's Sound settings; the haptic needs Full Access and is silently
    /// skipped without it.
    private func clickFeedback() {
        UIDevice.current.playInputClick()
        haptic.impactOccurred()
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

        // Prediction bar: a slim line with the typed romanization, then the
        // Khmer candidates spread across the full width in even columns, like
        // the Apple keyboard's suggestion row.
        let bar = UIStackView()
        bar.axis = .vertical
        bar.spacing = 0
        bar.heightAnchor.constraint(equalToConstant: 64).isActive = true

        romanLabel.font = UIFont.systemFont(ofSize: 12)
        let composeRow = UIStackView(arrangedSubviews: [romanLabel])
        composeRow.isLayoutMarginsRelativeArrangement = true
        composeRow.layoutMargins = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        composeRow.heightAnchor.constraint(equalToConstant: 20).isActive = true
        bar.addArrangedSubview(composeRow)

        chipsStack.axis = .horizontal
        chipsStack.spacing = 0
        chipsStack.distribution = .fillEqually
        for i in 0..<3 {
            let b = KeyButton(frame: .zero)
            b.tag = i
            b.titleLabel?.font = UIFont.systemFont(ofSize: 25)
            // Long candidates (whole phrases) shrink to fit their column.
            b.titleLabel?.adjustsFontSizeToFitWidth = true
            b.titleLabel?.minimumScaleFactor = 0.5
            b.titleLabel?.lineBreakMode = .byClipping
            b.contentEdgeInsets = UIEdgeInsets(top: 0, left: 4, bottom: 0, right: 4)
            b.layer.cornerRadius = 6
            b.addTarget(self, action: #selector(chipTapped(_:)), for: .touchDown)
            chipButtons.append(b)
            chipsStack.addArrangedSubview(b)
        }
        bar.addArrangedSubview(chipsStack)
        root.addArrangedSubview(bar)

        // Thin vertical lines between the candidate columns (Apple style).
        for i in 0..<2 {
            let sep = UIView()
            sep.isUserInteractionEnabled = false
            sep.translatesAutoresizingMaskIntoConstraints = false
            chipsStack.addSubview(sep)
            NSLayoutConstraint.activate([
                sep.centerXAnchor.constraint(equalTo: chipButtons[i].trailingAnchor),
                sep.centerYAnchor.constraint(equalTo: chipsStack.centerYAnchor),
                sep.widthAnchor.constraint(equalToConstant: 0.5),
                sep.heightAnchor.constraint(equalTo: chipsStack.heightAnchor, multiplier: 0.55),
            ])
            chipSeparators.append(sep)
        }

        rowsContainer.axis = .vertical
        rowsContainer.spacing = 9
        rowsContainer.distribution = .fillEqually
        root.addArrangedSubview(rowsContainer)

        // The balloon sits above everything and never eats touches.
        popupView.isHidden = true
        popupView.isUserInteractionEnabled = false
        popupView.layer.cornerRadius = 11
        popupView.layer.shadowColor = UIColor.black.cgColor
        popupView.layer.shadowOpacity = 0.30
        popupView.layer.shadowOffset = CGSize(width: 0, height: 3)
        popupView.layer.shadowRadius = 8
        popupLabel.font = UIFont.systemFont(ofSize: 30)
        popupLabel.textAlignment = .center
        popupView.addSubview(popupLabel)
        view.addSubview(popupView)
    }

    private enum KeyStyle { case letter, special, space, send }

    private func keyButton(_ title: String, style: KeyStyle) -> KeyButton {
        let b = KeyButton(frame: .zero)
        b.setTitle(title, for: .normal)
        b.layer.cornerRadius = 5
        b.layer.shadowColor = UIColor.black.cgColor
        b.layer.shadowOpacity = isDark ? 0.5 : 0.3
        b.layer.shadowOffset = CGSize(width: 0, height: 1)
        b.layer.shadowRadius = 0
        switch style {
        case .letter:
            b.titleLabel?.font = UIFont.systemFont(ofSize: 23)
            b.baseColor = keyColor
            b.pressedColor = nil // the balloon is the press feedback
            b.setTitleColor(keyTextColor, for: .normal)
        case .special:
            b.titleLabel?.font = UIFont.systemFont(ofSize: 17)
            b.baseColor = specialColor
            b.pressedColor = keyColor // Apple invert
            b.setTitleColor(keyTextColor, for: .normal)
        case .space:
            b.titleLabel?.font = UIFont.systemFont(ofSize: 15)
            b.baseColor = keyColor
            b.pressedColor = specialColor // Apple invert
            b.setTitleColor(mutedColor, for: .normal)
        case .send:
            b.titleLabel?.font = UIFont.systemFont(ofSize: 17)
            b.baseColor = goldColor
            b.pressedColor = goldPressedColor
            b.setTitleColor(UIColor(hex: 0x141312), for: .normal)
        }
        return b
    }

    private func rebuildRows() {
        hidePopup()
        letterButtons = []
        shiftButton = nil
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

        let shift = keyButton("⇧", style: .special)
        shift.addTarget(self, action: #selector(shiftTapped), for: .touchDown)
        shift.isEnabled = !symbolsOn
        shift.alpha = symbolsOn ? 0 : 1
        shiftButton = shift
        updateShiftAppearance()
        r3.addArrangedSubview(shift)

        var midKeys: [UIButton] = []
        for k in rows[2] {
            let b = letterKey(k)
            midKeys.append(b)
            r3.addArrangedSubview(b)
        }

        let bksp = keyButton("⌫", style: .special)
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

        let mode = keyButton(symbolsOn ? "ABC" : "123", style: .special)
        mode.addTarget(self, action: #selector(modeTapped), for: .touchDown)
        mode.widthAnchor.constraint(equalToConstant: 54).isActive = true
        r4.addArrangedSubview(mode)

        let globe = keyButton("🌐", style: .special)
        globe.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        globe.widthAnchor.constraint(equalToConstant: 46).isActive = true
        r4.addArrangedSubview(globe)

        let space = keyButton("space", style: .space)
        space.addTarget(self, action: #selector(spaceTapped), for: .touchDown)
        r4.addArrangedSubview(space)

        let ret = keyButton("⏎", style: .send)
        ret.addTarget(self, action: #selector(returnTapped), for: .touchDown)
        ret.widthAnchor.constraint(equalToConstant: 66).isActive = true
        r4.addArrangedSubview(ret)

        rowsContainer.addArrangedSubview(r4)
    }

    private func letterKey(_ title: String) -> KeyButton {
        let shown = (shiftOn && !symbolsOn) ? title.uppercased() : title
        let b = keyButton(shown, style: .letter)
        b.addTarget(self, action: #selector(charTapped(_:)), for: .touchDown)
        b.addTarget(self, action: #selector(charReleased),
                    for: [.touchUpInside, .touchUpOutside, .touchCancel])
        if !symbolsOn { letterButtons.append(b) }
        return b
    }

    private func applyColors() {
        view.backgroundColor = trayColor
        romanLabel.textColor = mutedColor
        popupView.backgroundColor = popupColor
        popupLabel.textColor = keyTextColor
        for sep in chipSeparators { sep.backgroundColor = separatorColor }
        for b in chipButtons {
            b.baseColor = .clear
            b.pressedColor = chipFlashColor
        }
    }

    // MARK: - Key balloon

    private func showPopup(for key: UIButton) {
        guard let title = key.currentTitle else { return }
        let keyFrame = key.convert(key.bounds, to: view)
        let w = max(keyFrame.width * 1.6, 50)
        let h: CGFloat = 54
        // Centered over the key, clamped so edge keys stay on screen.
        var x = keyFrame.midX - w / 2
        x = min(max(3, x), view.bounds.width - w - 3)
        let y = keyFrame.minY - h + 2

        // Appear instantly, exactly like the system keyboard balloon.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        popupView.frame = CGRect(x: x, y: y, width: w, height: h)
        popupLabel.frame = popupView.bounds
        popupLabel.text = title
        popupView.isHidden = false
        CATransaction.commit()
    }

    private func hidePopup() {
        popupView.isHidden = true
    }

    // MARK: - Shift without rebuilding (rebuilding mid-touch janks and can
    // strand the balloon, so the keys just retitle in place)

    private func retitleLetterKeys() {
        for b in letterButtons {
            guard let t = b.currentTitle else { continue }
            b.setTitle(shiftOn ? t.uppercased() : t.lowercased(), for: .normal)
        }
    }

    private func updateShiftAppearance() {
        guard let shift = shiftButton else { return }
        if shiftOn {
            shift.baseColor = .white
            shift.setTitleColor(.black, for: .normal)
        } else {
            shift.baseColor = specialColor
            shift.setTitleColor(keyTextColor, for: .normal)
        }
    }

    // MARK: - Typing

    @objc private func charTapped(_ sender: UIButton) {
        guard let t = sender.currentTitle else { return }
        showPopup(for: sender)
        clickFeedback()
        buffer += shiftOn ? t : t.lowercased()
        if shiftOn && !symbolsOn {
            shiftOn = false
            updateShiftAppearance()
            retitleLetterKeys()
        }
        refresh()
    }

    @objc private func charReleased() {
        hidePopup()
    }

    @objc private func shiftTapped() {
        clickFeedback()
        shiftOn.toggle()
        updateShiftAppearance()
        retitleLetterKeys()
    }

    @objc private func modeTapped() {
        clickFeedback()
        symbolsOn.toggle()
        shiftOn = false
        rebuildRows()
    }

    @objc private func spaceTapped() {
        clickFeedback()
        if buffer.isEmpty {
            textDocumentProxy.insertText(" ")
        } else {
            commitBuffer()
        }
    }

    @objc private func returnTapped() {
        clickFeedback()
        commitBuffer()
        textDocumentProxy.insertText("\n")
    }

    @objc private func chipTapped(_ sender: UIButton) {
        let i = sender.tag
        guard i < currentSuggestions.count else { return }
        clickFeedback()
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
        clickFeedback()
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
        // A separator only makes sense between two visible columns.
        for (i, sep) in chipSeparators.enumerated() {
            sep.isHidden = chipButtons[i + 1].isHidden
        }
    }
}

/// A key that swaps to its pressed color the instant a touch lands and eases
/// back on release, copying the Apple keyboard's press feel. Keys without a
/// pressed color (the letter keys) keep their color; the balloon is their
/// feedback.
private final class KeyButton: UIButton {
    var baseColor: UIColor = .clear {
        didSet { if !isHighlighted { backgroundColor = baseColor } }
    }
    var pressedColor: UIColor?

    override var isHighlighted: Bool {
        didSet {
            guard let pressed = pressedColor else { return }
            if isHighlighted {
                layer.removeAllAnimations()
                backgroundColor = pressed
            } else {
                UIView.animate(withDuration: 0.12) { self.backgroundColor = self.baseColor }
            }
        }
    }
}

/// Lets UIDevice.playInputClick() produce the system keyboard click while the
/// keyboard is visible (it respects the user's Sound settings).
extension UIInputView: UIInputViewAudioFeedback {
    public var enableInputClicksWhenVisible: Bool { true }
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
