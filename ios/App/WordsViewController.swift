import UIKit

/// The add-your-own-words screen. A keyboard extension cannot show a form of
/// its own, and there is no App Group to share a file through (free-cert
/// sideloading does not sign one reliably), so the list is handed over on a
/// private same-team named pasteboard that the keyboard reads and merges
/// every time it appears. The payload is rewritten on every change and on
/// every appearance, because named pasteboards do not survive a restart.
class WordsViewController: UIViewController, UITableViewDataSource {

    static let boardName = "com.reak.genzkeyboard.words"
    private static let storeKey = "genz-app-words"

    private let bg = UIColor(red: 0x14/255.0, green: 0x13/255.0, blue: 0x12/255.0, alpha: 1)
    private let panel = UIColor(red: 0x1D/255.0, green: 0x1B/255.0, blue: 0x18/255.0, alpha: 1)
    private let gold = UIColor(red: 0xE8/255.0, green: 0xA9/255.0, blue: 0x3D/255.0, alpha: 1)
    private let cream = UIColor(red: 0xF2/255.0, green: 0xED/255.0, blue: 0xE4/255.0, alpha: 1)
    private let muted = UIColor(red: 0x8a/255.0, green: 0x85/255.0, blue: 0x78/255.0, alpha: 1)

    private var words: [String: String] = [:]
    private var order: [String] = []

    private let romanField = UITextField()
    private let khmerField = UITextField()
    private let statusLabel = UILabel()
    private let table = UITableView()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = bg
        words = (UserDefaults.standard.dictionary(forKey: WordsViewController.storeKey) as? [String: String]) ?? [:]
        order = words.keys.sorted()

        let header = UIStackView()
        header.axis = .vertical
        header.spacing = 12
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)

        let titleRow = UIStackView()
        titleRow.axis = .horizontal
        let title = UILabel()
        title.text = "My Words"
        title.font = .systemFont(ofSize: 24, weight: .bold)
        title.textColor = gold
        titleRow.addArrangedSubview(title)
        let close = UIButton(type: .system)
        close.setTitle("Close", for: .normal)
        close.setTitleColor(muted, for: .normal)
        close.titleLabel?.font = .systemFont(ofSize: 16)
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        titleRow.addArrangedSubview(close)
        header.addArrangedSubview(titleRow)

        styleField(romanField, placeholder: "Khmerlish, like: bj  or  jg tv")
        romanField.autocapitalizationType = .none
        romanField.autocorrectionType = .no
        romanField.keyboardType = .asciiCapable
        header.addArrangedSubview(romanField)

        styleField(khmerField, placeholder: "Khmer, like: បាញ់")
        header.addArrangedSubview(khmerField)

        let add = UIButton(type: .system)
        add.setTitle("Add word", for: .normal)
        add.setTitleColor(bg, for: .normal)
        add.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        add.backgroundColor = gold
        add.layer.cornerRadius = 10
        add.heightAnchor.constraint(equalToConstant: 48).isActive = true
        add.addTarget(self, action: #selector(addTapped), for: .touchUpInside)
        header.addArrangedSubview(add)

        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = muted
        statusLabel.numberOfLines = 0
        statusLabel.text = "The keyboard learns these the next time you open it. Deleting here does not remove a word the keyboard already learned."
        header.addArrangedSubview(statusLabel)

        table.translatesAutoresizingMaskIntoConstraints = false
        table.backgroundColor = bg
        table.separatorColor = panel
        table.dataSource = self
        table.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        view.addSubview(table)

        NSLayoutConstraint.activate([
            header.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            header.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            table.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        publish()
    }

    private func styleField(_ f: UITextField, placeholder: String) {
        f.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: muted]
        )
        f.textColor = cream
        f.backgroundColor = panel
        f.layer.cornerRadius = 10
        f.font = .systemFont(ofSize: 18)
        f.heightAnchor.constraint(equalToConstant: 48).isActive = true
        let pad = UIView(frame: CGRect(x: 0, y: 0, width: 12, height: 48))
        f.leftView = pad
        f.leftViewMode = .always
    }

    @objc private func closeTapped() {
        dismiss(animated: true)
    }

    @objc private func addTapped() {
        let key = (romanField.text ?? "").lowercased().trimmingCharacters(in: .whitespaces)
        let khmer = (khmerField.text ?? "").trimmingCharacters(in: .whitespaces)
        guard !key.isEmpty, !khmer.isEmpty else {
            status("Type both boxes first.", ok: false)
            return
        }
        let valid = !key.contains("  ") && key.allSatisfy { $0 == "'" || $0 == " " || ($0 >= "a" && $0 <= "z") }
        guard valid else {
            status("The first box takes only a-z letters, like: bj", ok: false)
            return
        }
        words[key] = khmer
        order = words.keys.sorted()
        save()
        table.reloadData()
        romanField.text = ""
        khmerField.text = ""
        status("Saved \(key) → \(khmer). Open Genz Keyboard in any app and it will know it.", ok: true)
    }

    private func status(_ text: String, ok: Bool) {
        statusLabel.text = text
        statusLabel.textColor = ok ? gold : cream
    }

    private func save() {
        UserDefaults.standard.set(words, forKey: WordsViewController.storeKey)
        publish()
    }

    /// Writes the whole list to the shared named pasteboard for the keyboard.
    private func publish() {
        guard let board = UIPasteboard(name: UIPasteboard.Name(rawValue: WordsViewController.boardName), create: true) else { return }
        if words.isEmpty {
            board.items = []
            return
        }
        if let data = try? JSONSerialization.data(withJSONObject: words),
           let json = String(data: data, encoding: .utf8) {
            board.string = json
        }
    }

    // MARK: - Table

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return order.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        let key = order[indexPath.row]
        cell.backgroundColor = bg
        cell.selectionStyle = .none
        cell.textLabel?.textColor = cream
        cell.textLabel?.font = .systemFont(ofSize: 18)
        cell.textLabel?.text = "\(key)  →  \(words[key] ?? "")"
        return cell
    }

    func tableView(_ tableView: UITableView, commit editingStyle: UITableViewCell.EditingStyle, forRowAt indexPath: IndexPath) {
        guard editingStyle == .delete else { return }
        let key = order[indexPath.row]
        words.removeValue(forKey: key)
        order.remove(at: indexPath.row)
        save()
        tableView.deleteRows(at: [indexPath], with: .automatic)
    }
}
