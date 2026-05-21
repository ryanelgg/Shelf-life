import Foundation
import Capacitor
import AuthenticationServices

@objc(SignInWithApple)
public class SignInWithApple: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SignInWithApple"
    public let jsName = "SignInWithApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]

    @objc func authorize(_ call: CAPPluginCall) {
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        let request = appleIDProvider.createRequest()

        var requestedScopes: [ASAuthorization.Scope] = []
        if let scopesStr = call.getString("scopes") {
            if scopesStr.contains("name") { requestedScopes.append(.fullName) }
            if scopesStr.contains("email") { requestedScopes.append(.email) }
        }
        request.requestedScopes = requestedScopes.isEmpty ? nil : requestedScopes
        request.nonce = call.getString("nonce")

        self.bridge?.saveCall(call)
        UserDefaults.standard.setValue(call.callbackId, forKey: "SIWACallbackId")

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.performRequests()
    }
}

extension SignInWithApple: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let id = UserDefaults.standard.string(forKey: "SIWACallbackId"),
              let call = self.bridge?.savedCall(withID: id) else { return }

        call.resolve([
            "response": [
                "user": cred.user,
                "email": cred.email as Any,
                "givenName": cred.fullName?.givenName as Any,
                "familyName": cred.fullName?.familyName as Any,
                "identityToken": cred.identityToken.flatMap { String(data: $0, encoding: .utf8) } as Any,
                "authorizationCode": cred.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } as Any
            ]
        ])
        self.bridge?.releaseCall(call)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let id = UserDefaults.standard.string(forKey: "SIWACallbackId"),
              let call = self.bridge?.savedCall(withID: id) else { return }
        let nsError = error as NSError
        if nsError.code == ASAuthorizationError.canceled.rawValue {
            call.reject("User cancelled", "1001", nil)
        } else {
            call.reject(error.localizedDescription)
        }
        self.bridge?.releaseCall(call)
    }
}
