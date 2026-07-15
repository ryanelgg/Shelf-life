import Foundation
import Capacitor
import WidgetKit

// Bridges the JS pantry snapshot into the shared App Group that the
// PantreWidget extension reads, then asks WidgetKit to refresh now.
//
// Auto-registered by Capacitor via CAPBridgedPlugin (same as the barcode
// scanner plugin in this target). JS side: src/lib/widget.ts.
@objc(PantreWidgetPlugin)
public class PantreWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PantreWidgetPlugin"
    public let jsName = "PantreWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setData", returnType: CAPPluginReturnPromise),
    ]

    static let appGroup = "group.com.elghazzali.shelflife"
    static let dataKey = "pantreWidgetData"

    @objc func setData(_ call: CAPPluginCall) {
        guard let value = call.getString("value") else {
            call.reject("value is required")
            return
        }
        if let defaults = UserDefaults(suiteName: PantreWidgetPlugin.appGroup) {
            defaults.set(value, forKey: PantreWidgetPlugin.dataKey)
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
