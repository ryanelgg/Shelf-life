import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    // IMPORTANT: custom native plugins must be registered with registerPluginInstance,
    // NOT registerPluginType. When autoRegisterPlugins is true (the default),
    // registerPluginType is a silent no-op and the JS bridge will return UNIMPLEMENTED.
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SignInWithApple())
        bridge?.registerPluginInstance(CapacitorBarcodeScanner())
    }
}
