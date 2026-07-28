import AppKit
import QuickLookUI

final class PreviewViewController: NSViewController, QLPreviewingController {
    private let scrollView = NSScrollView()
    private let textView = NSTextView()

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 820, height: 680))
        preferredContentSize = NSSize(width: 820, height: 680)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = true
        scrollView.backgroundColor = ReversionMarkdownRenderer.paperColor

        // Tables are laid out with NSTextTable, which only TextKit 1 renders —
        // under TextKit 2 the cells collapse into plain paragraphs. Touching
        // the TextKit 1 layout manager is what pins the view to that stack.
        _ = textView.layoutManager

        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = true
        textView.backgroundColor = ReversionMarkdownRenderer.paperColor
        textView.textContainerInset = NSSize(width: 54, height: 42)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.lineFragmentPadding = 0
        textView.linkTextAttributes = [
            .foregroundColor: ReversionMarkdownRenderer.accentColor,
            .underlineStyle: NSUnderlineStyle.single.rawValue
        ]

        scrollView.documentView = textView
        view.addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer {
            if accessed {
                url.stopAccessingSecurityScopedResource()
            }
        }

        do {
            let data = try Data(contentsOf: url, options: [.mappedIfSafe])
            guard data.count <= 12 * 1_024 * 1_024 else {
                throw PreviewError.fileTooLarge
            }
            guard let markdown = String(data: data, encoding: .utf8)
                    ?? String(data: data, encoding: .utf16)
                    ?? String(data: data, encoding: .isoLatin1) else {
                throw PreviewError.unsupportedEncoding
            }

            textView.textStorage?.setAttributedString(
                ReversionMarkdownRenderer.render(markdown, fileName: url.lastPathComponent)
            )
            textView.scrollToBeginningOfDocument(nil)
            handler(nil)
        } catch {
            textView.string = "反文无法预览此文件。\n\n\(error.localizedDescription)"
            handler(error)
        }
    }
}

private enum PreviewError: LocalizedError {
    case fileTooLarge
    case unsupportedEncoding

    var errorDescription: String? {
        switch self {
        case .fileTooLarge:
            return "文件超过 12 MB 的 Quick Look 预览上限。"
        case .unsupportedEncoding:
            return "文件编码不是 UTF-8、UTF-16 或 Latin-1。"
        }
    }
}
