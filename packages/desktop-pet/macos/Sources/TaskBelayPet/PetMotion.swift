import AppKit
import SwiftUI

/// Selects system animations for the native pet views and panel.
@MainActor
enum PetMotion {
    nonisolated static let bubbleDuration: TimeInterval = 0.28

    static func animate(duration: TimeInterval = bubbleDuration, enabled: Bool,
                        spring: Bool = true, changes: () -> Void,
                        completion: @escaping () -> Void = {}) {
        if #available(macOS 15.0, *) {
            let animation: Animation = !enabled ? .linear(duration: 0)
                : spring ? .smooth(duration: duration, extraBounce: 0)
                : .easeInOut(duration: duration)
            NSAnimationContext.animate(animation, changes: changes, completion: completion)
        } else {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = enabled ? duration : 0
                context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                changes()
            } completionHandler: { MainActor.assumeIsolated { completion() } }
        }
    }
}
