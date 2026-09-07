import AppKit

/// Draws the Dev Flow mark as a menu bar template image.
enum PetMenuBarIcon {
    static func makeImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: true) { _ in
            // The brand curve follows dev-flow-mark-32.svg in the WebUI assets.
            let mark = NSBezierPath()
            mark.move(to: NSPoint(x: 316, y: 28))
            mark.curve(to: NSPoint(x: 287, y: 6.8),
                       controlPoint1: NSPoint(x: 307.06, y: 19.06), controlPoint2: NSPoint(x: 298.26, y: 12.43))
            mark.curve(to: NSPoint(x: 249, y: 1),
                       controlPoint1: NSPoint(x: 275.35, y: 0.98), controlPoint2: NSPoint(x: 261.65, y: -0.26))
            mark.curve(to: NSPoint(x: 144, y: 156),
                       controlPoint1: NSPoint(x: 175.73, y: 8.33), controlPoint2: NSPoint(x: 166.07, y: 100.83))
            mark.curve(to: NSPoint(x: 96, y: 209),
                       controlPoint1: NSPoint(x: 135.18, y: 178.04), controlPoint2: NSPoint(x: 123.41, y: 206.26))
            mark.curve(to: NSPoint(x: 104, y: 122.4),
                       controlPoint1: NSPoint(x: 19.23, y: 216.68), controlPoint2: NSPoint(x: 40.2, y: 96.88))
            mark.curve(to: NSPoint(x: 131, y: 149),
                       controlPoint1: NSPoint(x: 118.47, y: 128.19), controlPoint2: NSPoint(x: 121.23, y: 139.23))
            mark.line(to: NSPoint(x: 149, y: 102))
            mark.curve(to: NSPoint(x: 31, y: 97),
                       controlPoint1: NSPoint(x: 124.12, y: 64.68), controlPoint2: NSPoint(x: 60.51, y: 70.44))
            mark.curve(to: NSPoint(x: 21.8, y: 222),
                       controlPoint1: NSPoint(x: -4.71, y: 129.14), controlPoint2: NSPoint(x: -7.86, y: 184.93))
            mark.curve(to: NSPoint(x: 59, y: 248.4),
                       controlPoint1: NSPoint(x: 30.93, y: 233.41), controlPoint2: NSPoint(x: 44.8, y: 244.14))
            mark.curve(to: NSPoint(x: 227.2, y: 66),
                       controlPoint1: NSPoint(x: 182.35, y: 285.4), controlPoint2: NSPoint(x: 190.27, y: 139.85))
            mark.curve(to: NSPoint(x: 283, y: 62),
                       controlPoint1: NSPoint(x: 237.4, y: 45.59), controlPoint2: NSPoint(x: 271.19, y: 38.38))
            mark.close()

            // Move the crossbar outward to keep its gap clear at menu bar size.
            mark.move(to: NSPoint(x: 232, y: 113))
            mark.line(to: NSPoint(x: 295, y: 113))
            mark.curve(to: NSPoint(x: 269, y: 159),
                       controlPoint1: NSPoint(x: 292, y: 135), controlPoint2: NSPoint(x: 283, y: 151))
            mark.curve(to: NSPoint(x: 234, y: 167),
                       controlPoint1: NSPoint(x: 259, y: 165), controlPoint2: NSPoint(x: 249, y: 167))
            mark.line(to: NSPoint(x: 211, y: 167))
            mark.close()

            mark.transform(using: AffineTransform(
                m11: 0.0522, m12: 0, m21: 0, m22: 0.0522, tX: 0.75, tY: 2.25
            ))
            NSColor.black.setFill()
            mark.fill()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Dev Flow"
        return image
    }
}
