import Foundation
import Capacitor
#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

// Bridges Apple's DeclaredAgeRange framework (iOS 26+) to the web layer so
// Pantre can honor the state App Store Accountability Acts and apply
// age-appropriate defaults without ever collecting a birthdate.
//
// VERIFICATION NOTE: the DeclaredAgeRange API is iOS 26 only and cannot be
// compiled or exercised outside Xcode 26 + a device/simulator with the
// `com.apple.developer.declared-age-range` entitlement on the provisioning
// profile. The plugin scaffolding (CAPBridgedPlugin conformance, registration,
// promise handling) mirrors this repo's existing SignInWithApple plugin and is
// known-good; the one block to re-check against the installed SDK is the
// `AgeRangeService.requestAgeRange(...)` call and the range's bound properties.
// The `#if canImport(DeclaredAgeRange)` guard keeps the file compiling on
// toolchains without the framework (it just resolves `unavailable`).
@objc(DeclaredAgeRangePlugin)
public class DeclaredAgeRangePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeclaredAgeRange"
    public let jsName = "DeclaredAgeRange"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAgeRange", returnType: CAPPluginReturnPromise),
    ]

    @objc func requestAgeRange(_ call: CAPPluginCall) {
        let gates = call.getArray("ageGates", Int.self) ?? [13, 18]

        #if canImport(DeclaredAgeRange)
        if #available(iOS 26.0, *) {
            Task { @MainActor in
                guard let viewController = self.bridge?.viewController else {
                    call.resolve(["status": "unavailable"])
                    return
                }
                do {
                    let response = try await AgeRangeService.shared.requestAgeRange(
                        ageGates: gates,
                        in: viewController
                    )
                    switch response {
                    case .sharing(let range):
                        call.resolve([
                            "status": "shared",
                            "lowerBound": range.lowerBound as Any,
                            "upperBound": range.upperBound as Any,
                        ])
                    case .declinedSharing:
                        call.resolve(["status": "declined"])
                    @unknown default:
                        call.resolve(["status": "unavailable"])
                    }
                } catch {
                    call.resolve(["status": "unavailable"])
                }
            }
            return
        }
        #endif

        // Older iOS / no framework: the web layer falls back to the 13+ gate.
        call.resolve(["status": "unavailable"])
    }
}
