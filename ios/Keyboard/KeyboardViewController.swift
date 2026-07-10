import UIKit
import WebKit

/// The iOS system keyboard. Its view is a WKWebView that loads the same
/// keyboard UI we build for the web (ime.html), bundled into the extension.
/// When the web side commits Khmer text, we type it into the focused field
/// through textDocumentProxy.
class KeyboardViewController: UIInputViewController, WKScriptMessageHandler, WKNavigationDelegate {

    private var webView: WKWebView!
    private var heightConstraint: NSLayoutConstraint!

    override func viewDidLoad() {
        super.viewDidLoad()

        let content = WKUserContentController()
        content.add(self, name: "genz")

        let config = WKWebViewConfiguration()
        config.userContentController = content

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0x20/255.0, green: 0x1d/255.0, blue: 0x19/255.0, alpha: 1)
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        heightConstraint = view.heightAnchor.constraint(equalToConstant: 300)
        heightConstraint.priority = UILayoutPriority(999)
        heightConstraint.isActive = true

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        if let url = Bundle.main.url(forResource: "ime", withExtension: "html", subdirectory: "Web") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let proxy = textDocumentProxy

        switch action {
        case "commit":
            if let t = body["text"] as? String { proxy.insertText(t) }
        case "space":
            proxy.insertText(" ")
        case "enter":
            proxy.insertText("\n")
        case "backspace":
            proxy.deleteBackward()
        case "switch":
            advanceToNextInputMode()
        case "height":
            if let s = body["text"] as? String, let v = Double(s) {
                let clamped = CGFloat(min(max(v, 220), 560))
                heightConstraint.constant = clamped
            }
        default:
            break
        }
    }
}
