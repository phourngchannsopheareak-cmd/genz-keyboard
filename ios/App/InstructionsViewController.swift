import UIKit

/// Simple launcher screen. It cannot enable the keyboard for the user (iOS
/// requires them to do it in Settings), so it explains the steps and gives a
/// box to test typing once the keyboard is on.
class InstructionsViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x14/255.0, green: 0x13/255.0, blue: 0x12/255.0, alpha: 1)

        let gold = UIColor(red: 0xE8/255.0, green: 0xA9/255.0, blue: 0x3D/255.0, alpha: 1)
        let cream = UIColor(red: 0xF2/255.0, green: 0xED/255.0, blue: 0xE4/255.0, alpha: 1)
        let muted = UIColor(red: 0x8a/255.0, green: 0x85/255.0, blue: 0x78/255.0, alpha: 1)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28)
        ])

        func label(_ text: String, _ size: CGFloat, _ color: UIColor, _ weight: UIFont.Weight = .regular) -> UILabel {
            let l = UILabel()
            l.text = text
            l.font = .systemFont(ofSize: size, weight: weight)
            l.textColor = color
            l.numberOfLines = 0
            return l
        }

        stack.addArrangedSubview(label("Genz Keyboard", 28, gold, .bold))
        stack.addArrangedSubview(label("Type Khmerlish, get Khmer. Turn it on in three steps:", 16, cream))
        stack.addArrangedSubview(label("1.  Settings  ›  General  ›  Keyboard  ›  Keyboards  ›  Add New Keyboard  ›  Genz Keyboard", 15, cream))
        stack.addArrangedSubview(label("2.  Tap Genz Keyboard again and turn on Allow Full Access.", 15, cream))
        stack.addArrangedSubview(label("3.  In any app, hold the 🌐 key and pick Genz Keyboard.", 15, cream))
        stack.addArrangedSubview(label("Then tap the box below and type  jg tv pteas", 14, muted))

        let field = UITextField()
        field.borderStyle = .roundedRect
        field.placeholder = "type here to test…"
        field.font = .systemFont(ofSize: 18)
        field.heightAnchor.constraint(equalToConstant: 48).isActive = true
        stack.addArrangedSubview(field)
    }
}
