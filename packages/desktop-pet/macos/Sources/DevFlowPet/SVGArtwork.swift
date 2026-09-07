import AppKit
import Foundation

/// Validates self-contained vector artwork before AppKit renders it.
enum SVGArtwork {
    static let maximumBytes = 1024 * 1024

    static func canvas(of data: Data) throws -> AnimationCatalog.Canvas {
        guard data.count <= maximumBytes,
              let text = String(data: data, encoding: .utf8),
              !text.localizedCaseInsensitiveContains("<!DOCTYPE"),
              !text.localizedCaseInsensitiveContains("<!ENTITY") else {
            throw AppearanceImportError(message: "SVG must be UTF-8, at most 1 MiB, and contain no document type or entities")
        }
        let validator = VectorDocument()
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = validator
        guard parser.parse(), validator.problem == nil, let canvas = validator.canvas else {
            throw AppearanceImportError(message: validator.problem ?? "invalid SVG document")
        }
        guard let image = NSImage(data: data), image.isValid else {
            throw AppearanceImportError(message: "this system cannot render the SVG artwork")
        }
        return canvas
    }
}

private final class VectorDocument: NSObject, XMLParserDelegate {
    private static let elements: Set<String> = [
        "svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
        "linearGradient", "radialGradient", "stop", "clipPath", "use", "title", "desc",
    ]
    private static let attributes: Set<String> = [
        "xmlns", "xmlns:xlink", "version", "width", "height", "viewBox", "preserveAspectRatio",
        "id", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "fr",
        "d", "points", "transform", "fill", "fill-rule", "fill-opacity", "opacity", "color",
        "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
        "stroke-opacity", "stroke-dasharray", "stroke-dashoffset", "clip-path", "clip-rule", "clipPathUnits",
        "gradientUnits", "gradientTransform", "spreadMethod", "offset", "stop-color", "stop-opacity",
        "href", "xlink:href",
    ]
    private(set) var canvas: AnimationCatalog.Canvas?
    private(set) var problem: String?
    private var elementCount = 0
    private var depth = 0

    func parser(_ parser: XMLParser, didStartElement element: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        depth += 1
        elementCount += 1
        guard elementCount <= 4096, depth <= 64, Self.elements.contains(element) else {
            reject(parser, "SVG supports bounded static vector shapes and gradients only")
            return
        }
        for (name, value) in attributes {
            guard Self.attributes.contains(name),
                  name != "xmlns" || value == "http://www.w3.org/2000/svg",
                  name != "xmlns:xlink" || value == "http://www.w3.org/1999/xlink" else {
                reject(parser, "unsupported SVG attribute: \(name)")
                return
            }
            if name == "href" || name == "xlink:href" {
                guard value.range(of: "^#[A-Za-z_][A-Za-z0-9_.-]*$", options: .regularExpression) != nil else {
                    reject(parser, "SVG references must point to an element in the same file")
                    return
                }
            }
            if ["fill", "stroke", "color", "stop-color", "clip-path"].contains(name) {
                let paint = "^(?:[A-Za-z]+|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\\([0-9.,% +\\-]+\\)|url\\(#[A-Za-z_][A-Za-z0-9_.-]*\\))$"
                guard value.range(of: paint, options: .regularExpression) != nil else {
                    reject(parser, "SVG paint must be a color or an internal url(#id)")
                    return
                }
            }
        }
        if depth == 1 {
            guard element == "svg", attributes["xmlns"] == "http://www.w3.org/2000/svg",
                  let width = attributes["width"].flatMap(Int.init),
                  let height = attributes["height"].flatMap(Int.init),
                  (1...4096).contains(width), (1...4096).contains(height) else {
                reject(parser, "SVG requires an svg root with integer width and height from 1 to 4096")
                return
            }
            if let viewBox = attributes["viewBox"] {
                let components = viewBox.split { $0.isWhitespace || $0 == "," }
                let values = components.compactMap { Double($0) }
                guard components.count == 4, values == [0, 0, Double(width), Double(height)] else {
                    reject(parser, "SVG viewBox must be 0 0 width height")
                    return
                }
            }
            canvas = .init(width: width, height: height)
        } else if element == "svg" {
            reject(parser, "SVG uses one root canvas")
        }
    }

    func parser(_ parser: XMLParser, didEndElement: String, namespaceURI: String?, qualifiedName: String?) {
        depth -= 1
    }

    func parser(_ parser: XMLParser, foundProcessingInstructionWithTarget: String, data: String?) {
        reject(parser, "SVG processing instructions are unsupported")
    }

    private func reject(_ parser: XMLParser, _ message: String) {
        problem = message
        parser.abortParsing()
    }
}
