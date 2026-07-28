import AppKit
import Foundation

enum ReversionMarkdownRenderer {
    static let paperColor = NSColor(calibratedRed: 0.965, green: 0.972, blue: 0.978, alpha: 1)
    static let textColor = NSColor(calibratedRed: 0.11, green: 0.14, blue: 0.17, alpha: 1)
    static let mutedColor = NSColor(calibratedRed: 0.39, green: 0.44, blue: 0.49, alpha: 1)
    static let accentColor = NSColor(calibratedRed: 0.04, green: 0.39, blue: 0.48, alpha: 1)
    private static let codeColor = NSColor(calibratedRed: 0.34, green: 0.17, blue: 0.25, alpha: 1)
    private static let codeBackground = NSColor(calibratedRed: 0.91, green: 0.93, blue: 0.95, alpha: 1)
    private static let quoteBackground = NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.96, alpha: 1)
    private static let tableBorderColor = NSColor(calibratedWhite: 0.80, alpha: 1)
    private static let tableHeaderBackground = NSColor(calibratedRed: 0.91, green: 0.93, blue: 0.95, alpha: 1)

    static func render(_ markdown: String, fileName: String) -> NSAttributedString {
        let output = NSMutableAttributedString()
        appendDocumentLabel(fileName, to: output)

        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lines = normalized.components(separatedBy: "\n")
        var index = 0
        var paragraph: [String] = []
        var codeLines: [String] = []
        var inFence = false
        var fenceMarker = ""
        var codeLanguage = ""

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            appendInline(paragraph.joined(separator: " "), style: .body, to: output)
            paragraph.removeAll(keepingCapacity: true)
        }

        func flushCode() {
            appendCode(codeLines.joined(separator: "\n"), language: codeLanguage, to: output)
            codeLines.removeAll(keepingCapacity: true)
            codeLanguage = ""
        }

        while index < lines.count {
            let line = lines[index]
            index += 1
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if inFence {
                if trimmed.hasPrefix(fenceMarker) {
                    inFence = false
                    flushCode()
                } else {
                    codeLines.append(line)
                }
                continue
            }

            if let fence = fenceStart(in: trimmed) {
                flushParagraph()
                inFence = true
                fenceMarker = fence.marker
                codeLanguage = fence.language
                continue
            }

            if trimmed.isEmpty {
                flushParagraph()
                continue
            }

            if let heading = heading(in: trimmed) {
                flushParagraph()
                appendInline(heading.text, style: .heading(heading.level), to: output)
            } else if let item = listItem(in: line) {
                flushParagraph()
                appendListItem(item, to: output)
            } else if trimmed.hasPrefix(">") {
                flushParagraph()
                let quote = trimmed.dropFirst().trimmingCharacters(in: .whitespaces)
                appendInline(String(quote), style: .quote, to: output)
            } else if isHorizontalRule(trimmed) {
                flushParagraph()
                appendRule(to: output)
            } else if let table = table(startingAt: index - 1, in: lines) {
                flushParagraph()
                appendTable(table, to: output)
                index = table.endIndex
            } else if looksLikeTable(line) {
                // A pipe row without a valid delimiter row underneath is not a
                // table in GFM; show it verbatim rather than inventing columns.
                flushParagraph()
                appendInline(line, style: .table, to: output)
            } else {
                paragraph.append(trimmed)
            }
        }

        flushParagraph()
        if inFence || !codeLines.isEmpty {
            flushCode()
        }
        return output
    }

    private enum BlockStyle {
        case body
        case heading(Int)
        case quote
        case table
    }

    private struct ListItem {
        let prefix: String
        let text: String
        let level: Int
        let checked: Bool?
    }

    private static func appendDocumentLabel(_ fileName: String, to output: NSMutableAttributedString) {
        let style = paragraphStyle(spacingAfter: 26, lineHeight: 18)
        output.append(NSAttributedString(string: "反文  ·  \(fileName)\n", attributes: [
            .font: NSFont.systemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: accentColor,
            .paragraphStyle: style,
            .kern: 0.4
        ]))
    }

    private static func appendInline(_ source: String, style: BlockStyle, to output: NSMutableAttributedString) {
        let configuration = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            failurePolicy: .returnPartiallyParsedIfPossible
        )
        let parsed = (try? AttributedString(markdown: source, options: configuration)) ?? AttributedString(source)
        let rendered = NSMutableAttributedString(attributedString: NSAttributedString(parsed))

        let baseFont: NSFont
        let paragraph: NSMutableParagraphStyle
        let color: NSColor
        switch style {
        case .body:
            baseFont = bodyFont(size: 16)
            paragraph = paragraphStyle(spacingAfter: 13, lineHeight: 27)
            color = textColor
        case .heading(let level):
            let sizes: [CGFloat] = [0, 31, 25, 21, 18, 16, 15]
            baseFont = headingFont(size: sizes[min(max(level, 1), 6)], weight: level <= 2 ? .bold : .semibold)
            paragraph = paragraphStyle(spacingBefore: level == 1 ? 22 : 16, spacingAfter: level == 1 ? 14 : 10, lineHeight: sizes[min(max(level, 1), 6)] * 1.3)
            color = level <= 4 ? textColor : mutedColor
        case .quote:
            baseFont = bodyFont(size: 15.5)
            paragraph = paragraphStyle(spacingAfter: 14, lineHeight: 25)
            paragraph.headIndent = 20
            paragraph.firstLineHeadIndent = 20
            paragraph.tailIndent = -20
            color = mutedColor
            rendered.addAttribute(.backgroundColor, value: quoteBackground, range: NSRange(location: 0, length: rendered.length))
        case .table:
            baseFont = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
            paragraph = paragraphStyle(spacingAfter: 6, lineHeight: 21)
            color = mutedColor
        }

        rendered.addAttributes([
            .font: baseFont,
            .foregroundColor: color,
            .paragraphStyle: paragraph
        ], range: NSRange(location: 0, length: rendered.length))
        styleInlineIntents(in: rendered, baseFont: baseFont)
        rendered.append(NSAttributedString(string: "\n", attributes: [.paragraphStyle: paragraph]))
        output.append(rendered)
    }

    private static func styleInlineIntents(in text: NSMutableAttributedString, baseFont: NSFont) {
        let fullRange = NSRange(location: 0, length: text.length)
        let inlineIntentKey = NSAttributedString.Key("NSInlinePresentationIntent")
        text.enumerateAttribute(inlineIntentKey, in: fullRange) { value, range, _ in
            guard let raw = value as? NSNumber else { return }
            let intent = raw.intValue
            var font = baseFont
            if intent & 2 != 0 {
                font = NSFontManager.shared.convert(font, toHaveTrait: .boldFontMask)
            }
            if intent & 1 != 0 {
                font = NSFontManager.shared.convert(font, toHaveTrait: .italicFontMask)
            }
            if intent & 4 != 0 {
                font = NSFont.monospacedSystemFont(ofSize: max(12, baseFont.pointSize - 1), weight: .regular)
                text.addAttributes([
                    .backgroundColor: codeBackground,
                    .foregroundColor: codeColor
                ], range: range)
            }
            if intent & 8 != 0 {
                text.addAttribute(.strikethroughStyle, value: NSUnderlineStyle.single.rawValue, range: range)
            }
            text.addAttribute(.font, value: font, range: range)
        }
        text.enumerateAttribute(.link, in: fullRange) { value, range, _ in
            guard value != nil else { return }
            text.addAttributes([
                .foregroundColor: accentColor,
                .underlineStyle: NSUnderlineStyle.single.rawValue
            ], range: range)
        }
    }

    private static func appendListItem(_ item: ListItem, to output: NSMutableAttributedString) {
        let paragraph = paragraphStyle(spacingAfter: 5, lineHeight: 24)
        let indent = CGFloat(22 + item.level * 20)
        paragraph.firstLineHeadIndent = CGFloat(item.level * 20)
        paragraph.headIndent = indent
        paragraph.tabStops = [NSTextTab(textAlignment: .left, location: indent)]

        let marker: String
        if let checked = item.checked {
            marker = checked ? "☑" : "☐"
        } else {
            marker = item.prefix
        }
        let prefix = NSAttributedString(string: "\(marker)\t", attributes: [
            .font: NSFont.systemFont(ofSize: 15, weight: .medium),
            .foregroundColor: accentColor,
            .paragraphStyle: paragraph
        ])
        output.append(prefix)

        let configuration = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace,
            failurePolicy: .returnPartiallyParsedIfPossible
        )
        let parsed = (try? AttributedString(markdown: item.text, options: configuration)) ?? AttributedString(item.text)
        let content = NSMutableAttributedString(attributedString: NSAttributedString(parsed))
        let font = bodyFont(size: 15.5)
        content.addAttributes([
            .font: font,
            .foregroundColor: textColor,
            .paragraphStyle: paragraph
        ], range: NSRange(location: 0, length: content.length))
        styleInlineIntents(in: content, baseFont: font)
        content.append(NSAttributedString(string: "\n", attributes: [.paragraphStyle: paragraph]))
        output.append(content)
    }

    private static func appendCode(_ code: String, language: String, to output: NSMutableAttributedString) {
        let paragraph = paragraphStyle(spacingBefore: 8, spacingAfter: 16, lineHeight: 21)
        paragraph.firstLineHeadIndent = 14
        paragraph.headIndent = 14
        paragraph.tailIndent = -14
        if !language.isEmpty {
            output.append(NSAttributedString(string: language.uppercased() + "\n", attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 10.5, weight: .semibold),
                .foregroundColor: accentColor,
                .paragraphStyle: paragraph
            ]))
        }
        output.append(NSAttributedString(string: code + "\n", attributes: [
            .font: NSFont.monospacedSystemFont(ofSize: 13.5, weight: .regular),
            .foregroundColor: codeColor,
            .backgroundColor: codeBackground,
            .paragraphStyle: paragraph
        ]))
    }

    private static func appendRule(to output: NSMutableAttributedString) {
        let paragraph = paragraphStyle(spacingBefore: 10, spacingAfter: 18, lineHeight: 16)
        output.append(NSAttributedString(string: "────────────────────────────────────────\n", attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: NSColor(calibratedWhite: 0.72, alpha: 1),
            .paragraphStyle: paragraph
        ]))
    }

    private static func heading(in line: String) -> (level: Int, text: String)? {
        var level = 0
        for character in line {
            guard character == "#", level < 6 else { break }
            level += 1
        }
        guard level > 0 else { return nil }
        let index = line.index(line.startIndex, offsetBy: level)
        guard index < line.endIndex, line[index].isWhitespace else { return nil }
        return (level, line[index...].trimmingCharacters(in: .whitespaces))
    }

    private static func fenceStart(in line: String) -> (marker: String, language: String)? {
        if line.hasPrefix("```") {
            return ("```", String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces))
        }
        if line.hasPrefix("~~~") {
            return ("~~~", String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces))
        }
        return nil
    }

    private static func listItem(in line: String) -> ListItem? {
        let leading = line.prefix { $0 == " " || $0 == "\t" }
        let level = leading.reduce(0) { $1 == "\t" ? $0 + 1 : $0 } + leading.filter { $0 == " " }.count / 2
        let content = String(line.dropFirst(leading.count))

        if content.hasPrefix("- [ ] ") || content.hasPrefix("* [ ] ") {
            return ListItem(prefix: "•", text: String(content.dropFirst(6)), level: level, checked: false)
        }
        if content.hasPrefix("- [x] ") || content.hasPrefix("- [X] ") || content.hasPrefix("* [x] ") || content.hasPrefix("* [X] ") {
            return ListItem(prefix: "•", text: String(content.dropFirst(6)), level: level, checked: true)
        }
        for marker in ["- ", "* ", "+ "] where content.hasPrefix(marker) {
            return ListItem(prefix: "•", text: String(content.dropFirst(2)), level: level, checked: nil)
        }

        let digits = content.prefix { $0.isNumber }
        if !digits.isEmpty {
            let rest = content.dropFirst(digits.count)
            if rest.hasPrefix(". ") || rest.hasPrefix(") ") {
                return ListItem(prefix: String(digits) + String(rest.prefix(1)), text: String(rest.dropFirst(2)), level: level, checked: nil)
            }
        }
        return nil
    }

    private static func isHorizontalRule(_ line: String) -> Bool {
        let compact = line.replacingOccurrences(of: " ", with: "")
        guard compact.count >= 3, let first = compact.first, ["-", "*", "_"].contains(String(first)) else {
            return false
        }
        return compact.allSatisfy { $0 == first }
    }

    private static func looksLikeTable(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("|") && trimmed.hasSuffix("|") && trimmed.filter { $0 == "|" }.count >= 2
    }

    struct Table {
        let header: [String]
        let rows: [[String]]
        let alignments: [NSTextAlignment]
        /// Index of the first line after the table, for the caller's cursor.
        let endIndex: Int
    }

    /// A GFM table is a header row, a delimiter row that fixes the column count
    /// and alignment, then body rows. Without a matching delimiter row the lines
    /// are just text that happens to contain pipes, so this returns nil and the
    /// caller falls back to verbatim output.
    static func table(startingAt start: Int, in lines: [String]) -> Table? {
        guard start + 1 < lines.count, looksLikeTable(lines[start]) else { return nil }
        let header = tableCells(in: lines[start])
        guard !header.isEmpty else { return nil }
        guard let alignments = delimiterAlignments(in: lines[start + 1]),
              alignments.count == header.count else { return nil }

        var rows: [[String]] = []
        var cursor = start + 2
        while cursor < lines.count, looksLikeTable(lines[cursor]) {
            var cells = tableCells(in: lines[cursor])
            // GFM: short rows are padded, long rows truncated, so every row
            // matches the header's column count.
            if cells.count < header.count {
                cells.append(contentsOf: Array(repeating: "", count: header.count - cells.count))
            } else if cells.count > header.count {
                cells = Array(cells.prefix(header.count))
            }
            rows.append(cells)
            cursor += 1
        }

        return Table(header: header, rows: rows, alignments: alignments, endIndex: cursor)
    }

    /// Splits one row on unescaped pipes, dropping the optional outer pair.
    static func tableCells(in line: String) -> [String] {
        var cells: [String] = []
        var current = ""
        var escaped = false
        for character in line.trimmingCharacters(in: .whitespaces) {
            if escaped {
                // Only `\|` is a pipe escape; every other pair keeps its
                // backslash so inline markdown still sees what the author wrote.
                if character != "|" { current.append("\\") }
                current.append(character)
                escaped = false
            } else if character == "\\" {
                escaped = true
            } else if character == "|" {
                cells.append(current)
                current = ""
            } else {
                current.append(character)
            }
        }
        if escaped { current.append("\\") }
        cells.append(current)

        if let first = cells.first, first.trimmingCharacters(in: .whitespaces).isEmpty {
            cells.removeFirst()
        }
        if let last = cells.last, last.trimmingCharacters(in: .whitespaces).isEmpty {
            cells.removeLast()
        }
        return cells.map { $0.trimmingCharacters(in: .whitespaces) }
    }

    /// `---` / `:---` / `---:` / `:---:` per column, or nil if this is not a
    /// delimiter row.
    static func delimiterAlignments(in line: String) -> [NSTextAlignment]? {
        let cells = tableCells(in: line)
        guard !cells.isEmpty else { return nil }

        var alignments: [NSTextAlignment] = []
        for cell in cells {
            let leadsWithColon = cell.hasPrefix(":")
            let trailsWithColon = cell.hasSuffix(":")
            var dashes = cell
            if leadsWithColon { dashes.removeFirst() }
            if trailsWithColon, !dashes.isEmpty { dashes.removeLast() }
            guard !dashes.isEmpty, dashes.allSatisfy({ $0 == "-" }) else { return nil }

            switch (leadsWithColon, trailsWithColon) {
            case (true, true): alignments.append(.center)
            case (false, true): alignments.append(.right)
            default: alignments.append(.left)
            }
        }
        return alignments
    }

    private static func appendTable(_ table: Table, to output: NSMutableAttributedString) {
        // NSTextTable does the column sizing and in-cell wrapping that the old
        // monospaced-line rendering could not: a monospaced font is only
        // monospaced for Latin, so CJK cells never lined up, and a long row
        // wrapped into the next visual line instead of staying in its column.
        let layout = NSTextTable()
        layout.numberOfColumns = table.header.count
        layout.layoutAlgorithm = .automaticLayoutAlgorithm
        layout.collapsesBorders = true
        layout.hidesEmptyCells = false

        appendTableRow(table.header, alignments: table.alignments, row: 0, isHeader: true, layout: layout, to: output)
        for (offset, cells) in table.rows.enumerated() {
            appendTableRow(cells, alignments: table.alignments, row: offset + 1, isHeader: false, layout: layout, to: output)
        }

        // Close the table so the next block is not absorbed into its last cell.
        output.append(NSAttributedString(string: "\n", attributes: [
            .font: bodyFont(size: 6),
            .paragraphStyle: paragraphStyle(spacingAfter: 12, lineHeight: 6)
        ]))
    }

    private static func appendTableRow(
        _ cells: [String],
        alignments: [NSTextAlignment],
        row: Int,
        isHeader: Bool,
        layout: NSTextTable,
        to output: NSMutableAttributedString
    ) {
        let font = bodyFont(size: 14)
        for (column, cell) in cells.enumerated() {
            let block = NSTextTableBlock(
                table: layout,
                startingRow: row,
                rowSpan: 1,
                startingColumn: column,
                columnSpan: 1
            )
            block.setBorderColor(tableBorderColor)
            block.setWidth(1, type: .absoluteValueType, for: .border)
            block.setWidth(7, type: .absoluteValueType, for: .padding)
            if isHeader {
                block.backgroundColor = tableHeaderBackground
            }

            let paragraph = paragraphStyle(spacingAfter: 0, lineHeight: 22)
            paragraph.textBlocks = [block]
            paragraph.alignment = alignments.indices.contains(column) ? alignments[column] : .left

            let configuration = AttributedString.MarkdownParsingOptions(
                interpretedSyntax: .inlineOnlyPreservingWhitespace,
                failurePolicy: .returnPartiallyParsedIfPossible
            )
            let parsed = (try? AttributedString(markdown: cell, options: configuration)) ?? AttributedString(cell)
            let rendered = NSMutableAttributedString(attributedString: NSAttributedString(parsed))
            let cellFont = isHeader ? NSFontManager.shared.convert(font, toHaveTrait: .boldFontMask) : font
            rendered.addAttributes([
                .font: cellFont,
                .foregroundColor: textColor,
                .paragraphStyle: paragraph
            ], range: NSRange(location: 0, length: rendered.length))
            styleInlineIntents(in: rendered, baseFont: cellFont)

            // Each cell is its own paragraph; TextKit assembles the grid from
            // the row/column carried by every paragraph's text block.
            rendered.append(NSAttributedString(string: "\n", attributes: [
                .font: cellFont,
                .paragraphStyle: paragraph
            ]))
            output.append(rendered)
        }
    }

    private static func paragraphStyle(
        spacingBefore: CGFloat = 0,
        spacingAfter: CGFloat,
        lineHeight: CGFloat
    ) -> NSMutableParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacingBefore = spacingBefore
        style.paragraphSpacing = spacingAfter
        style.minimumLineHeight = lineHeight
        style.maximumLineHeight = lineHeight
        style.lineBreakMode = .byWordWrapping
        return style
    }

    private static func bodyFont(size: CGFloat) -> NSFont {
        NSFont(name: "Noto Sans SC", size: size)
            ?? NSFont(name: "PingFang SC", size: size)
            ?? NSFont.systemFont(ofSize: size)
    }

    private static func headingFont(size: CGFloat, weight: NSFont.Weight) -> NSFont {
        NSFont(name: "LXGW WenKai", size: size)
            ?? NSFont(name: "Songti SC", size: size)
            ?? NSFont.systemFont(ofSize: size, weight: weight)
    }
}
