import AppKit

/**
 * Uses the small TaskBelay mark geometry, with transparent terminal details so macOS can tint it.
 */
enum PetMenuBarIcon {
    static func makeImage() -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: true) { _ in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }
            context.saveGState()
            defer { context.restoreGState() }
            context.scaleBy(x: 18.0 / 32, y: 18.0 / 32)
            context.beginTransparencyLayer(auxiliaryInfo: nil)
            context.setFillColor(NSColor.black.cgColor)
            context.setStrokeColor(NSColor.black.cgColor)

            // Match the road and guardrails in taskbelay-mark-32.svg.
            context.saveGState()
            context.translateBy(x: -2.432, y: -2.648)
            context.scaleBy(x: 0.072, y: 0.072)
            let road = CGMutablePath()
            road.move(to: CGPoint(x: 154, y: 428))
            road.addCurve(to: CGPoint(x: 208, y: 110),
                          control1: CGPoint(x: 177, y: 334), control2: CGPoint(x: 201, y: 215))
            road.addQuadCurve(to: CGPoint(x: 221, y: 98), control: CGPoint(x: 209, y: 98))
            road.addLine(to: CGPoint(x: 291, y: 98))
            road.addQuadCurve(to: CGPoint(x: 304, y: 110), control: CGPoint(x: 303, y: 98))
            road.addCurve(to: CGPoint(x: 358, y: 428),
                          control1: CGPoint(x: 311, y: 215), control2: CGPoint(x: 335, y: 334))
            road.addQuadCurve(to: CGPoint(x: 350, y: 436), control: CGPoint(x: 360, y: 436))
            road.addLine(to: CGPoint(x: 162, y: 436))
            road.addQuadCurve(to: CGPoint(x: 154, y: 428), control: CGPoint(x: 152, y: 436))
            road.closeSubpath()
            context.addPath(road)
            context.fillPath()

            let rails = CGMutablePath()
            rails.move(to: CGPoint(x: 105, y: 418))
            rails.addCurve(to: CGPoint(x: 174, y: 100),
                           control1: CGPoint(x: 139, y: 324), control2: CGPoint(x: 167, y: 204))
            rails.move(to: CGPoint(x: 407, y: 418))
            rails.addCurve(to: CGPoint(x: 338, y: 100),
                           control1: CGPoint(x: 373, y: 324), control2: CGPoint(x: 345, y: 204))
            context.addPath(rails)
            context.setLineWidth(46)
            context.setLineCap(.round)
            context.strokePath()
            context.restoreGState()

            let terminal = CGPath(roundedRect: CGRect(x: 10.8, y: 12, width: 10.4, height: 10.4),
                                  cornerWidth: 3, cornerHeight: 3, transform: nil)
            context.addPath(terminal)
            context.fillPath()
            context.setBlendMode(.clear)
            context.setLineWidth(1.2)
            context.addPath(terminal)
            context.strokePath()

            context.setLineCap(.round)
            context.setLineJoin(.round)
            context.move(to: CGPoint(x: 13.3, y: 15.1))
            context.addLine(to: CGPoint(x: 15.4, y: 17.2))
            context.addLine(to: CGPoint(x: 13.3, y: 19.3))
            context.move(to: CGPoint(x: 17.4, y: 19.2))
            context.addLine(to: CGPoint(x: 19, y: 19.2))
            context.strokePath()
            context.endTransparencyLayer()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "TaskBelay"
        return image
    }
}
